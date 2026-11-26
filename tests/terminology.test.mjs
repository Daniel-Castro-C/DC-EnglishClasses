import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const source = path => readFileSync(path,'utf8');
function context(){
  const storage = new Map();
  const ctx = vm.createContext({
    console, localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
    window:{addEventListener(){}}, document:{addEventListener(){},write(){},createElement(){return {};},head:{appendChild(){}}},
    async requireSession(){return null;}
  });
  vm.runInContext(source('js/common.js'),ctx);
  return ctx;
}
test('material categories share a single bilingual dictionary',()=>{
  const ctx=context();
  for(const [lang,labels] of Object.entries({
    pt:['Slides','PDF','Exercícios','Relatório de desempenho','Arquivo'],
    en:['Slides','PDF','Exercises','Performance report','File']
  })){
    vm.runInContext(`setLangLocal('${lang}')`,ctx);
    assert.deepEqual(Array.from(vm.runInContext("['ppt','pdf','ex','rep','invalid'].map(type=>materialTypeLabel(type))",ctx)),labels);
  }
  vm.runInContext(source('js/admin.js'),ctx);
  assert.equal(vm.runInContext('TYPE_LABELS.rep',ctx),'Relatório de desempenho');
  assert.match(vm.runInContext('resourceRowHtml(1)',ctx),/<option value="rep">Relatório de desempenho<\/option>/);
  assert.match(source('home.html'),/materialTypeLabel\(resource.type\)/);
  assert.match(source('js/aluno.js'),/materialTypeLabel\(r.type\)/);
});
test('legacy reports are normalized for display only, not for storage or other materials',()=>{
  const ctx=context();
  const resource={type:'rep',name:'Class 17 - Relatório de Performance',file_path:'storage/legacy-report.pdf'};
  const render=vm.runInContext('materialDisplayName',ctx);
  assert.equal(render(resource),'Class 17 - Relatório de desempenho');
  assert.equal(resource.name,'Class 17 - Relatório de Performance');
  assert.equal(resource.file_path,'storage/legacy-report.pdf');
  assert.equal(render({...resource,type:'pdf'}),resource.name);
  assert.equal(render({type:'rep',name:'Feedback for class 17'}),'Feedback for class 17');
});
test('vocabulary and chrome labels survive actual resource module loading',()=>{
  const ctx=context();
  const keys=['recursos_vocab','recursos_texto','word_use','word_not_use','word_of_day_title','area_aluno','painel_aluno','dashboard_grammar_title','dashboard_profile_short'];
  const labels=()=>JSON.stringify(keys.map(key=>vm.runInContext(`[I18N.pt.${key},I18N.en.${key}]`,ctx)));
  const before=labels();
  vm.runInContext(source('js/recursos-module.js'),ctx);
  assert.equal(labels(),before);
  assert.equal(vm.runInContext('I18N.pt.recursos_vocab',ctx),'Expandindo seu vocabulário');
  assert.equal(vm.runInContext('I18N.pt.area_aluno',ctx),'Portal do aluno');
  assert.equal(vm.runInContext('I18N.pt.painel_aluno',ctx),'Portal do aluno');
  assert.equal(vm.runInContext('I18N.pt.word_of_day_title',ctx),'Termo do dia');
});
test('all public and teacher report labels use the adopted term',()=>{
  for(const file of ['js/admin.js','js/admin-turmas-preview.js','landing/admin.html','landing/index.html','landing/visitor.html','landing/visitor-demo-client.js','landing/visitor-tour.js']){
    const content=source(file);
    assert.doesNotMatch(content,/relatórios? de performance/i,file);
  }
  for(const file of ['landing/generate-demo-pdfs.mjs','landing/visitor-demo-client.js','landing/visitor-tour.js']){
    assert.match(source(file),/Relatório de desempenho - Modo Demonstração\.pdf/,file);
  }
});
