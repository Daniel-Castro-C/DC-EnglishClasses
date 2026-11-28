/* Private CRM enhancements. The backend enforces the admin role independently. */
(function(){
 'use strict';
 const dayNames=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
 const sourceNames={unknown:'Histórico sem origem registrada',direct:'Direto / sem referência',instagram:'Instagram',youtube:'YouTube',whatsapp:'WhatsApp',google:'Google',facebook:'Facebook',linkedin:'LinkedIn',tiktok:'TikTok',referral:'Indicação / referência',other:'Outras fontes'};
 const kindNames={outbound:'Mensagem enviada',inbound:'Resposta recebida',note:'Anotação'};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dateLabel=d=>d.split('-').reverse().join('/');
 function matches(leads,weekly,overrides,base){
  const first=new Date(base+'T12:00:00Z'),available=new Map();
  for(let i=0;i<21;i++){
   const date=new Date(first.getTime()+i*86400000),day=(date.getUTCDay()+6)%7,iso=date.toISOString().slice(0,10);
   const over=overrides.filter(r=>r.slot_date===iso);
   const times=new Set([...weekly.filter(r=>r.active&&r.weekday===day&&(!r.starts_on||r.starts_on<=iso)).map(r=>r.start_time.slice(0,5)),...over.filter(r=>r.kind==='available').map(r=>r.start_time.slice(0,5))]);
   for(const t of times)if(!over.some(r=>r.kind==='blocked'&&r.start_time.slice(0,5)===t)){
    const k=day+'|'+t;if(!available.has(k))available.set(k,iso);
   }
  }
  return leads.filter(r=>['novo','contatado'].includes(r.status)).map(lead=>({lead,slots:[...new Set(lead.availability_slots||[])].filter(k=>available.has(k)).map(k=>({key:k,date:available.get(k)}))})).filter(r=>r.slots.length);
 }
 function bind(db,isAdmin,notice){
  const $=id=>document.getElementById(id);let leads=[],weekly=[],overrides=[],selected=null,session=0,historyRequest=0,followRequest=0,sourceRequest=0;
  const current=g=>isAdmin()&&g===session;
  const today=()=>new Date(Date.now()-3*3600000).toISOString().slice(0,10);
  const timestamp=d=>new Date(d).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  function renderMatches(){
   const rows=matches(leads,weekly,overrides,today());
   $('crm-matches').innerHTML=rows.length?rows.map(({lead,slots})=>'<div class="entry"><b>'+esc(lead.full_name)+'</b><p>'+slots.map(({key,date})=>{const [d,h]=key.split('|');return esc(dayNames[Number(d)]+' · '+h+' (próxima: '+dateLabel(date)+')')}).join(' · ')+'</p><button class="alt" data-crm-contact="'+esc(lead.id)+'">Ver contato</button></div>').join(''):'Nenhum horário compatível nas próximas três semanas. Respostas antigas sem horários detalhados não entram na correspondência.';
  }
  async function followups(){
   if(!isAdmin())return;
   const g=session,r=++followRequest;
   try{
    const {data,error}=await db.rpc('landing_lead_followups');if(!current(g)||r!==followRequest)return;if(error)throw error;
    const due=(data||[]).filter(x=>x.due).flatMap(x=>{const lead=leads.find(l=>l.id===x.lead_id);return lead?[{...x,lead}]:[];});
    $('crm-followups').innerHTML=due.length?due.map(x=>'<div class="entry"><b>'+esc(x.lead.full_name)+'</b><p>Sem resposta desde '+esc(timestamp(x.last_contact))+'</p><button class="alt" data-crm-contact="'+esc(x.lead.id)+'">Registrar retorno</button></div>').join(''):'Nenhum retorno pendente há 48 horas.';
    $('crm-followup-badge').hidden=!due.length;$('crm-followup-badge').textContent=due.length+' retorno(s) pendente(s)';
   }catch(_){if(current(g)&&r===followRequest)$('crm-followups').textContent='Não foi possível consultar os lembretes. Atualize a página.';}
  }
  function update(rows,slots,exceptions){if(!isAdmin())return;leads=rows;weekly=slots;overrides=exceptions;renderMatches();followups();if(selected&&!leads.some(x=>x.id===selected))close();}
  async function open(id){
   if(!isAdmin())return;const lead=leads.find(x=>x.id===id);if(!lead)return;
   selected=id;const g=session,r=++historyRequest;
   $('crm-contact-panel').hidden=false;$('crm-contact-name').textContent=lead.full_name;$('crm-contact-note').value='';$('crm-contact-kind').value='outbound';$('crm-contact-history').textContent='Carregando…';$('crm-contact-panel').scrollIntoView({block:'nearest'});
   const {data,error}=await db.from('landing_lead_contacts').select('id,kind,note,created_at').eq('lead_id',id).order('created_at',{ascending:false}).limit(100);
   if(!current(g)||r!==historyRequest||selected!==id)return;
   $('crm-contact-history').innerHTML=error?'Não foi possível consultar o histórico.':(data||[]).map(x=>'<div class="entry"><b>'+esc(kindNames[x.kind]||x.kind)+'</b><small>'+esc(timestamp(x.created_at))+'</small><p>'+esc(x.note)+'</p></div>').join('')||'Nenhum contato registrado.';
  }
  function close(){selected=null;historyRequest++;$('crm-contact-panel').hidden=true;$('crm-contact-note').value='';$('crm-contact-history').replaceChildren();}
  async function save(event){
   event.preventDefault();if(!isAdmin()||!selected)return;
   const id=selected,g=session,kind=$('crm-contact-kind').value,note=$('crm-contact-note').value.trim(),button=$('crm-contact-save');
   if(!Object.hasOwn(kindNames,kind)||note.length>2000||button.disabled)return;
   button.disabled=true;
   try{const {error}=await db.from('landing_lead_contacts').insert({lead_id:id,kind,note});if(error)throw error;if(!current(g))return;notice('Contato registrado.');if(selected===id)await open(id);await followups();}
   catch(_){if(current(g))notice('Não foi possível registrar o contato. Tente novamente.');}
   finally{button.disabled=false;}
  }
  async function sources(days){
   if(!isAdmin())return;
   const g=session,r=++sourceRequest;
   try{const {data,error}=await db.rpc('landing_analytics_sources',{p_days:days});if(!current(g)||r!==sourceRequest)return;if(error)throw error;
    $('analytics-sources').innerHTML=(data||[]).map(x=>'<div class="entry row"><span>'+esc(sourceNames[x.source]||sourceNames.other)+'</span><b>'+esc(Number(x.visits).toLocaleString('pt-BR'))+'</b></div>').join('')||'Nenhuma visita no período.';
   }catch(_){if(current(g)&&r===sourceRequest)$('analytics-sources').textContent='Não foi possível consultar a origem dos acessos.';}
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-crm-contact]');if(b)open(b.dataset.crmContact);});
  $('crm-contact-form').addEventListener('submit',save);$('crm-contact-close').addEventListener('click',close);
  window.addEventListener('focus',followups);
  setInterval(()=>{if(document.visibilityState==='visible')followups();},60000);
  return {update,sources,clear(){session++;followRequest++;sourceRequest++;leads=[];weekly=[];overrides=[];close();$('crm-followup-badge').hidden=true;['crm-followups','crm-matches','analytics-sources'].forEach(id=>$(id).replaceChildren());}};
 }
 window.LandingCRM={bind,matches};
})();
