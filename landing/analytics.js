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
  const internalKey='dc-analytics-exclude-browser';
  const allowed=new Set(['instagram','youtube','whatsapp','google','facebook','linkedin','tiktok','referral','direct']);
  function trafficSource(){
    const raw=new URLSearchParams(location.search||'').get('utm_source')?.trim().toLowerCase()||'';
    const aliases={ig:'instagram',yt:'youtube',indicacao:'referral',indicação:'referral',fb:'facebook'};
    if(raw){const key=Object.hasOwn(aliases,raw)?aliases[raw]:raw;return allowed.has(key)?key:'other';}
    let host='';try{host=new URL(document.referrer||'').hostname.toLowerCase();}catch(_){}
    if(!host||hosts.has(host))return 'direct';
    for(const [source,domains] of Object.entries({instagram:['instagram.com'],youtube:['youtube.com','youtu.be'],whatsapp:['whatsapp.com','wa.me'],google:['google.com','google.com.br'],facebook:['facebook.com','fb.com'],linkedin:['linkedin.com'],tiktok:['tiktok.com']}))
      if(domains.some(d=>host===d||host.endsWith('.'+d)))return source;
    return 'referral';
  }
  let attempted=false;
  function record(){
    if(attempted||document.visibilityState==='hidden'||document.visibilityState==='prerender')return;
    attempted=true;
    try{if(localStorage.getItem(internalKey)==='1')return;}catch(_){return;} // respect unavailable preference storage
    const stamp=Date.now().toString();
    try{
      const last=Number(sessionStorage.getItem(key)||0);
      if(Date.now()-last<windowMs)return;
      sessionStorage.setItem(key,stamp);
    }catch(_){/* if storage is blocked, each visible page load counts once */}
    const reset=()=>{try{if(sessionStorage.getItem(key)===stamp)sessionStorage.removeItem(key)}catch(_){}};
    try{
      fetch(endpoint,{method:'POST',headers:{apikey:apiKey,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(kind==='landing'?{kind,source:trafficSource()}:{kind}),credentials:'omit',keepalive:true,referrerPolicy:'no-referrer'})
        .then(r=>{if(!r.ok)reset()}).catch(reset);
    }catch(_){reset()}
  }
  record();
  document.addEventListener('visibilitychange',record,{passive:true});
})();
