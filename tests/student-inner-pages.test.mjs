import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

function store(){
  const data=new Map();
  return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
}
function setup(script){
  const elements=new Map();
  const doc={
    addEventListener(){},write(){},querySelector(){return {scrollIntoView(){}};},
    getElementById(id){
      if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',addEventListener(){},classList:{add(){},remove(){}}});
      return elements.get(id);
    },
    body:{classList:{toggle(){}}}
  };
  const tab={opener:null,url:null,close(){},location:{replace(url){tab.url=url;}}};
  const ctx=vm.createContext({
    console,document:doc,localStorage:store(),sessionStorage:store(),alert(){},URLSearchParams,
    window:{innerWidth:1200,location:{href:'',search:'',reload(){}},open(){return tab;},addEventListener(){}},
    async requireSession(){return null;},
    sb:{storage:{from(){return {async createSignedUrl(){return {data:{signedUrl:'https://files.example/signed'},error:null};}}}}},
    STORAGE_BUCKET:'materials'
  });
  vm.runInContext(readFileSync('js/common.js','utf8'),ctx);
  if(script)vm.runInContext(readFileSync(script,'utf8'),ctx);
  return {ctx,elements,tab};
}

test('profile is second and Resources uses nested links without tabs',()=>{
  const {ctx}=setup();
  const nav=vm.runInContext('buildStudentTopNav',ctx)('recursos',true,{}, {resourceSection:'texto'});
  assert.ok(nav.indexOf('>Início<') < nav.indexOf('>Perfil<'));
  assert.ok(nav.indexOf('>Perfil<') < nav.indexOf('>Minhas aulas<'));
  assert.match(nav, /<details class="nav-resource-group" open>/);
  assert.match(nav, /recursos\.html\?s=vocab/);
  assert.match(nav, /recursos\.html\?s=texto" aria-current="page"/);
  assert.match(nav, /Expandindo seu vocabulário/);
  assert.match(nav, /Aprimorando a Escrita/);
  assert.doesNotMatch(nav, /recursos_texto/);
  ctx.localStorage.setItem('portal_lang','en');
  const en=vm.runInContext('buildStudentTopNav',ctx)('home',true,{});
  assert.match(en,/Expanding your vocabulary/);
  assert.match(en,/Improving Your Writing/);
});

test('every lesson displays its material tiles without selecting a lesson',()=>{
  const {ctx,elements}=setup('js/aluno.js');
  const payload=[
    "myProfile={id:'student-uid'};",
    "myLessons=[",
    "{id:'lesson-a',title:'Career Goals',topic:'Speaking',lesson_date:'2026-11-18',resources:[",
    "{id:'resource-1',type:'ppt',name:'Class Slides',file_path:'a.pptx',created_at:'2026-11-18T10:00:00Z'},",
    "{id:'resource-2',type:'rep',name:'Feedback',file_path:'a.pdf',created_at:'2026-11-18T11:00:00Z'},",
    "{id:'resource-3',type:'ex',name:'Exercises',file_path:'a.docx',created_at:'2026-11-18T12:00:00Z'}",
    "]},",
    "{id:'lesson-b',title:'Work Life Balance',topic:'Grammar',lesson_date:'2026-11-16',resources:[]}",
    "];currentResources=myLessons.flatMap(l=>l.resources);renderLessonsPage();"
  ].join('');
  vm.runInContext(payload,ctx);
  const html=elements.get('lessons-list-container').innerHTML;
  assert.match(html,/Career Goals/);
  assert.match(html,/Work Life Balance/);
  assert.match(html,/Slides/);
  assert.match(html,/Relatório de desempenho/);
  assert.match(html,/Exercício/);
  assert.match(html,/previewLessonResource\('resource-1'\)/);
  assert.match(html,/downloadLessonResourceById\('resource-1'\)/);
  assert.match(html,/Nenhum material nesta aula/);
  assert.doesNotMatch(html,/aula selecionada|renderLesson\(/i);
  vm.runInContext("onLessonSearchInput('Career')",ctx);
  const filtered=elements.get('lessons-list-container').innerHTML;
  assert.match(filtered,/Career Goals/);
  assert.doesNotMatch(filtered,/Work Life Balance/);
  assert.match(elements.get('main-content').innerHTML,/id="lesson-search-input"/);
});

test('preview creates a signed link and download delegates to the existing function',async()=>{
  const {ctx,tab}=setup('js/aluno.js');
  vm.runInContext("myProfile={id:'student-uid'};currentResources=[{id:'resource-1',name:'Slides',file_path:'a.pptx'}];logActivity=()=>{};",ctx);
  await vm.runInContext("previewLessonResource('resource-1')",ctx);
  assert.equal(tab.url,'https://files.example/signed');
  assert.match(readFileSync('js/aluno.js','utf8'),/downloadResource\(resource\.file_path\)/);
});

test('security is the last profile card; teacher test account remains protected',()=>{
  const {ctx,elements}=setup('js/perfil.js');
  vm.runInContext("myProfile={id:'student-uid',role:'student',full_name:'Ana',avatar_url:null,permanent_lesson_link:'https://example.com/',lesson_weekday:2,lesson_time:'19:00'};render()",ctx);
  const html=elements.get('main-content').innerHTML;
  assert.ok(html.indexOf('Informações pessoais') < html.indexOf('Informações da aula'));
  assert.ok(html.indexOf('Informações da aula') < html.indexOf('Segurança da conta'));
  assert.match(html,/id="new-pass-1"/);
  vm.runInContext("myProfile={id:'teacher-uid',role:'student',is_test_profile:true};render()",ctx);
  const testHtml=elements.get('main-content').innerHTML;
  assert.match(testHtml,/Voltar ao painel do professor/);
  assert.doesNotMatch(testHtml,/id="new-pass-1"/);
});

test('question form, answer history and material request fields remain available',()=>{
  const questions=setup('js/perguntaAoDaniel.js');
  vm.runInContext("myQuestions=[{id:'question-1',subject:'Present Perfect',question:'How?',answer:'Use have plus past participle.',created_at:'2026-11-19T12:00:00Z'}];renderNewQuestionForm();",questions.ctx);
  const qHtml=questions.elements.get('main-content').innerHTML;
  for (const id of ['q-subject','q-question','question-history-container'])assert.ok(qHtml.includes('id="'+id+'"'),id);
  assert.match(qHtml,/Present Perfect/);
  assert.match(qHtml,/Respondida/);
  const request=setup('js/enviarMaterial.js');
  vm.runInContext('loadMyRequests=async()=>{};render()',request.ctx);
  const html=request.elements.get('main-content').innerHTML;
  for(const id of ['req-date','req-file','req-link','req-notes','my-requests-list','req-submit-btn']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
});

test('Resources keeps vocabulary actions and exposes writing as submenu, not tab',async()=>{
  const {ctx,elements}=setup('js/recursos.js');
  vm.runInContext("renderNav()",ctx);
  const nav=elements.get('nav-container').innerHTML;
  assert.match(nav,/Expandindo seu vocabulário/);
  assert.match(nav,/recursos\.html\?s=texto/);
  assert.doesNotMatch(nav,/role-switch|tabline/);
  vm.runInContext("loadVocab=async()=>[{day_index:1,word_of_day:{term:'Breakthrough',definition:'Discovery',example:'A breakthrough'}}];",ctx);
  await vm.runInContext('showVocab()',ctx);
  const html=elements.get('main-content').innerHTML;
  assert.match(html,/Breakthrough/);
  assert.match(html,/markAsUsed\(1\)/);
  assert.doesNotMatch(html,/role-switch|tabline/);
});
