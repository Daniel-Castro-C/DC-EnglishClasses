import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const css=readFileSync('style.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const admin=readFileSync('admin-crm.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const block=(source,selector)=>{
 const rules=[...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>(m[1].trim()===selector||m[1].trim().split(',').map(x=>x.trim()).includes(selector)));
 assert.ok(rules.length,selector);
 return Object.fromEntries(rules.flatMap(([, ,body])=>body.split(';').filter(d=>d.includes(':')).map(d=>{const i=d.indexOf(':');return [d.slice(0,i).trim(),d.slice(i+1).trim()]})));
};
const root=Object.fromEntries([...css.matchAll(/:root\s*\{([^{}]*)\}/g)].flatMap(m=>[...m[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(x=>[x[1],x[2]])));
const dark=block(css,'body.dark-mode');
const palette={...root,...dark,...block(admin,'body.admin-crm.dark-mode')};
const resolve=value=>value.replace(/var\((--[\w-]+)\)/g,(_,key)=>resolve(palette[key]));
const luminance=color=>{
 let hex=resolve(color).trim().replace(/^#/,'');
 if(hex.length===3)hex=[...hex].map(c=>c+c).join('');
 assert.match(hex,/^[0-9a-f]{6}$/i);
 const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
function contrast(a,b){const l=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (l[0]+.05)/(l[1]+.05);}
function check(label,fg,bg,min=4.5){const ratio=contrast(fg,bg);assert.ok(ratio>=min,label+': '+ratio.toFixed(2)+' < '+min);}
test('dark text, links, placeholders and status accents have WCAG AA normal-text contrast on portal surfaces',()=>{
 for(const bg of ['--paper','--paper-card','--sky-soft','--neutral-soft']){
  for(const fg of ['--text','--text-soft','--sky','--sage','--amber','--danger'])check(fg+' on '+bg,palette[fg],palette[bg]);
 }
 for(const [fg,bg] of [['--sage','--sage-soft'],['--amber','--amber-soft'],['--danger','--error-message-bg'],['--sage','--success-message-bg']])check(fg,palette[fg],palette[bg]);
 check('primary action','#fff',palette['--dark-action']);
 check('primary action hover','#fff',palette['--dark-action-hover']);
 for(const bg of ['--paper','--paper-card','--sky-soft'])check('control border on '+bg,palette['--control-line'],palette[bg],3);
 assert.equal(dark['color-scheme'],'dark');
});
test('monthly calendar and individual/group day states use dark surfaces and contrasting labels',()=>{
 const chip=block(admin,'body.admin-crm.dark-mode .crm-month-class');
 const time=block(admin,'body.admin-crm.dark-mode .crm-month-class time');
 const today=block(admin,'body.admin-crm.dark-mode .crm-month-day.is-today');
 const badge=block(admin,'body.admin-crm.dark-mode .crm-month-day.is-today .crm-month-day-number');
 check('student names',chip.color,chip.background);
 check('lesson time',time.color,chip.background);
 check('current day number',badge.color,badge.background);
 check('current day labels',palette['--text'],today.background);
 check('current day border',today['border-color'],today.background,3);
 const holiday=block(admin,'body.admin-crm.dark-mode .cc-month-grid .cc-day.cc-unavailable,body.admin-crm.dark-mode .cc-unavailable-note');
 check('holiday',holiday.color,holiday.background);
 check('holiday selected',holiday.color,block(admin,'body.admin-crm.dark-mode .cc-month-grid .cc-day.cc-unavailable.cc-selected').background);
 for(const selector of ['body.admin-crm.dark-mode .cc-day-status[data-status="done"]','body.admin-crm.dark-mode .cc-day-status[data-status="absent"]','body.admin-crm.dark-mode .cc-day-status[data-status="owed"],body.admin-crm.dark-mode .cc-day-status[data-status="teacher"]']){
  const rule=block(admin,selector);check(selector,rule.color,rule.background);
 }
});
test('student materials, study states, resource icons and celebration controls use readable colors',()=>{
 for(const selector of ['body.dark-mode .student-material-icon','body.dark-mode .student-material-icon.type-rep,body.dark-mode .student-material-icon.type-pdf','body.dark-mode .student-material-icon.type-ex','body.dark-mode .student-status.is-complete','body.dark-mode .student-status.is-pending','body.dark-mode .resource-icon.ic-ppt','body.dark-mode .resource-icon.ic-pdf','body.dark-mode .resource-icon.ic-ex','body.dark-mode .resource-icon.ic-rep','body.dark-mode .study-btn.active-good,body.dark-mode .status-pill.done','body.dark-mode .study-btn.active-warn,body.dark-mode .status-pill.pending','body.dark-mode .badge-celebration-done','body.dark-mode .pill.pending-count,body.dark-mode .sidebar .nav-badge','body.dark-mode .home-lesson-call.is-lesson-day .home-lesson-call-icon']){
  const rule=block(css,selector);check(selector,rule.color,rule.background);
 }
 const sp=block(css,'body.dark-mode .student-page');check('student accent',sp['--sp-accent'],sp['--sp-accent-soft']);
 check('student helper',palette['--text-soft'],sp['--sp-accent-soft']);
 check('student control border',palette['--control-line'],sp['--sp-accent-soft'],3);
});
test('login and recovery retain saved theme and avoid hardcoded light status backgrounds',()=>{
 for(const name of ['index.html','esqueci-senha.html','atualizar-senha.html']){
  const html=readFileSync(name,'utf8');assert.match(html,/localStorage\.getItem\('portal_theme'\)==='dark'/);assert.match(html,/color:var\(--link\)/);
  assert.doesNotMatch(html,/el\.style\.background = ok/);
 }
 for(const selector of ['body.dark-mode .form-error','body.dark-mode .form-error.is-success','body.dark-mode #login-screen .login-input-wrap input']){
  const rule=block(css,selector);check(selector,rule.color,rule.background);
 }
 assert.match(readFileSync('js/admin.js','utf8'),/var\(--neutral-soft\)/);
 assert.match(readFileSync('js/textos-module.js','utf8'),/class="pill pending-count"/);
 // The light palette remains unchanged.
 assert.equal(root['--sky-soft'],'#E4EFF9');assert.equal(root['--ink'],'#16213E');assert.equal(root['--paper-card'],'#FFFFFF');
});
test('isolated preview URLs support dark mode without accessing or changing saved preferences',()=>{
 for(const name of ['admin-home-calendar-preview.html','calendar-preview.html','home-lesson-preview.html','student-resources-preview.html']){
  const html=readFileSync(name,'utf8');
  assert.match(html,/new URLSearchParams\(location.search\).get\('theme'\)==='dark'/);
  assert.match(html,/classList.toggle\('dark-mode'\)/);
 }
});
