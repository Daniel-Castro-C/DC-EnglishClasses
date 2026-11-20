// The public visitor portal has no Supabase client, authentication or data access.
// All examples are local and read-only. This module replaces supabaseClient.js
// only inside the independently generated visitor build.
(function(){
  'use strict';
  const visitorId='visitor-demo-local';
  const profile={id:visitorId,email:'visitante@demo.invalid',full_name:'Visitante',role:'student',avatar_url:null,preferred_language:'pt',preferred_theme:'light',permanent_lesson_link:null,lesson_weekday:null,lesson_time:null,has_seen_onboarding:true};
  const now=new Date();
  const lessons=Array.from({length:17},(_,i)=>{
    const d=new Date(now);d.setDate(d.getDate()-(16-i)*7);
    return {id:'demo-lesson-'+(i+1),student_id:visitorId,title:i===16?'Everyday Conversations':'Aula demonstrativa '+String(i+1).padStart(2,'0'),topic:i===16?'Prática de conversação':'Exemplo de aula',lesson_date:d.toISOString().slice(0,10),created_at:d.toISOString()};
  });
  const resources=[{id:'demo-guide',lesson_id:'demo-lesson-17',name:'Guia do Portal do Aluno',type:'pdf',description:'Material demonstrativo real do portal, disponível para visualização.',file_path:'guia-portal-do-aluno.pdf',created_at:new Date().toISOString()}];
  const word={term:'confidence',definition:'The feeling that you can do something successfully.',example:'I feel more confident when I practice English.'};
  const deny=()=>({data:null,error:{message:'Ação indisponível no modo visitante. Nenhum dado foi enviado.'}});
  const resolveQuery=(table,params,head,single)=>{
    let data=[];
    switch(table){
      case 'profiles':data=[profile];break;
      case 'lessons':data=lessons;break;
      case 'resources':data=resources;break;
      case 'word_of_day':data=[word];break;
      case 'app_settings':data=[{key:'grammar_guides_locked',value:'true'}];break;
      default:data=[];
    }
    for(const [name,value] of params){
      if(name==='student_id'&&table==='lessons')data=data.filter(x=>x.student_id===value);
      if(name==='lesson_id'&&table==='resources')data=data.filter(x=>x.lesson_id===value);
      if(name==='in_lesson_id'&&table==='resources')data=data.filter(x=>value.includes(x.lesson_id));
      if(name==='id'&&table==='profiles')data=data.filter(x=>x.id===value);
    }
    // Public fixtures are never persisted or fetched from the production database.
    return {data:head?null:single?(data[0]||null):data,error:null,count:data.length};
  };
  function tableQuery(table){
    const params=[];let head=false;let isWrite=false;
    const q={
      select(_fields,opts){if(opts&&opts.head)head=true;return this},
      eq(col,v){params.push([col,v]);return this},
      in(col,v){params.push(['in_'+col,v]);return this},
      gte(){return this},lte(){return this},gt(){return this},lt(){return this},
      neq(){return this},order(){return this},limit(){return this},range(){return this},
      or(){return this},not(){return this},is(){return this},contains(){return this},
      insert(){isWrite=true;return this},update(){isWrite=true;return this},upsert(){isWrite=true;return this},delete(){isWrite=true;return this},
      single(){return Promise.resolve(isWrite?deny():resolveQuery(table,params,head,true))},
      maybeSingle(){return Promise.resolve(isWrite?deny():resolveQuery(table,params,head,true))},
      then(onOk,onBad){return Promise.resolve(isWrite?deny():resolveQuery(table,params,head,false)).then(onOk,onBad)}
    };
    return q;
  }
  const fakeUser={id:visitorId};
  const sb={
    auth:{
      getSession:async()=>({data:{session:{user:fakeUser}},error:null}),
      getUser:async()=>({data:{user:fakeUser},error:null}),
      signOut:async()=>({error:null}),
      signInWithPassword:async()=>deny(),
      updateUser:async()=>deny()
    },
    from:tableQuery,
    storage:{
      from:()=>({
        createSignedUrl:async file=>file==='guia-portal-do-aluno.pdf'
          ?{data:{signedUrl:'/visit/guia-portal-do-aluno.pdf'},error:null}
          :{data:null,error:{message:'Somente o material demonstrativo está disponível.'}},
        upload:async()=>deny(),remove:async()=>deny(),download:async()=>deny()
      })
    }
  };
  window.__dcGuestDemo=true;
  window.__dcDemoReadOnlyNotice=function(){
    let el=document.getElementById('visitor-readonly-alert');
    if(el){el.hidden=false;window.clearTimeout(window.__dcDemoAlertTimer);window.__dcDemoAlertTimer=window.setTimeout(()=>{el.hidden=true},5500)}
  };
  window.addEventListener('click',e=>{
    const element=e.target.closest('button, input, a');
    if(!element)return;
    const action=(element.getAttribute('onclick')||'')+' '+(element.id||'');
    if(/submitRequest|submitQuestion|sendQuestion|saveProfile|changePassword|upload|submitText|removeQuestion|deleteQuestion|saveStatus|req-submit|ask-submit/i.test(action)){
      e.preventDefault();e.stopImmediatePropagation();window.__dcDemoReadOnlyNotice();
    }
  },true);
  window.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();window.__dcDemoReadOnlyNotice()},true);
  window.emailjs={init(){},send:async()=>{throw Error('Email desativado para visitantes')}};
  window.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('input[type=file]').forEach(el=>{el.disabled=true;el.title='Envio disponível apenas para alunos matriculados'});
  });
  window.sb=sb;
  window.requireSession=async()=>({user:fakeUser});
  window.getMyProfile=async()=>({...profile});
  window.signOutAndRedirect=async()=>{window.location.href='../'};
  window.STORAGE_BUCKET='materiais';
  window.AVATARS_BUCKET='avatars';
})();
const sb=window.sb,STORAGE_BUCKET='materiais',AVATARS_BUCKET='avatars';
async function requireSession(){return {user:{id:'visitor-demo-local'}}}
async function getMyProfile(){return {id:'visitor-demo-local',email:'visitante@demo.invalid',full_name:'Visitante',role:'student',avatar_url:null,preferred_language:'pt',preferred_theme:'light',permanent_lesson_link:null,has_seen_onboarding:true}}
async function signOutAndRedirect(){window.location.href='../'}
