/* Admin-only renderer; the database enforces admin authorization independently. */
window.createLandingAnalytics = function(db,isAdmin){
  const $=id=>document.getElementById(id);
  const format=n=>Number(n).toLocaleString('pt-BR');
  const date=d=>String(d).split('-').reverse().slice(0,2).join('/');
  let request=0;
  const internalKey='dc-analytics-exclude-browser';
  const exclusion=$('analytics-exclude-browser'),exclusionStatus=$('analytics-exclude-status');
  function syncExclusion(){
    if(!isAdmin()){exclusion.disabled=true;exclusion.checked=false;exclusionStatus.textContent='';return;}
    try{
      exclusion.checked=localStorage.getItem(internalKey)==='1';
      exclusion.disabled=false;
      exclusionStatus.textContent=exclusion.checked?'Ativo: suas visitas neste navegador não serão contabilizadas.':'Inativo: visitas neste navegador são contabilizadas normalmente.';
    }catch(_){
      exclusion.checked=false;exclusion.disabled=true;
      exclusionStatus.textContent='O armazenamento local está indisponível. A contagem não será realizada neste navegador enquanto permanecer bloqueado.';
    }
  }
  exclusion.addEventListener('change',()=>{
    if(!isAdmin()){syncExclusion();return;}
    try{
      if(exclusion.checked)localStorage.setItem(internalKey,'1');
      else localStorage.removeItem(internalKey);
      syncExclusion();
    }catch(_){
      syncExclusion();
      exclusionStatus.textContent='Não foi possível salvar a preferência. Verifique as configurações de armazenamento do navegador.';
    }
  });
  window.addEventListener('storage',event=>{if(event.key===internalKey||event.key===null)syncExclusion()});
  syncExclusion();
  function clear(){
    syncExclusion();
    request++;$('analytics-refresh').disabled=false;
    ['analytics-visits','analytics-portal','analytics-forms','analytics-rate'].forEach(id=>$(id).textContent='—');
    $('analytics-chart').replaceChildren();
    $('analytics-message').textContent='Selecione um período após entrar.';
  }
  const element=(tag,attrs={},value)=>{
    const e=document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [key,val] of Object.entries(attrs))e.setAttribute(key,String(val));
    if(value!==undefined)e.textContent=value;
    return e;
  };
  function chart(rows){
    const node=$('analytics-chart');node.replaceChildren();
    if(!rows.length)return;
    const max=Math.max(4,...rows.flatMap(r=>[Number(r.landing_visits),Number(r.portal_visits)]));
    const ceiling=Math.ceil(max/4)*4, width=760,height=230,left=46,right=18,top=16,bottom=36;
    const x=i=>left+(rows.length===1?(width-left-right)/2:i*(width-left-right)/(rows.length-1));
    const y=n=>height-bottom-Number(n)/ceiling*(height-top-bottom);
    const svg=element('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':'Visitas e acessos ao portal por dia'});
    const title=element('title',{},'Evolução diária de visitas');svg.append(title);
    for(let i=0;i<=4;i++){
      const n=i*ceiling/4;svg.append(element('line',{x1:left,x2:width-right,y1:y(n),y2:y(n),stroke:'#DDE7E1','stroke-width':1}));
      svg.append(element('text',{x:left-9,y:y(n)+4,'text-anchor':'end',fill:'#5D6F66','font-size':11},format(n)));
    }
    const step=Math.max(1,Math.ceil(rows.length/7));
    rows.forEach((r,i)=>{if(i%step===0||i===rows.length-1)svg.append(element('text',{x:x(i),y:height-12,'text-anchor':'middle',fill:'#5D6F66','font-size':11},date(r.day)))});
    for(const [field,color,label] of [['landing_visits','#1E3D2F','Landing page'],['portal_visits','#B08D51','Portal visitante']]){
      const data=rows.map((r,i)=>x(i)+','+y(r[field])).join(' ');
      svg.append(element('polyline',{points:data,fill:'none',stroke:color,'stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'}));
      rows.forEach((r,i)=>{const dot=element('circle',{cx:x(i),cy:y(r[field]),r:rows.length>30?2:3,fill:color});dot.append(element('title',{},date(r.day)+' · '+label+': '+format(r[field])));svg.append(dot)});
    }
    node.append(svg);
  }
  async function refresh(){
    if(!isAdmin())return;
    syncExclusion();
    const current=++request;const days=Number($('analytics-period').value);
    $('analytics-refresh').disabled=true;$('analytics-message').textContent='Carregando indicadores…';
    try{
      const {data,error}=await db.rpc('landing_analytics_daily',{p_days:days});
      if(current!==request||!isAdmin())return;
      if(error)throw error;
      const rows=data||[];
      const totals=rows.reduce((a,r)=>({visits:a.visits+Number(r.landing_visits),portal:a.portal+Number(r.portal_visits),forms:a.forms+Number(r.forms)}),{visits:0,portal:0,forms:0});
      $('analytics-visits').textContent=format(totals.visits);
      $('analytics-portal').textContent=format(totals.portal);
      $('analytics-forms').textContent=format(totals.forms);
      $('analytics-rate').textContent=totals.visits?(totals.forms/totals.visits*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—';
      $('analytics-message').textContent=rows.length?'Histórico iniciado em '+new Date(rows[0].tracking_start).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · '+date(rows[0].day)+' a '+date(rows.at(-1).day)+' (horário de Brasília).':'Ainda não há histórico de visitas.';
      chart(rows);
      return true;
    }catch(e){if(current===request&&isAdmin()){$('analytics-message').textContent='Não foi possível carregar os indicadores. Tente atualizar.';$('analytics-chart').replaceChildren();['analytics-visits','analytics-portal','analytics-forms','analytics-rate'].forEach(id=>$(id).textContent='—')}}
    finally{if(current===request)$('analytics-refresh').disabled=false}
  }
  $('analytics-period').addEventListener('change',refresh);$('analytics-refresh').addEventListener('click',refresh);
  return {refresh,clear};
};
