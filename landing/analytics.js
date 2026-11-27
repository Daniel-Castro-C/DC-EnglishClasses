// Best-effort session counts: no cookies/IDs, no user or URL data sent.
// A 30-minute per-surface marker is stored only in this browser tab.
(() => {
  'use strict';
  const hosts=new Set(['dc-englishclasses.vercel.app','dc-englishclasses-landing.vercel.app']);
  if(!hosts.has(location.hostname))return; // exclude preview/local builds
  const path=location.pathname;
  const kind=(path==='/'||path==='/index.html')?'landing':/^\/visit\/[^/]+\.html$/.test(path)&&path!=='/visit/index.html'?'portal':null;
  if(!kind)return;
  const key='dc-analytics-'+kind, windowMs=30*60*1000;
  const endpoint='https://dgwbjgngewymzgedlzix.supabase.co/rest/v1/landing_visit_events';
  const apiKey='sb_publishable_Zlgeqn4PhdY11rZPD6i8-w_T42hrmgN';
  let attempted=false;
  function record(){
    if(attempted||document.visibilityState==='hidden'||document.visibilityState==='prerender')return;
    attempted=true;
    const stamp=Date.now().toString();
    try{
      const last=Number(sessionStorage.getItem(key)||0);
      if(Date.now()-last<windowMs)return;
      sessionStorage.setItem(key,stamp);
    }catch(_){/* if storage is blocked, each visible page load counts once */}
    const reset=()=>{try{if(sessionStorage.getItem(key)===stamp)sessionStorage.removeItem(key)}catch(_){}};
    try{
      fetch(endpoint,{method:'POST',headers:{apikey:apiKey,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({kind}),credentials:'omit',keepalive:true,referrerPolicy:'no-referrer'})
        .then(r=>{if(!r.ok)reset()}).catch(reset);
    }catch(_){reset()}
  }
  record();
  document.addEventListener('visibilitychange',record,{passive:true});
})();
