// Generate a public landing and read-only copy of the ORIGINAL student pages.
// Runs at every Vercel deploy, so code/layout changes propagate automatically.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'landing','dist');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const cp=(from,to)=>{
 const src=path.join(root,from),dest=path.join(out,to);
 if(!fs.existsSync(src)){console.warn('Optional asset not found:',from);return false}
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.cpSync(src,dest,{recursive:true,force:true});return true;
};
for(const name of ['index.html','admin.html'])cp('landing/'+name,name);
const pages=['home.html','aluno.html','perfil.html','enviar-material.html','pergunte-ao-daniel.html','guias-gramatica.html','recursos.html'];
const scripts=['common.js','aluno.js','perfil.js','perguntaAoDaniel.js','enviarMaterial.js','guiasGramatica.js','recursos.js'];
for(const f of scripts)cp('js/'+f,'visit/js/'+f);
cp('landing/visitor-demo-client.js','visit/js/supabaseClient.js');
cp('landing/visitor-tour.js','visit/visitor-tour.js');
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
'.visitor-tour-actions{display:flex;gap:7px;justify-content:flex-end}',
'.visitor-tour-actions button{font:600 12px "IBM Plex Sans",sans-serif;border:1px solid #c1d3e7;background:white;color:#162d4c;border-radius:8px;padding:9px 11px;cursor:pointer}',
'.visitor-tour-actions button.primary{background:#16213e;color:white}',
'.visitor-tour-actions button:disabled{opacity:.4}',
'.visitor-readonly-alert{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2100;background:#203b60;color:#fff;padding:14px 20px;border-radius:12px;max-width:95vw;box-shadow:0 18px 45px #071a3655;font:500 13px "IBM Plex Sans",sans-serif}',
'@media(max-width:860px){.visitor-ribbon{padding:10px 14px}.visitor-tour-tooltip{left:16px!important;top:auto!important;bottom:16px!important}.visitor-ribbon-actions a{padding:8px 10px}}'
].join('\n');
fs.mkdirSync(path.join(out,'visit','js'),{recursive:true});
fs.writeFileSync(path.join(out,'visit','style.css'),fs.readFileSync(path.join(root,'style.css'),'utf8')+'\n'+styles,'utf8');
fs.writeFileSync(path.join(out,'visit','js','emailConfig.js'),'async function sendLessonNotification(){return {ok:false,visitor:true}}','utf8');
for(const name of pages){
 const file=path.join(root,name);if(!fs.existsSync(file))continue;
 let html=fs.readFileSync(file,'utf8');
 html=html.replace(/<script[^>]+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"[^>]*><\/script>/g,'');
 html=html.replace(/<script[^>]+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@emailjs\/browser[^"]*"[^>]*><\/script>/g,'');
 html=html.replace(/<\/body>/i,'<script src="visitor-tour.js"></script></body>');
 fs.writeFileSync(path.join(out,'visit',name),html,'utf8');
}
fs.writeFileSync(path.join(out,'visit','index.html'),'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=home.html"><a href="home.html">Abrir demonstração</a>','utf8');
fs.writeFileSync(path.join(out,'visitor.html'),'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=visit/home.html"><a href="visit/home.html">Explorar o portal do aluno</a>','utf8');
console.log('Built guest portal from',pages.length,'original HTML pages and',scripts.length,'original JS modules.');
