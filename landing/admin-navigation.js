/* Hash-based pages preserve the original authenticated card DOM and deep links. */
(function(){
  'use strict';
  const titles={
    inicio:'Administração da landing page',
    'enrollment-settings':'Matrículas',
    agenda:'Agenda de horários',
    disponibilidade:'Leads e lista de interesse',
    analytics:'Estatísticas',
    'demo-files-panel':'Materiais do portal visitante',
    'testimonials-admin':'Depoimentos',
    'landing-photo-panel':'Foto da landing page'
  };
  const aliases={'home':'inicio','weekly-items':'agenda','exception-items':'agenda','weekly-form':'agenda','exception-form':'agenda','lead-items':'disponibilidade'};
  function resolve(hash){
    const key=String(hash||'').replace(/^#/,'');
    const route=Object.hasOwn(aliases,key)?aliases[key]:key;
    return Object.hasOwn(titles,route)?route:'inicio';
  }
  function bind(isAdmin,onNavigate=()=>{}){
    const pages=[...document.querySelectorAll('[data-admin-page]')];
    const bar=document.getElementById('admin-page-bar');
    const title=document.getElementById('admin-page-title');
    const homeHeading=document.getElementById('admin-home-title');
    let current=null;
    function clear(){
      current=null;pages.forEach(page=>page.hidden=true);bar.hidden=true;
    }
    function show(){
      if(!isAdmin()){clear();return;}
      const route=resolve(location.hash),change=current!==route;
      pages.forEach(page=>page.hidden=page.dataset.adminPage!==route);
      bar.hidden=route==='inicio';title.textContent=titles[route];
      current=route;
      if(change){
        window.scrollTo(0,0);
        (route==='inicio'?homeHeading:title).focus({preventScroll:true});
        onNavigate(route);
      }
    }
    window.addEventListener('hashchange',show);
    clear();
    return {show,clear,current:()=>current};
  }
  window.LandingAdminNavigation={bind,resolve};
})();
