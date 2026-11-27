import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('landing/admin-navigation.js','utf8');
const html=fs.readFileSync('landing/admin.html','utf8');
const routes=['inicio','enrollment-settings','agenda','disponibilidade','analytics','demo-files-panel','testimonials-admin','landing-photo-panel'];
function setup(){
  const pages=routes.map(adminPage=>({dataset:{adminPage},hidden:true}));
  const heading=()=>({hidden:true,textContent:'',focused:0,focus(){this.focused++}});
  const nodes={'admin-page-bar':heading(),'admin-page-title':heading(),'admin-home-title':heading()};
  const location={hash:''},events={};
  const window={addEventListener(name,fn){events[name]=fn},scrollTo(){}};
  const document={querySelectorAll:()=>pages,getElementById:id=>nodes[id]};
  vm.runInNewContext(source,{window,document,location});
  let admin=false;const nav=window.LandingAdminNavigation.bind(()=>admin);
  return {api:window.LandingAdminNavigation,pages,nodes,nav,location,login(){admin=true;nav.show()},logout(){admin=false;nav.clear()},go(hash){location.hash=hash;events.hashchange()},visible(){return pages.filter(p=>!p.hidden).map(p=>p.dataset.adminPage)}};
}
test('admin home shows only the module grid, and each route shows just its own page',()=>{
  const a=setup();
  a.go('#analytics');assert.deepEqual(a.visible(),[]);
  a.go('');a.login();assert.deepEqual(a.visible(),['inicio']);
  assert.equal(a.nodes['admin-page-bar'].hidden,true);
  for(const route of routes.slice(1)){
    a.go('#'+route);assert.deepEqual(a.visible(),[route]);
    assert.equal(a.nodes['admin-page-bar'].hidden,false);
    assert.ok(a.nodes['admin-page-title'].textContent);
  }
  a.go('#inicio');assert.deepEqual(a.visible(),['inicio']);
  assert.equal(a.nodes['admin-page-bar'].hidden,true);
});
test('direct links and browser history work after login and remain hidden on logout',()=>{
  const a=setup();a.location.hash='#demo-files-panel';a.login();
  assert.deepEqual(a.visible(),['demo-files-panel']);
  a.go('#weekly-items');assert.deepEqual(a.visible(),['agenda']);
  a.go('#lead-items');assert.deepEqual(a.visible(),['disponibilidade']);
  for(const hash of ['#not-a-route','#__proto__','#constructor','']){a.go(hash);assert.deepEqual(a.visible(),['inicio']);}
  a.go('#enrollment-settings');a.logout();assert.deepEqual(a.visible(),[]);
  a.go('#analytics');assert.deepEqual(a.visible(),[]);
  a.login();assert.deepEqual(a.visible(),['analytics']);
});
test('all home shortcuts and existing functionality remain reachable with unique element IDs',()=>{
  for(const route of routes){
    assert.match(html,new RegExp('data-admin-page="'+route+'" hidden'));
    if(route!=='inicio')assert.match(html,new RegExp('class="admin-module-link" href="#'+route+'"'));
  }
  const markup=html.split('</main>')[0];
  const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const id of ['enrollment-settings-form','analytics-chart','analytics-exclude-browser','weekly-form','exception-form','weekly-items','exception-items','lead-items','demo-file-slots','testimonials-admin-list','landing-photo-form'])assert.ok(ids.includes(id),id);
  const agenda=markup.slice(markup.indexOf('id="agenda"'),markup.indexOf('id="disponibilidade"'));
  for(const id of ['weekly-form','exception-form','weekly-items','exception-items'])assert.match(agenda,new RegExp('id="'+id+'"'));
  assert.match(html,/navigation\?\.show\(\)/);assert.match(html,/navigation\?\.clear\(\)/);
  assert.match(html,/class="admin-back"/);
});
