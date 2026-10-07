const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export const page = (backend: string | null) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orbit Search</title>
<style>
@font-face{font-family:Inter;src:url(/fonts/inter.woff2);font-weight:100 900}
@font-face{font-family:SG;src:url(/fonts/space-grotesk.woff2);font-weight:300 700}
@font-face{font-family:Plex;src:url(/fonts/plex-mono.woff2)}
:root{--bg:#050505;--s:#0d0d0d;--s2:#151515;--t:#f5f5f2;--t2:#a0a0a0;--m:#686868;--b:rgba(255,255,255,.12);--b2:rgba(255,255,255,.22);--a:#9cb4d8}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--t);font:15px/1.5 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.label{font:11px Plex,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--m)}
main{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 24px;transition:justify-content .2s}
body.has-results main{justify-content:flex-start;padding-top:28px}
.logo{width:52px;height:52px;color:var(--t)}.brand{font:600 14px SG,sans-serif;letter-spacing:.4em;margin:14px 0 40px}
h1{font:700 clamp(32px,5vw,56px)/1 SG,sans-serif;letter-spacing:-.04em;margin:0 0 28px;text-align:center}
body.has-results .logo,body.has-results h1{display:none}body.has-results .brand{margin:0 0 16px}
form{width:min(680px,100%)}
input{width:100%;background:var(--s);color:var(--t);border:1px solid var(--b2);border-radius:30px;padding:17px 24px;font:inherit;font-size:18px;outline:0}
input:focus-visible{border-color:var(--a);outline:2px solid var(--a);outline-offset:2px}
nav{display:flex;gap:26px;margin:22px 0 0}nav button{background:none;border:0;color:var(--t2);font:12px Plex,monospace;letter-spacing:.08em;text-transform:uppercase;padding:6px 0;cursor:pointer;border-bottom:1px solid transparent}
nav button[aria-pressed=true]{color:var(--t);border-color:var(--t)}nav button:focus-visible{outline:2px solid var(--a)}
#out{width:min(680px,100%);margin-top:28px}.r{padding:16px 0;border-top:1px solid var(--b)}.r a{color:var(--t);font:500 18px/1.3 Inter;text-decoration:none}.r a:hover{text-decoration:underline}
.r .u{font:11px Plex,monospace;color:var(--m);margin-bottom:3px}.r p{margin:6px 0 0;color:var(--t2)}
.imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.imgs a{display:block;aspect-ratio:1;background:var(--s2);overflow:hidden}.imgs img{width:100%;height:100%;object-fit:cover}
.note{margin-top:34px;color:var(--m);font:11px Plex,monospace;text-align:center;max-width:60ch}
</style></head><body>
<main>
<svg class="logo" viewBox="0 0 64 64" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(45 32 32)"/><ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(-45 32 32)" pathLength="100" stroke-dasharray="86 14" stroke-dashoffset="-4"/></g><circle cx="51.1" cy="12.9" r="4.5" fill="currentColor"/></svg>
<div class="brand">X ORBIT</div>
<h1>Where do you<br>want to go?</h1>
<form id="f" role="search"><input id="q" name="q" autofocus autocomplete="off" spellcheck="false" placeholder="Search the web..." aria-label="Search the web"></form>
<nav aria-label="Search type"><button type="button" data-t="web" aria-pressed="true">Web</button><button type="button" data-t="images" aria-pressed="false">Images</button><button type="button" data-t="news" aria-pressed="false">News</button><button type="button" data-t="maps" aria-pressed="false">Maps</button></nav>
<div id="out" aria-live="polite"></div>
<p class="note" id="note">${backend ? `Results via ${esc(backend)}. ` : 'No search API is configured, so searches are forwarded to Google. '}Orbit Search is an interface; it does not run its own web index yet.</p>
</main>
<script>
const q=document.getElementById('q'),out=document.getElementById('out');let type='web';
const params=new URLSearchParams(location.search);q.value=params.get('q')||'';type=params.get('t')||'web';
document.querySelectorAll('nav button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.t===type));b.onclick=()=>{type=b.dataset.t;document.querySelectorAll('nav button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(q.value.trim())run()}});
document.getElementById('f').onsubmit=e=>{e.preventDefault();run()};
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const safe=u=>/^https?:\\/\\//.test(u)?u:'#';
async function run(){const v=q.value.trim();if(!v)return;history.replaceState(null,'','?'+new URLSearchParams({q:v,t:type}));
 out.textContent='Searching…';document.body.classList.add('has-results');
 try{const r=await fetch('/api/search?'+new URLSearchParams({q:v,type}));const j=await r.json();
  if(j.redirect){out.textContent='Opening results…';location.href=j.redirect;return}
  if(j.error)throw new Error(j.error);out.replaceChildren();
  if(!j.results.length){out.textContent='No results.';return}
  if(type==='images'){const g=el('div','imgs');for(const i of j.results){const a=el('a');a.href=safe(i.url);a.rel='noopener noreferrer';const im=el('img');im.src=safe(i.thumbnail||i.url);im.alt=i.title;im.loading='lazy';a.append(im);g.append(a)}out.append(g);return}
  for(const i of j.results){const d=el('div','r');d.append(el('div','u',i.displayUrl));const a=el('a',null,i.title);a.href=safe(i.url);a.rel='noopener noreferrer';d.append(a,el('p',null,i.snippet));out.append(d)}
 }catch(e){out.textContent='Search failed: '+e.message}}
if(q.value.trim())run();
</script></body></html>`
