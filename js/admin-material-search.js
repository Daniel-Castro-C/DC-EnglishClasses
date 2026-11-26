/* Shared material search: real administration and isolated calendar preview. */
function crmMaterialNormalize(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();}
function crmMaterialFilter(rows,byId,query){
 const normalized=crmMaterialNormalize(query);
 return rows.filter(l=>byId.has(l.student_id)&&(!normalized||crmMaterialNormalize(l.topic).includes(normalized))).sort((a,b)=>(b.lesson_date||'').localeCompare(a.lesson_date||'')||String(a.id).localeCompare(String(b.id)));
}
async function crmRenderMaterialSearch(root,profiles,studentId,loadRows,openLesson){
 const byId=new Map(profiles.filter(s=>!s.is_test_profile).map(s=>[s.id,s]));
 root.innerHTML='<div class="topline"><div><h1>Buscador de materiais</h1><p class="sub">Consulte os temas de todas as aulas cadastradas e abra seus materiais.</p></div></div><section class="box crm-material-search"><form class="crm-search-fields"><label>Tópico da aula<input id="crm-material-query" placeholder="Ex.: Productivity, Future, Travel"></label><label>Aluno para verificar repetição<select id="crm-material-student"><option value="">Todos os alunos</option>'+[...byId.values()].map(s=>'<option value="'+escapeHtml(s.id)+'">'+escapeHtml(s.full_name||s.email)+'</option>').join('')+'</select></label><button type="submit" class="btn-dark-sm">Buscar</button></form><div id="crm-material-results" aria-live="polite"><p>Consultando histórico...</p></div></section>';
 const query=root.querySelector('#crm-material-query'),target=root.querySelector('#crm-material-student'),results=root.querySelector('#crm-material-results');
 target.value=byId.has(studentId)?studentId:'';
 let all=[],page=0,loaded=false;const pageSize=25;
 function render(){
  if(!results.isConnected||!loaded)return;
  const rows=crmMaterialFilter(all,byId,query.value),own=rows.filter(l=>l.student_id===target.value),student=byId.get(target.value),pages=Math.max(1,Math.ceil(rows.length/pageSize));
  page=Math.min(page,pages-1);
  const summary='<div class="crm-search-result-summary"><strong>'+rows.length+' ocorrência(s) · '+new Set(rows.map(l=>l.student_id)).size+' aluno(s)</strong></div>';
  const warning=student?'<div class="box" style="padding:12px;margin:10px 0;border-left:4px solid '+(own.length?'var(--amber)':'var(--sage)')+'"><strong>'+escapeHtml(student.full_name||student.email)+'</strong> — '+(own.length?'Possui '+own.length+' aula(s) nesta lista. Confira as ocorrências destacadas.':'Nenhuma aula correspondente no histórico deste aluno.')+'</div>':'';
  const visible=rows.slice(page*pageSize,(page+1)*pageSize);
  results.innerHTML=summary+warning+(rows.length?'<div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>Tópico</th><th>Aluno</th><th>Data</th><th>Aula</th><th>Ações</th></tr></thead><tbody>'+visible.map((l,i)=>'<tr class="'+(l.student_id===target.value?'crm-repeat-match':'')+'"><td><strong>'+escapeHtml(l.topic||'Sem tópico')+'</strong></td><td>'+escapeHtml(byId.get(l.student_id).full_name||byId.get(l.student_id).email)+'</td><td>'+escapeHtml(l.lesson_date?formatDate(l.lesson_date):'Sem data')+'</td><td>'+escapeHtml(l.title||'')+'</td><td><button type="button" class="btn-ghost" data-crm-open-lesson="'+i+'" '+(!l.lesson_date?'disabled':'')+'>Ver aula e materiais</button></td></tr>').join('')+'</tbody></table></div>':'<p class="small-note">Nenhum tópico correspondente encontrado.</p>')+(pages>1?'<div class="row"><button type="button" class="btn-ghost" data-crm-page="-1" '+(page===0?'disabled':'')+'>Anterior</button><span>Página '+(page+1)+' de '+pages+'</span><button type="button" class="btn-ghost" data-crm-page="1" '+(page===pages-1?'disabled':'')+'>Próxima</button></div>':'');
  results.querySelectorAll('[data-crm-open-lesson]').forEach(btn=>btn.addEventListener('click',()=>openLesson(visible[Number(btn.dataset.crmOpenLesson)])));
  results.querySelectorAll('[data-crm-page]').forEach(btn=>btn.addEventListener('click',()=>{page+=Number(btn.dataset.crmPage);render();}));
 }
 root.querySelector('form').addEventListener('submit',e=>{e.preventDefault();page=0;render();});
 target.addEventListener('change',()=>{page=0;render();});
 query.addEventListener('input',()=>{page=0;render();});
 try{
  all=await loadRows();if(!results.isConnected)return;
  loaded=true;render();
 }catch(error){console.error(error);if(results.isConnected)results.innerHTML='<p role="alert">Não foi possível consultar o histórico completo. Tente novamente.</p>';}
}
