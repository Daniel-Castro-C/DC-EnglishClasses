/* Teacher-controlled annual preview and release. No writes until explicit confirmation. */
function crmRetrospectivePanel(student){
 if(!student||student.is_test_profile)return '';
 return '<section class="box"><h3>Retrospectiva anual</h3><p class="small-note">Gere uma prévia dos dados do ano. Só será exibida ao aluno após publicar.</p><div class="row"><label>Ano <input id="crm-review-year" type="number" min="2000" max="2100" step="1" value="'+adminToday().date.slice(0,4)+'"></label><button type="button" class="btn-ghost" onclick="crmLoadRetrospective()">Ver prévia</button></div><div id="crm-review-panel" aria-live="polite"></div></section>';
}
let crmReviewRequest=0;
async function crmLoadRetrospective(){
 const student=currentStudent,el=document.getElementById('crm-review-panel'),year=Number(document.getElementById('crm-review-year')?.value),request=++crmReviewRequest;
 if(!student||student.is_test_profile||!el||!Number.isInteger(year)||year<2000||year>2100)return;
 el.textContent='Carregando prévia...';
 try{
  const [preview,existing]=await Promise.all([sb.rpc('admin_retrospective_stats',{p_student:student.id,p_year:year}),sb.from('student_retrospectives').select('published,updated_at').eq('student_id',student.id).eq('year',year).maybeSingle()]);
  if(!el.isConnected||currentStudent?.id!==student.id||request!==crmReviewRequest)return;
  if(preview.error||existing.error||!preview.data)throw preview.error||existing.error||new Error('Prévia indisponível');
  const published=existing.data?.published===true;
  el.innerHTML='<p class="small-note">'+(published?'Publicada para este aluno.':'Não publicada.')+'</p>'+StudentJourney.render(preview.data,'pt',year)+'<div class="row"><button type="button" class="btn-dark-sm" data-review-year="'+year+'" onclick="crmPublishRetrospective(this,true)">'+(published?'Atualizar publicação':'Publicar para o aluno')+'</button>'+(published?'<button type="button" class="btn-ghost" data-review-year="'+year+'" onclick="crmPublishRetrospective(this,false)">Retirar publicação</button>':'')+'</div><p id="crm-review-message" role="status"></p>';
 }catch(_){if(el.isConnected&&request===crmReviewRequest)el.textContent='Não foi possível consultar a retrospectiva.';}
}
async function crmPublishRetrospective(button,publish){
 const student=currentStudent,year=Number(button.dataset.reviewYear),msg=document.getElementById('crm-review-message');
 if(!student||student.is_test_profile||button.disabled||!Number.isInteger(year)||!confirm((publish?'Publicar':'Retirar')+' a retrospectiva de '+year+' para este aluno?'))return;
 button.disabled=true;
 try{
  const {error}=await sb.rpc('admin_publish_retrospective',{p_student:student.id,p_year:year,p_publish:publish});
  if(error)throw error;
  if(currentStudent?.id!==student.id||!msg?.isConnected)return;
  document.getElementById('crm-review-year').value=year;await crmLoadRetrospective();
 }catch(_){if(msg?.isConnected)msg.textContent='Não foi possível alterar a publicação.';}
 finally{button.disabled=false;}
}
