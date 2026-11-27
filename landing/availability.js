(() => {
  const $ = id => document.getElementById(id);
  const days = ['Segunda','Terça','Quarta','Quinta','Sexta'];
  const schedule = $('schedule');
  const add = (tag, cls, text) => {
    const el = document.createElement(tag); el.className = cls; el.textContent = text; schedule.append(el); return el;
  };
  add('div','head','Hora');
  days.forEach(day=>add('div','head',day.slice(0,3)));
  for(let h=7; h<=21; h++){
    const time=String(h).padStart(2,'0')+':00';
    add('div','hour',time);
    days.forEach((day,i)=>{
      const label=add('label','slot','');
      const input=document.createElement('input'); input.type='checkbox'; input.value=i+'|'+time;
      input.setAttribute('aria-label',day+' às '+time+' até '+time.slice(0,2)+':50');
      const span=document.createElement('span'); span.textContent='+'; span.setAttribute('aria-hidden','true');
      input.addEventListener('change',()=>{span.textContent=input.checked?'✓':'+'});
      label.append(input,span);
    });
  }
  const selected=()=>Array.from(schedule.querySelectorAll('input:checked'),x=>x.value);
  schedule.addEventListener('change',()=>{$('count').textContent=selected().length+' horário(s) selecionado(s).'});
  const form=$('availability-form');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const btn=form.querySelector('button[type=submit]'), slots=selected(), name=$('name').value.trim();
    let phone=$('phone').value.replace(/\D/g,'');
    if(phone.length===10||phone.length===11)phone='55'+phone;
    const frequency=form.querySelector('input[name=frequency]:checked')?.value;
    const error=$('error'); error.textContent='';
    if(name.length<2||!/^55\d{10,11}$/.test(phone)||!slots.length||frequency===undefined||!$('consent').checked){
      error.textContent='Confira seu nome, WhatsApp com DDD, frequência e selecione pelo menos um horário.'; return;
    }
    const availableDays=days.filter((_,i)=>slots.some(s=>s.startsWith(i+'|')));
    const periods=new Set(slots.map(s=>{const h=Number(s.split('|')[1].slice(0,2));return h<12?'Manhã (7h–12h)':h<18?'Tarde (12h–18h)':'Noite (18h–22h)'}));
    btn.disabled=true;btn.textContent='Enviando…';
    try{
      const db=window.supabase.createClient('https://dgwbjgngewymzgedlzix.supabase.co','sb_publishable_Zlgeqn4PhdY11rZPD6i8-w_T42hrmgN',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      const {error:dbError}=await db.from('landing_leads').insert({full_name:name,phone,available_days:availableDays,period:periods.size===1?[...periods][0]:'Flexível',goal:$('notes').value.trim(),consent:true,source:'availability',frequency:Number(frequency),availability_slots:slots});
      if(dbError)throw dbError;
      form.hidden=true;$('success').hidden=false;$('success').focus();
    }catch(e){error.textContent='Não foi possível enviar sua disponibilidade. Tente novamente ou fale comigo pelo WhatsApp.'}
    finally{btn.disabled=false;btn.textContent='Enviar minha disponibilidade →'}
  });
})();
