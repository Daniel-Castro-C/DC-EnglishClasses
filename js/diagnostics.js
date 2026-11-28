// Only coarse operational signals. No messages, paths, query strings, IDs or stack traces.
(function(g){
 const attached=new WeakSet();
 function attach(client,surface){
  if(!client||attached.has(client))return;
  attached.add(client);const recent=new Map();
  async function record(kind){
   const now=Date.now();
   if(recent.has(kind)&&now-recent.get(kind)<60000)return;
   recent.set(kind,now);
   try{
    const {data}=await client.auth.getSession();
    if(data?.session)await client.rpc('portal_record_diagnostic',{p_surface:surface,p_kind:kind});
   }catch{/* Diagnostics never interrupt the application. */}
  }
  g.addEventListener('error',e=>{if(e.target===g)record('runtime');else if(e.target?.tagName==='SCRIPT')record('script_load');},true);
  g.addEventListener('unhandledrejection',()=>record('promise'));
 }
 g.PortalDiagnostics={attach};
 if(typeof sb!=='undefined'){
  const page=g.location.pathname.split('/').pop();
  const pages=['admin.html','home.html','aluno.html','perfil.html','recursos.html','guias-gramatica.html','pergunte-ao-daniel.html','enviar-material.html','index.html','atualizar-senha.html','esqueci-senha.html'];
  if(pages.includes(page))attach(sb,'portal:'+page);
 }
})(window);
