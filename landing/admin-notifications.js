/* Authenticated, read-only notification indicators. Only timestamps are queried/stored. */
(function(){
  'use strict';
  const specs={
    testimonial:{route:'testimonials-admin',table:'landing_testimonials',filters:{status:'pending'}},
    visit:{route:'analytics',table:'landing_visit_events',filters:{kind:'landing'}},
    availability:{route:'disponibilidade',table:'landing_leads',filters:{source:'availability',status:'novo'}},
    waitlist:{route:'disponibilidade',table:'landing_leads',filters:{source:'landing',status:'novo'}}
  };
  const entries=Object.entries(specs);
  const prefix='dc-landing-notifications-v1:';
  // A timestamp is returned by the DB, never guessed from the time of a request.
  function newer(a,b){
    if(!a)return false;
    if(!b)return true;
    const delta=Date.parse(a)-Date.parse(b);
    return delta>0||(delta===0&&a>b);
  }
  function brazilDayStart(){
    const day=new Date(Date.now()-3*60*60*1000).toISOString().slice(0,10);
    return day+"T03:00:00.000Z";
  }
  function bind(db,isAdmin){
    let account='',seen={},timer=null,generation=0,request=0,visitRequest=0;
    const nodes=Object.fromEntries(entries.map(([key])=>[key,document.querySelector('[data-notification="'+key+'"]')]));
    const active=g=>account&&isAdmin()&&g===generation;
    const storageKey=()=>prefix+account;
    function read(){
      try{const raw=JSON.parse(localStorage.getItem(storageKey())||'{}');for(const [key] of entries){const stamp=raw?.[key];if(typeof stamp==='string'&&Number.isFinite(Date.parse(stamp))&&newer(stamp,seen[key]))seen[key]=stamp;}}catch(_){}
    }
    function save(){try{localStorage.setItem(storageKey(),JSON.stringify(seen));}catch(_){}}
    function setBadge(key,visible){if(nodes[key])nodes[key].hidden=!visible;}
    async function latest(key,spec){
      let q=db.from(spec.table).select('created_at');
      for(const [field,value] of Object.entries(spec.filters))q=q.eq(field,value);
      const {data,error}=await q.order('created_at',{ascending:false}).limit(1);
      if(error)throw error;
      return [key,data?.[0]?.created_at||null];
    }
    async function snapshot(list){
      return Promise.all(list.map(async ([key,spec])=>{try{return await latest(key,spec);}catch(_){return [key,undefined];}}));
    }
    async function refresh(){
      if(!account||!isAdmin())return;
      const g=generation,r=++request;
      read();
      const values=await snapshot(entries);
      if(!active(g)||r!==request)return;
      for(const [key,stamp] of values){
        if(stamp===undefined)continue; // temporary failure must not remove existing alerts
        const visible=stamp&&newer(stamp,seen[key]);
        setBadge(key,Boolean(visible));
      }
    }
    async function open(route,load,isCurrent){
      if(!account||!isAdmin())return;
      const g=generation,r=++visitRequest;
      // Snapshot BEFORE refreshing the real page, so arrivals during loading remain unread.
      const values=await snapshot(entries.filter(([,spec])=>spec.route===route));
      if(!active(g)||r!==visitRequest||!isCurrent())return;
      let success=false;
      try{success=await load();}catch(_){}
      if(!success||!active(g)||r!==visitRequest||!isCurrent())return;
      read();
      for(const [key,stamp] of values)if(stamp&&newer(stamp,seen[key]))seen[key]=stamp;
      save();
      await refresh();
    }
    function clear(){
      generation++;request++;visitRequest++;
      if(timer!==null)clearInterval(timer);timer=null;
      account='';seen={};entries.forEach(([key])=>setBadge(key,false));
    }
    function start(id){
      clear();if(!id||!isAdmin())return;
      account=id;read();if(!seen.visit){seen.visit=brazilDayStart();save();}refresh();
      timer=setInterval(()=>{if(document.visibilityState!=='hidden')refresh();},45000);
    }
    window.addEventListener('focus',refresh);
    window.addEventListener('storage',event=>{if(account&&(event.key===storageKey()||event.key===null))refresh();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
    return {start,clear,refresh,open};
  }
  window.LandingAdminNotifications={bind};
})();
