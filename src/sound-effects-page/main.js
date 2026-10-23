import { INVENTORY, matchesSource, filterInventory, sourceInfo, inventoryCounts } from './catalog.js';
import { EffectPreview } from './preview.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let manifest=null,preview=null;
const review=new URLSearchParams(location.search).has('reviewMute');
function render(){
 const entries=filterInventory(INVENTORY,{query:$('#search').value,source:$('#source').value,group:$('#group').value},manifest);
 const counts=inventoryCounts(manifest);
 $('#counts').textContent=`${counts.actions} gameplay actions · ${counts.variants} gameplay variants. Includes ${counts.characterEfforts} nonverbal character efforts. ${entries.length} cards match the current filters.`;
 $('#coverage').innerHTML=Object.entries(counts.coverage).filter(([,n])=>n>0).map(([label,n])=>`<div><strong>${n}</strong><span>${esc(label)}</span></div>`).join('');
 $('#denominator').textContent=`All ${counts.variants} gameplay variants, counted once each. This is the full inventory, not the selected-replacement plan. Procedural effects are intentional, not missing recordings.`;
 $('#bank-counts').textContent=`Recording bank, counted separately: ${counts.recordingGroups} groups · ${counts.recordingFiles} files. ${counts.missingProvenance?counts.missingProvenance+' files have unavailable provenance.':'Source information is available for every file.'}`;
 $('#list').innerHTML=[...new Set(entries.map(e=>e.group))].map(group=>`<section class="band"><h2>${esc(group)}</h2><div class="grid">${entries.filter(e=>e.group===group).map(e=>{
 const variants=e.variants.map((v,i)=>{if(!matchesSource(e,i,$('#source').value,manifest))return '';const info=sourceInfo(e,i,manifest);return `<option value="${i}">${esc(v[0])} — ${esc(info.display)}</option>`;}).join('');
 return `<article class="card" data-id="${esc(e.id)}"><h3>${esc(e.name)}</h3><p class="where">${esc(e.where)}</p><label>Variant <select class="variant">${variants}</select></label><div class="source-info"></div><div class="transport"><button class="play">Play</button></div><p class="live small">Not played</p></article>`;
 }).join('')}</div></section>`).join('')||'<p class="empty">No matching sound effects.</p>';
 for(const card of document.querySelectorAll('article'))details(card);
}
function details(card){const e=INVENTORY.find(x=>x.id===card.dataset.id),i=Number(card.querySelector('.variant').value),s=sourceInfo(e,i,manifest);
 card.querySelector('.source-info').innerHTML=`<p class="badge">${esc(s.display)}</p><p class="small">${esc(s.note)}</p>${s.files.length?`<details class="sources"><summary>Recordings and provenance (${s.files.length})</summary>${s.files.map(file=>{const m=manifest?.files?.[file.replace(/\.(mp3|wav)$/,'')];return `<p>${esc(file)} · ${esc(m?.from??m?.provider??'Provenance unavailable')}</p>`;}).join('')}</details>`:''}`;
}
$('#group').innerHTML+=[...new Set(INVENTORY.map(e=>e.group))].map(g=>`<option>${esc(g)}</option>`).join('');
for(const id of ['search','source','group'])$('#'+id).addEventListener(id==='search'?'input':'change',()=>{preview?.stop();render();});
$('#stop').onclick=()=>preview?.stop();
$('#volume').addEventListener('input',()=>preview?.player?.setVolume(Number($('#volume').value)));
$('#list').addEventListener('change',e=>{if(e.target.matches('.variant')){preview?.stop();details(e.target.closest('article'));}});
$('#list').addEventListener('click',e=>{if(!e.target.matches('.play'))return;const card=e.target.closest('article'),entry=INVENTORY.find(x=>x.id===card.dataset.id),variant=Number(card.querySelector('.variant').value);
 preview??=new EffectPreview({muted:review,manifest,changed:s=>{$('#status').textContent=s.text;for(const c of document.querySelectorAll('article')){c.classList.toggle('playing',s.state==='playing'&&c.dataset.id===s.id);if(c.dataset.id===s.id||s.state==='stopped')c.querySelector('.live').textContent=s.text;
 if(c.dataset.id===s.id){const play=c.querySelector('.play');play.dataset.retry=s.state==='error'?'true':'false';play.textContent=s.state==='error'?'Retry loading and play':'Play';}}}});
 const route=sourceInfo(entry,variant,manifest);if(route.unclassified){$('#status').textContent=route.note;return;}
 void preview.play({...entry,previewGroups:route.groups},variant,{volume:Number($('#volume').value),retry:e.target.dataset.retry==='true'});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)preview?.stop();});window.addEventListener('pagehide',()=>preview?.stop());window.addEventListener('blur',()=>preview?.stop());
render();fetch(`${import.meta.env.BASE_URL}sfx/manifest.json`).then(r=>{if(!r.ok)throw Error('Manifest unavailable');return r.json();}).then(m=>{manifest=m;if(preview)preview.manifest=m;render();}).catch(()=>{$('#status').textContent='Provenance unavailable; recordings are labelled unknown until the manifest loads.';});
