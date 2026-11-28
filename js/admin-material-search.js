/* Shared material search: real administration and isolated calendar preview. */
function crmMaterialNormalize(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();}
function crmMaterialFilter(rows,byId,query,grammarQuery=''){
 const normalized=crmMaterialNormalize(query),grammar=crmMaterialNormalize(grammarQuery);
 return rows.filter(l=>byId.has(l.student_id)&&(!normalized||crmMaterialNormalize(l.topic).includes(normalized))&&(!grammar||crmMaterialNormalize(l.grammar_content).includes(grammar))).sort((a,b)=>(b.lesson_date||'').localeCompare(a.lesson_date||'')||String(a.id).localeCompare(String(b.id)));
}
async function crmRenderMaterialSearch(root,profiles,studentId,loadRows,openLesson){
 const byId=new Map(profiles.filter(s=>!s.is_test_profile).map(s=>[s.id,s]));
 root.innerHTML='<div class="topline"><div><h1>Banco de aulas e materiais</h1><p class="sub">Consulte temas, conteúdo gramatical e materiais das aulas cadastradas.</p></div></div><section class="box crm-material-search"><form class="crm-search-fields"><label>Tópico da aula<input id="crm-material-query" placeholder="Ex.: Productivity, Future, Travel"></label><label>Conteúdo gramatical<input id="crm-grammar-query" placeholder="Ex.: Present Perfect"></label><label>Aluno para verificar repetição<select id="crm-material-student"><option value="">Todos os alunos</option>'+[...byId.values()].map(s=>'<option value="'+escapeHtml(s.id)+'">'+escapeHtml(s.full_name||s.email)+'</option>').join('')+'</select></label><button type="submit" class="btn-dark-sm">Buscar</button></form><div id="crm-material-results" aria-live="polite"><p>Consultando histórico...</p></div></section>';
 const query=root.querySelector('#crm-material-query'),grammar=root.querySelector('#crm-grammar-query'),target=root.querySelector('#crm-material-student'),results=root.querySelector('#crm-material-results');
 target.value=byId.has(studentId)?studentId:'';
 let all=[],page=0,loaded=false;const pageSize=25;
 function render(){
  if(!results.isConnected||!loaded)return;
  const rows=crmMaterialFilter(all,byId,query.value,grammar.value),own=rows.filter(l=>l.student_id===target.value),student=byId.get(target.value),pages=Math.max(1,Math.ceil(rows.length/pageSize));
  page=Math.min(page,pages-1);
  const summary='<div class="crm-search-result-summary"><strong>'+rows.length+' ocorrência(s) · '+new Set(rows.map(l=>l.student_id)).size+' aluno(s)</strong></div>';
  const warning=student?'<div class="box" style="padding:12px;margin:10px 0;border-left:4px solid '+(own.length?'var(--amber)':'var(--sage)')+'"><strong>'+escapeHtml(student.full_name||student.email)+'</strong> — '+(own.length?'Possui '+own.length+' aula(s) nesta lista. Confira as ocorrências destacadas.':'Nenhuma aula correspondente no histórico deste aluno.')+'</div>':'';
  const visible=rows.slice(page*pageSize,(page+1)*pageSize);
  results.innerHTML=summary+warning+(rows.length?'<div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>Tópico</th><th>Conteúdo gramatical</th><th>Materiais</th><th>Aluno</th><th>Data</th><th>Aula</th><th>Ações</th></tr></thead><tbody>'+visible.map((l,i)=>'<tr class="'+(l.student_id===target.value?'crm-repeat-match':'')+'"><td><strong>'+escapeHtml(l.topic||'Sem tópico')+'</strong></td><td>'+escapeHtml(l.grammar_content||'—')+'</td><td>'+escapeHtml((l.resources||[]).filter(r=>r.type!=='rep').map(r=>r.name).join(' · ')||'—')+'</td><td>'+escapeHtml(byId.get(l.student_id).full_name||byId.get(l.student_id).email)+'</td><td>'+escapeHtml(l.lesson_date?formatDate(l.lesson_date):'Sem data')+'</td><td>'+escapeHtml(l.title||'')+'</td><td><button type="button" class="btn-ghost" data-crm-open-lesson="'+i+'" '+(!l.lesson_date?'disabled':'')+'>Ver aula e materiais</button></td></tr>').join('')+'</tbody></table></div>':'<p class="small-note">Nenhuma aula correspondente encontrada.</p>')+(pages>1?'<div class="row"><button type="button" class="btn-ghost" data-crm-page="-1" '+(page===0?'disabled':'')+'>Anterior</button><span>Página '+(page+1)+' de '+pages+'</span><button type="button" class="btn-ghost" data-crm-page="1" '+(page===pages-1?'disabled':'')+'>Próxima</button></div>':'');
  results.querySelectorAll('[data-crm-open-lesson]').forEach(btn=>btn.addEventListener('click',()=>openLesson(visible[Number(btn.dataset.crmOpenLesson)])));
  results.querySelectorAll('[data-crm-page]').forEach(btn=>btn.addEventListener('click',()=>{page+=Number(btn.dataset.crmPage);render();}));
 }
 root.querySelector('form').addEventListener('submit',e=>{e.preventDefault();page=0;render();});
 target.addEventListener('change',()=>{page=0;render();});
 query.addEventListener('input',()=>{page=0;render();});
 grammar.addEventListener('input',()=>{page=0;render();});
 try{
  all=await loadRows();if(!results.isConnected)return;
  loaded=true;render();
 }catch(error){console.error(error);if(results.isConnected)results.innerHTML='<p role="alert">Não foi possível consultar o histórico completo. Tente novamente.</p>';}
}

