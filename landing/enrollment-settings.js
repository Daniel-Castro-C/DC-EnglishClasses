/* Shared enrollment settings. Only public display values are ever read by visitors. */
(function(){
  'use strict';
  const table='landing_enrollment_settings';
  const fields='mode,interest_message';
  const maxLength=2000;
  function validate(data){
    if(!data||!['interest','open'].includes(data.mode)||typeof data.interest_message!=='string')throw Error('Configuração inválida');
    const message=data.interest_message.trim();
    if(!message||message.length>maxLength)throw Error('Informe uma mensagem de até 2.000 caracteres.');
    return {mode:data.mode,interest_message:message};
  }
  async function load(db){
    if(!db)throw Error('Conexão indisponível');
    const {data,error}=await db.from(table).select(fields).eq('id',1).single();
    if(error)throw error;
    return validate(data);
  }
  async function save(db,settings){
    const record=validate(settings);
    const {data,error}=await db.from(table).update(record).eq('id',1).select(fields).single();
    if(error)throw error;
    return validate(data);
  }
  function applyPublic(settings,doc){
    const state=validate(settings),interest=state.mode==='interest';
    doc.documentElement.dataset.enrollmentMode=state.mode;
    doc.getElementById('interest-enrollment').hidden=!interest;
    doc.getElementById('open-enrollment').hidden=interest;
    doc.getElementById('interest-message').textContent=state.interest_message;
    const labels=interest?['Entrar na lista de interesse →','Indicar disponibilidade →','Tenho interesse','Tenho interesse']:['Encontrar meu horário →','Encontrar um horário →','Consultar horários','Consultar horários'];
    [...doc.querySelectorAll('a.btn[href="#horarios"]')].forEach((a,i)=>{if(labels[i])a.textContent=labels[i]});
    return interest;
  }
  function bindAdmin(db,isAdmin){
    const $=id=>document.getElementById(id);
    const form=$('enrollment-settings-form'),mode=$('enrollment-mode'),message=$('enrollment-message'),messageField=$('enrollment-message-field'),submit=$('enrollment-save'),retry=$('enrollment-retry'),status=$('enrollment-status'),current=$('enrollment-current');
    let request=0,stored=null;
    const label=value=>value==='open'?'Matrículas abertas':'Matrículas suspensas';
    function showMode(){messageField.hidden=mode.value!=='interest'}
    function enable(enabled){
      mode.disabled=!enabled;message.disabled=!enabled;submit.disabled=!enabled;
    }
    function render(settings){
      stored=settings;mode.value=settings.mode;message.value=settings.interest_message;
      current.textContent=label(settings.mode);showMode();enable(true);
    }
    function clear(){
      request++;stored=null;enable(false);current.textContent='—';mode.value='interest';message.value='';showMode();status.textContent='';retry.hidden=true;retry.disabled=true;
    }
    async function refresh(){
      if(!isAdmin())return;
      const id=++request;stored=null;enable(false);retry.hidden=true;retry.disabled=true;status.textContent='Carregando configuração…';
      try{
        const settings=await load(db);
        if(id!==request||!isAdmin())return;
        render(settings);status.textContent='';
      }catch(e){
        if(id!==request||!isAdmin())return;
        current.textContent='—';status.textContent='Não foi possível carregar a configuração. Tente novamente.';retry.hidden=false;retry.disabled=false;
      }
    }
    mode.addEventListener('change',showMode);
    retry.addEventListener('click',refresh);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!isAdmin()||!stored||submit.disabled)return;
      let record;
      try{record=validate({mode:mode.value,interest_message:mode.value==='interest'?message.value:stored.interest_message});}
      catch(e){status.textContent=e.message;return;}
      if(record.mode!==stored.mode&&!window.confirm('Alterar o modo público da landing page para '+label(record.mode)+'?'))return;
      const id=++request;enable(false);status.textContent='Salvando…';
      try{
        const saved=await save(db,record);
        if(id!==request||!isAdmin())return;
        render(saved);status.textContent='Configuração salva. Os visitantes verão a alteração ao abrir ou atualizar a página.';
      }catch(e){
        if(id!==request||!isAdmin())return;
        enable(false);status.textContent='Não foi possível confirmar a alteração. Atualize a configuração antes de tentar novamente.';retry.hidden=false;retry.disabled=false;
      }
    });
    clear();
    return {refresh,clear};
  }
  window.LandingEnrollment={load,save,applyPublic,bindAdmin};
})();
