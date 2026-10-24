// Build-scoped immutable packages; the advancing feed is the site's atomic
// multipart deployment. Never delete/replace an asset on the full legacy tag.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const hash = b => createHash('sha256').update(b).digest('hex');
export const packageTag = build => {
  if (!Number.isSafeInteger(build) || build < 1) throw Error('Invalid package build');
  return `steam-deck-${build}`;
};
export function packageUrl(build, repo = 'rnaud/hiraeth') {
  if (repo !== 'rnaud/hiraeth') throw Error('Unexpected package repository');
  return `https://github.com/${repo}/releases/download/${packageTag(build)}/hiraeth-steam-deck-${build}.tar.gz`;
}
/** api is deliberately restricted: no asset deletion or stable-feed mutation. */
export async function publishPackage({ api, manifest, files, commit }) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw Error('Full tested commit required');
  const tag = packageTag(manifest.build), archive = `hiraeth-steam-deck-${manifest.build}.tar.gz`;
  if (manifest.url !== packageUrl(manifest.build) || !/^[0-9a-f]{64}$/.test(manifest.sha256)) throw Error('Invalid package manifest');
  if (files.length !== 3 || new Set(files.map(f => f.name)).size !== 3 || ![archive, 'steam-deck.json', 'install-hiraeth.py'].every(n => files.some(f => f.name === n))) throw Error('Expected exactly package, manifest and installer');
  if (hash(files.find(f => f.name === archive).data) !== manifest.sha256) throw Error('Local package checksum mismatch');
  if (JSON.stringify(JSON.parse(files.find(f => f.name === 'steam-deck.json').data)) !== JSON.stringify(manifest)) throw Error('Manifest bytes differ');
  const legacy = await api.get('steam-deck');
  if (!legacy || !['steam-deck.json', 'install-hiraeth.py'].every(n => legacy.assets.some(a => a.name === n))) throw Error('Legacy installer/feed missing; investigate without replacing');
  const marker = `Source commit: ${commit}`;
  const existingTag = await api.tagCommit(tag);
  if (existingTag !== null && existingTag !== commit) throw Error('Existing tag points to another commit');
  let release = await api.get(tag);
  if (!release) release = await api.create(tag, commit, marker);
  const provenance = r => r && r.tag_name === tag && r.prerelease && r.target_commitish === commit && r.body?.split('\n').includes(marker);
  if (!provenance(release)) throw Error('Release provenance mismatch');
  if (release.assets.some(a => !files.some(f => f.name === a.name))) throw Error('Unexpected package asset');
  for (const file of files) {
    let asset = release.assets.find(a => a.name === file.name);
    if (!asset) {
      if (!release.draft) throw Error('Published package is incomplete; refusing mutation');
      await api.upload(tag, file);
      release = await api.get(tag);
      asset = release?.assets.find(a => a.name === file.name);
    }
    if (!asset || asset.state !== 'uploaded' || asset.size !== file.data.length) throw Error(`Incomplete asset: ${file.name}`);
    const received = await api.download(asset);
    if (received.length !== file.data.length || hash(received) !== hash(file.data)) throw Error(`Remote checksum mismatch: ${file.name}`);
  }
  // No feed can point to a draft. Retry checks all existing bytes, never clobbers.
  const verifiedAssets = release.assets.map(a => ({ id: a.id, name: a.name, size: a.size }));
  if (release.draft) await api.publish(tag);
  const published = await api.get(tag);
  if (!provenance(published) || published.draft || await api.tagCommit(tag) !== commit) throw Error('Published release/tag verification failed');
  if (published.assets.length !== verifiedAssets.length || !verifiedAssets.every(a => published.assets.some(b => b.id === a.id && b.name === a.name && b.size === a.size && b.state === 'uploaded'))) throw Error('Published assets changed after verification');
  return { tag, commit, verified: files.map(f => ({ name: f.name, size: f.data.length, sha256: hash(f.data) })) };
}
// REST releases/tags cannot find a draft's pending tag. Resolve its numeric ID
// through GraphQL, then fetch REST metadata (including numeric asset IDs).
export function fetchRelease(gh, repo, tag) {
  const [owner, name] = repo.split('/');
  const query = 'query($owner:String!,$name:String!,$tag:String!){repository(owner:$owner,name:$name){release(tagName:$tag){databaseId}}}';
  const result = JSON.parse(gh(['api', 'graphql', '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-f', `tag=${tag}`]));
  if (result.errors?.length || !result.data?.repository) throw Error('Release lookup failed');
  const release = result.data.repository.release;
  if (release === null) return null;
  if (!Number.isSafeInteger(release?.databaseId) || release.databaseId < 1) throw Error('Invalid release ID');
  return JSON.parse(gh(['api', `repos/${repo}/releases/${release.databaseId}`]));
}
async function main() {
  const dir = 'output/steam-deck', repo = process.env.GITHUB_REPOSITORY;
  if (repo !== 'rnaud/hiraeth') throw Error('Unexpected publication repository');
  const manifest = JSON.parse(await readFile(`${dir}/steam-deck.json`));
  const files = await Promise.all([`hiraeth-steam-deck-${manifest.build}.tar.gz`, 'steam-deck.json', 'install-hiraeth.py'].map(async name => ({ name, path: `${dir}/${name}`, data: await readFile(`${dir}/${name}`) })));
  function gh(args, binary = false) {
    return execFileSync('gh', args, { encoding: binary ? null : 'utf8', maxBuffer: 1024 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  const get = async tag => fetchRelease(gh, repo, tag);
  const api = {
    get,
    async tagCommit(tag) {
      try { return JSON.parse(gh(['api', `repos/${repo}/commits/${tag}`])).sha; }
      catch (e) { if (/HTTP (404|422)/.test(String(e.stderr))) return null; throw e; }
    },
    async create(tag, commit, marker) {
      try { gh(['release', 'create', tag, '--repo', repo, '--target', commit, '--title', `Hiraeth for Steam Deck — ${manifest.version} (${manifest.build})`, '--draft', '--prerelease', '--latest=false', '--notes', `${marker}\nVersion: ${manifest.version}\nRuntime build: ${manifest.build}\nInstaller: https://github.com/${repo}/releases/download/${tag}/install-hiraeth.py\nAutomatic updates use the stable site multipart feed. Legacy release assets are preserved.`]); }
      catch (e) { if (!await get(tag)) throw e; }
      return get(tag);
    },
    async upload(tag, file) { gh(['release', 'upload', tag, file.path, '--repo', repo]); },
    async download(asset) { return gh(['api', '-H', 'Accept: application/octet-stream', `repos/${repo}/releases/assets/${asset.id}`], true); },
    async publish(tag) { gh(['release', 'edit', tag, '--repo', repo, '--draft=false', '--prerelease', '--latest=false']); },
  };
  console.log(JSON.stringify(await publishPackage({ api, manifest, files, commit: process.env.SHA }), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