// Copy teaching files into the normal, recipient-scoped upload draft. Never copy personal reports.
function crmReusableMaterials(lesson){return (lesson.resources||[]).filter(r=>['ppt','pdf','ex'].includes(r.type)&&r.file_path);}
async function crmCalendarLibrary(button){
 if(ccSaving)return;
 const key=ccContext()?.key,date=ccSelected,root=document.getElementById('cc-library-picker');
 if(!root)return;
 if(!root.hidden){root.hidden=true;return;}
 root.hidden=false;
 root.innerHTML='<p role="status">Carregando banco de aulas...</p>';
 const current=()=>root.isConnected&&ccContext()?.key===key&&ccSelected===date&&!ccSaving;
 try{
  const byId=new Map(students.filter(s=>!s.is_test_profile).map(s=>[s.id,s]));
  const rows=typeof demoLessons!=='undefined'?demoLessons.slice():await crmLoadLibraryRows();
  if(!current())return;
  root.innerHTML='<label>Pesquisar tema ou conteúdo gramatical<input type="search" placeholder="Ex.: Travel, Past Simple"></label><div class="cc-library-results"></div><p role="status" class="small-note"></p>';
  const input=root.querySelector('input'),results=root.querySelector('.cc-library-results'),feedback=root.querySelector('[role=status]');
  const render=()=>{
   const q=crmMaterialNormalize(input.value);
   const eligible=crmMaterialFilter(rows,byId,'').filter(l=>!q||crmMaterialNormalize(l.topic+' '+(l.grammar_content||'')).includes(q)).slice(0,20);
   results.innerHTML=eligible.map((l,i)=>'<div class="box"><strong>'+ccEsc(l.topic||'Sem tópico')+'</strong><p>'+ccEsc(l.grammar_content||'Sem conteúdo gramatical')+' · '+ccEsc(l.lesson_date||'')+'</p><button type="button" class="btn-ghost" data-topic="'+i+'">Usar tema e gramática</button>'+crmReusableMaterials(l).map((r,j)=>'<div class="row"><span>'+ccEsc(r.name)+'</span><button type="button" class="btn-ghost" data-copy="'+i+':'+j+'">Adicionar material</button></div>').join('')+'</div>').join('')||'<p>Nenhuma aula encontrada.</p>';
   results.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{
    if(!current())return;
    const l=eligible[Number(b.dataset.topic)];
    document.getElementById('cc-lesson-topic').value=l.topic||'';
    document.getElementById('cc-lesson-grammar').value=l.grammar_content||'';
    ccCaptureLesson();feedback.textContent='Tema e conteúdo gramatical adicionados ao rascunho.';
   });
   results.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{
    if(!current())return;
    const [i,j]=b.dataset.copy.split(':').map(Number),r=crmReusableMaterials(eligible[i])[j];
    b.disabled=true;feedback.textContent='Carregando material...';
    try{
     const {data,error}=await sb.storage.from('materiais').download(r.file_path);
     if(error)throw error;
     if(!current()||!b.isConnected)return;
     ccCaptureLesson();
     const entry=ccLessonMap(ccContext()).get(date);
     entry.files.push({file:new File([data],r.name,{type:data.type}),type:r.type,student:null});
     ccRenderLessonFiles();feedback.textContent='Material adicionado ao rascunho. Salve o calendário para confirmar.';
    }catch(error){if(current())feedback.textContent='Não foi possível copiar este material.';}
    finally{if(b.isConnected)b.disabled=false;}
   });
  };
  input.addEventListener('input',render);render();
 }catch(error){if(current())root.textContent='Não foi possível carregar o banco de aulas.';}
}
