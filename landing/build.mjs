// Generate a public landing and read-only copy of the ORIGINAL student pages.
// Runs at every Vercel deploy, so code/layout changes propagate automatically.
import fs from 'node:fs';
import path from 'node:path';
import {brandStyles} from './visitor-brand.mjs';
const root=process.cwd(),out=path.join(root,'landing','dist');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const cp=(from,to)=>{
 const src=path.join(root,from),dest=path.join(out,to);
 if(!fs.existsSync(src)){console.warn('Optional asset not found:',from);return false}
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.cpSync(src,dest,{recursive:true,force:true});return true;
};
for(const name of ['index.html','admin.html','depoimento.html','disponibilidade.html','availability.js','availability-embedded.css','analytics.js','admin-analytics.js','enrollment-settings.js','admin-navigation.js','admin-notifications.js','admin-crm.js','admin-navigation.css'])cp('landing/'+name,name);
// Use the real module grid and notification code in a data-free preview, never in production.
if(process.env.VERCEL_ENV!=='production'){
 const admin=fs.readFileSync(path.join(root,'landing','admin.html'),'utf8');
 const head=admin.match(/^[\s\S]*?<\/head>/)?.[0];
 const grid=admin.match(/<nav class="admin-module-grid"[\s\S]*?<\/nav>/)?.[0];
 if(!head||!grid)throw Error('Admin notification preview: source markup missing');
 fs.writeFileSync(path.join(out,'admin-notifications-preview.html'),head+'<body><header><div class="row"><div class="dc-admin-brand"><img src="./logo-reversa.svg" alt="D.C English Classes"><div>Prévia de notificações</div></div></div></header><main><div class="card"><h2>Teste isolado</h2><p>Dados fictícios, sem conexão com o banco. Os avisos aparecem nos cards correspondentes. Clique em um card para simular a leitura e use os botões para receber novos eventos.</p><div class="controls"><button data-demo-event="testimonial">Novo depoimento</button><button data-demo-event="visit">Novo acesso</button><button data-demo-event="availability">Novo formulário</button><button data-demo-event="waitlist">Nova lista de espera</button></div><p id="demo-message" class="muted" aria-live="polite"></p></div><div id="dashboard"><div class="admin-home-heading"><div class="admin-eyebrow">D.C English Classes</div><h1>Administração da landing page</h1><p class="muted">Escolha a área que deseja gerenciar.</p></div>'+grid+'</div></main><script src="admin-notifications.js"></script><script>const rows={landing_testimonials:[],landing_leads:[],landing_visit_events:[]};const db={from(table){const filters={};return {select(){return this},eq(k,v){filters[k]=v;return this},order(){return this},async limit(){return {data:rows[table].filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v)).slice(-1)}}}}};const api=LandingAdminNotifications.bind(db,()=>true);api.start("preview-"+Math.random());let offset=0;function submit(key){const x={testimonial:["landing_testimonials",{status:"pending"}],visit:["landing_visit_events",{kind:"landing"}],availability:["landing_leads",{source:"availability",status:"novo"}],waitlist:["landing_leads",{source:"landing",status:"novo"}]}[key];rows[x[0]].push({...x[1],created_at:new Date(Date.now()+(++offset)*1000).toISOString()});return api.refresh()}document.querySelectorAll("[data-demo-event]").forEach(b=>b.onclick=()=>submit(b.dataset.demoEvent));document.querySelectorAll(".admin-module-link").forEach(a=>a.onclick=async e=>{e.preventDefault();await api.open(a.hash.slice(1),async()=>true,()=>true);document.getElementById("demo-message").textContent="Área consultada: "+a.querySelector(".admin-module-name").textContent});["testimonial","visit","availability","waitlist"].forEach(submit);</script></body></html>','utf8');
 const crmPanel=admin.match(/<div class="crm-lead-insights">[\s\S]*?(?=<div id="lead-count")/)?.[0];
 const sourcePanel=admin.match(/<section class="crm-source-panel">[\s\S]*?<\/section>/)?.[0];
 if(!crmPanel||!sourcePanel)throw Error('Landing CRM preview markup missing');
 fs.writeFileSync(path.join(out,'admin-crm-preview.html'),head+'<body><header><div class="row"><div class="dc-admin-brand"><img src="./logo-reversa.svg" alt="D.C English Classes"><div>Prévia · CRM</div></div></div></header><main><div class="card"><h1>Leads e lista de interesse</h1><p>Prévia isolada com dados fictícios. Registre uma resposta para encerrar o lembrete, ou consulte a correspondência de horários.</p><p id="crm-followup-badge" hidden></p><p id="preview-notice" aria-live="polite"></p>'+crmPanel+'</div><div class="card">'+sourcePanel+'</div></main><script src="admin-crm.js"></script><script>const now=Date.now(),today=new Date(now-3*3600000).toISOString().slice(0,10),day=(new Date(today+"T12:00:00Z").getUTCDay()+6)%7;const leads=[{id:"demo-a",full_name:"Lead de exemplo",status:"contatado",availability_slots:[day+"|19:00"]},{id:"demo-b",full_name:"Outro interessado",status:"novo",availability_slots:[day+"|18:00"]}];const history=[{lead_id:"demo-a",kind:"outbound",note:"Enviei as opções disponíveis.",created_at:new Date(now-49*3600000).toISOString()}];const db={async rpc(name){if(name==="landing_lead_followups"){const out=leads.flatMap(l=>{const last=history.filter(x=>x.lead_id===l.id&&x.kind!=="note").at(-1);return last?[{lead_id:l.id,last_contact:last.created_at,due:last.kind==="outbound"&&Date.now()-Date.parse(last.created_at)>=48*3600000}]:[]});return {data:out}}return {data:[{source:"instagram",visits:12},{source:"youtube",visits:7},{source:"direct",visits:9},{source:"referral",visits:3}]}},from(){let id;return {select(){return this},eq(k,v){id=v;return this},order(){return this},async limit(){return {data:history.filter(x=>x.lead_id===id).reverse()}},async insert(x){history.push({...x,created_at:new Date().toISOString()});return {error:null}}}}};const crm=LandingCRM.bind(db,()=>true,s=>document.getElementById("preview-notice").textContent=s);crm.update(leads,[{weekday:day,active:true,start_time:"19:00:00",starts_on:today}],[]);crm.sources(30);</script></body></html>','utf8');

}
cp('ui-quality.css','ui-quality.css');
cp('js/diagnostics.js','diagnostics.js');
cp('ui-quality.css','visit/ui-quality.css');
// Signature 2027: shared visual assets (no changes to student data or workflows).
cp('landing/signature-2027.css','signature-2027.css');
cp('landing/signature-mark.svg','signature-mark.svg');
for(const f of ['logo-principal.svg','logo-reversa.svg','favicon.svg'])cp('landing/'+f,f);
const availability=fs.readFileSync(path.join(root,'landing','disponibilidade.html'),'utf8');
const sharedForm=availability.match(/<form id="availability-form">[\s\S]*?<\/form>\s*<div id="success"[\s\S]*?<\/div>/)?.[0];
if(!sharedForm)throw Error('Shared availability form not found');
const landingPage=path.join(out,'index.html');
fs.writeFileSync(landingPage,fs.readFileSync(landingPage,'utf8').replace(/<!-- SHARED_AVAILABILITY_FORM -->[\s\S]*?<!-- END_SHARED_AVAILABILITY_FORM -->/,sharedForm.replace('id="availability-form"','id="availability-form" data-source="landing"')),'utf8');
const pages=['home.html','aluno.html','perfil.html','enviar-material.html','pergunte-ao-daniel.html','guias-gramatica.html','recursos.html'];
// Discover dependencies from the actual student pages and shared modules,
// including scripts loaded dynamically with document.write().
const scripts=new Set();
const seen=new Set();
const scan=source=>{
 for(const match of source.matchAll(/js\/([a-zA-Z0-9_-]+\.js)/g)){
  const name=match[1];
  if(name==='supabaseClient.js'||name==='emailConfig.js'||seen.has(name))continue;
  const full=path.join(root,'js',name);
  if(!fs.existsSync(full))throw Error('Student module referenced but not found: '+name);
  seen.add(name);scripts.add(name);
  scan(fs.readFileSync(full,'utf8'));
 }
};
for(const name of pages){
 const source=path.join(root,name);
 if(fs.existsSync(source))scan(fs.readFileSync(source,'utf8'));
}
for(const f of scripts){
 cp('js/'+f,'visit/js/'+f);
 // These modules contain inline UI colors, but no flag icon or student fixture colors.
 if(['recursos.js','recursos-module.js'].includes(f)){
  const file=path.join(out,'visit','js',f);
  fs.writeFileSync(file,brandStyles(fs.readFileSync(file,'utf8')),'utf8');
 }
}
cp('landing/visitor-demo-client.js','visit/js/supabaseClient.js');
cp('landing/visitor-tour.js','visit/visitor-tour.js');
for(const f of ['logo-principal.svg','logo-reversa.svg','signature-mark.svg','favicon.svg'])cp('landing/'+f,'visit/'+f);
for(const f of ['logo.png','guia-portal-do-aluno.pdf','icon-192.png','icon-512.png','manifest.json'])cp(f,'visit/'+f);
cp('badges','visit/badges');
const styles=[
'[hidden]{display:none!important}',
'.visitor-ribbon{position:relative;z-index:25;background:#dfecf9;border-bottom:1px solid #abc8e6;color:#1b3655;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font:600 12px/1.5 "IBM Plex Sans",sans-serif}',
'.visitor-ribbon-actions{display:flex;align-items:center;gap:8px}',
'.visitor-ribbon button,.visitor-ribbon a{font:600 11px "IBM Plex Sans",sans-serif;border-radius:8px;border:1px solid #aac8e7;background:#fff;color:#1d3b60;text-decoration:none;padding:8px 13px;cursor:pointer}',
'.visitor-ribbon a{background:#16213e;color:white}',
'.visitor-tour-overlay{position:fixed;inset:0;background:rgba(8,17,34,.69);z-index:1999}',
'.visitor-tour-focus{position:relative!important;z-index:2001!important;outline:3px solid #88c5ff!important;outline-offset:5px!important;border-radius:12px}',
'.visitor-tour-tooltip{position:fixed;z-index:2002;background:white;color:#1a2f4c;padding:21px;border-radius:14px;box-shadow:0 24px 70px #08132788;width:min(360px,calc(100vw - 32px))}',
'.visitor-tour-tooltip h3{margin:12px 0 6px;font:700 18px/1.3 "IBM Plex Sans",sans-serif}',
'.visitor-tour-tooltip p{font:400 13px/1.6 "IBM Plex Sans",sans-serif;color:#546f8d;margin:6px 0 15px}',
'.visitor-tour-counter{font:700 10px "IBM Plex Sans",sans-serif;color:#357db6;letter-spacing:.08em}',
'.visitor-tour-progress{display:flex;gap:5px;margin:13px 0}',
'.visitor-tour-progress i{height:5px;flex:1;background:#dce8f3;border-radius:10px}',
'.visitor-tour-progress i.on{background:#5b93c4}',
'.visitor-tour-actions{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap}',
'.visitor-tour-actions button{font:600 12px "IBM Plex Sans",sans-serif;border:1px solid #c1d3e7;background:white;color:#162d4c;border-radius:8px;padding:9px 11px;cursor:pointer}',
'.visitor-tour-actions button.primary{background:#16213e;color:white}',
'.visitor-tour-actions button:disabled{opacity:.4}',
'.visitor-readonly-alert{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2100;background:#203b60;color:#fff;padding:14px 20px;border-radius:12px;max-width:95vw;box-shadow:0 18px 45px #071a3655;font:500 13px "IBM Plex Sans",sans-serif}',
'@media(max-width:860px){.visitor-ribbon{padding:10px 14px}.visitor-tour-tooltip{left:16px!important;top:auto!important;bottom:16px!important}.visitor-ribbon-actions a{padding:8px 10px}}'
].join('\n');
fs.mkdirSync(path.join(out,'visit','js'),{recursive:true});
const fonts="@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Manrope:wght@400;500;600;700;800&family=Poppins:wght@500&display=swap');\n";
const originalCss=fs.readFileSync(path.join(root,'style.css'),'utf8');
const signatureCss=fs.readFileSync(path.join(root,'landing','visitor-signature.css'),'utf8');
fs.writeFileSync(path.join(out,'visit','style.css'),fonts+brandStyles(originalCss+'\n'+styles)+'\n'+signatureCss,'utf8');
fs.writeFileSync(path.join(out,'visit','js','emailConfig.js'),'async function sendLessonNotification(){return {ok:false,visitor:true}}','utf8');
for(const name of pages){
 const file=path.join(root,name);if(!fs.existsSync(file))continue;
 let html=fs.readFileSync(file,'utf8');
 html=brandStyles(html);
 html=html.replace(/<html lang="([^"]+)">/,'<html lang="$1" data-brand-surface="visitor">');
 html=html.replace(/(<img class="logo" src=")logo.png(")/g,'$1logo-reversa.svg$2');
 html=html.replace(/src="logo.png"/g,'src="signature-mark.svg"');
 html=html.replace(/<\/head>/i,'<link rel="icon" type="image/svg+xml" href="favicon.svg"><meta name="robots" content="noindex,nofollow"></head>');
 html=html.replace(/<script[^>]+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"[^>]*><\/script>/g,'');
 html=html.replace(/<script[^>]+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@emailjs\/browser[^"]*"[^>]*><\/script>/g,'');
 html=html.replace(/<\/body>/i,'<script src="visitor-tour.js"></script><script src="../analytics.js" defer></script></body>');
 fs.writeFileSync(path.join(out,'visit',name),html,'utf8');
}
fs.writeFileSync(path.join(out,'visit','index.html'),'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=home.html"><a href="home.html">Abrir demonstração</a>','utf8');
fs.writeFileSync(path.join(out,'visitor.html'),'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=visit/home.html"><a href="visit/home.html">Explorar o portal do aluno</a>','utf8');
await import('./generate-demo-pdfs.mjs');
console.log('Built guest portal from',pages.length,'original HTML pages and',scripts.size,'original JS modules.');
