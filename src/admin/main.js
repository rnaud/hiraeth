import '../analytics-page/style.css';
import './style.css';
import { adminClient } from './session.js';
const client = adminClient(), app = document.querySelector('#app');
// /admin redirects to /admin/ on GitHub Pages; no custom domain routing needed.
const home = new URL('../', location.href);
app.innerHTML = `<header><a class="brand" href="${home.href}">HIRAETH <span>/ Admin</span></a><a class="play" href="${home.href}">Back to the game ↗</a></header>
<main><div class="intro"><div class="eyebrow">BEHIND THE JOURNEY</div><h1>Your Hiraeth workspace.</h1><p>Player insights, release notes and tools for shaping the world.</p></div>
<p id="notice" role="status" aria-live="polite"></p>
<form id="login" hidden><h2>Private access</h2><p>Sign in with your Hiraeth notebook password.</p><label>Password<input id="password" type="password" autocomplete="current-password" required></label><button id="submit">Unlock admin</button></form>
<section id="hub" hidden aria-label="Administration"><div class="admin-grid">
<a class="admin-card featured" href="${new URL('analytics.html', home)}"><span class="eyebrow">01 / PLAYER INSIGHTS</span><h2>Analytics <span>↗</span></h2><p>Activity, progression and loading across web, Android and Linux.</p><small>One dataset · All platforms</small></a>
<a class="admin-card" href="${new URL('changelog.html', home)}"><span class="eyebrow">02 / RELEASES</span><h2>What’s changed <span>↗</span></h2><p>Release notes and reviewed pictures from each update.</p></a>
<a class="admin-card" href="${new URL('?worlds=1&dev=1', home)}"><span class="eyebrow">03 / DEVELOPMENT</span><h2>Debug & world tools <span>↗</span></h2><p>World selection, characters, cinematics and inspection tools.</p></a>
<a class="admin-card" href="https://hiraeth.alexandria-rnaud.workers.dev/notes"><span class="eyebrow">04 / NOTEBOOK</span><h2>Notes & issues <span>↗</span></h2><p>Your existing private notebook. Uses its own secure sign-in.</p></a></div>
<div class="admin-footer"><span>Private reports · Session expires after one hour</span><button id="logout" class="quiet">Sign out</button></div></section></main>`;
const $ = id => document.getElementById(id);
function display(authenticated) { $('login').hidden = authenticated; $('hub').hidden = !authenticated; }
$('login').onsubmit = async event => {
  event.preventDefault(); $('submit').disabled = true; $('notice').textContent = 'Signing in…';
  const password = $('password').value; $('password').value = '';
  try { await client.signIn(password); display(true); $('notice').textContent = ''; }
  catch (error) { $('notice').textContent = error.message; display(false); }
  finally { $('submit').disabled = false; }
};
$('logout').onclick = () => { client.signOut(); display(false); $('notice').textContent = 'Signed out on this tab.'; };
async function check() { try { display(await client.signedIn()); } catch (error) { display(false); $('notice').textContent = error.message; } }
window.addEventListener('pagehide', () => display(false));
window.addEventListener('pageshow', () => void check());
window.addEventListener('focus', () => void check());
void check();
