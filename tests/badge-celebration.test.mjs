import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

function setup(){
  const state=new Map();
  const localStorage={
    getItem(key){return state.has(key)?state.get(key):null;},
    setItem(key,value){state.set(key,String(value));},
    removeItem(key){state.delete(key);}
  };
  const context=vm.createContext({
    localStorage,
    sessionStorage:localStorage,
    console,
    document:{write(){},addEventListener(){},body:{classList:{toggle(){}}}},
    window:{location:{},addEventListener(){}}
  });
  vm.runInContext(readFileSync('js/common.js','utf8'),context);
  return {
    localStorage,
    context,
    next:vm.runInContext('getBadgeToCelebrate',context),
    acknowledge:vm.runInContext('recordBadgeCelebration',context),
    milestones:vm.runInContext('BADGE_MILESTONES',context),
    translate:vm.runInContext('t',context)
  };
}

test('milestones are inherited from the approved wall; no popup below ten classes',()=>{
  const {next,milestones}=setup();
  assert.deepEqual(Array.from(milestones,m=>m.threshold),[10,30,50,100,150,200]);
  assert.equal(next('student-a',0),null);
  assert.equal(next('student-a',9),null);
  assert.equal(next(null,100),null);
  assert.equal(next('student-a',10).threshold,10);
});

test('each new milestone is celebrated once for the same student in the browser',()=>{
  const {next,acknowledge}=setup();
  assert.equal(next('student-a',10).threshold,10);
  acknowledge('student-a',10);
  assert.equal(next('student-a',10),null);
  assert.equal(next('student-a',29),null);
  assert.equal(next('student-a',30).threshold,30);
  acknowledge('student-a',30);
  assert.equal(next('student-a',30),null);
  assert.equal(next('student-a',50).threshold,50);
});

test('one student cannot consume another student’s celebration',()=>{
  const {next,acknowledge}=setup();
  acknowledge('student-a',50);
  assert.equal(next('student-a',50),null);
  assert.equal(next('student-b',50).threshold,50);
});

test('if multiple milestones are unlocked, show only the newest badge',()=>{
  const {next,acknowledge}=setup();
  assert.equal(next('student-a',102).threshold,100);
  acknowledge('student-a',100);
  assert.equal(next('student-a',149),null);
  assert.equal(next('student-a',151).threshold,150);
  assert.equal(next('student-a',205).threshold,200);
});

test('cannot acknowledge an undefined milestone or erase a higher milestone',()=>{
  const {next,acknowledge,localStorage}=setup();
  acknowledge('student-a',999);
  assert.equal(next('student-a',30).threshold,30);
  acknowledge('student-a',50);
  acknowledge('student-a',10);
  assert.equal(next('student-a',50),null);
  assert.equal(localStorage.getItem('dc_badge_celebrated_v1_student-a'),'50');
});

test('celebration copy is translated into Portuguese and English',()=>{
  const {translate,localStorage}=setup();
  assert.equal(translate('badge_celebration_kicker'),'NOVA CONQUISTA');
  assert.match(translate('badge_celebration_message'),/Cada aula/);
  localStorage.setItem('portal_lang','en');
  assert.equal(translate('badge_celebration_kicker'),'ACHIEVEMENT UNLOCKED');
  assert.match(translate('badge_celebration_message'),/Every lesson/);
});

test('Home includes an accessible modal, delays for onboarding, and never simulates real student milestones',()=>{
  const html=readFileSync('home.html','utf8');
  assert.match(html,/id="badge-celebration-modal" class="badge-celebration-overlay" hidden/);
  assert.match(html,/role="dialog" aria-modal="true"/);
  assert.match(html,/aria-labelledby="badge-celebration-title" aria-describedby="badge-celebration-message"/);
  assert.match(html,/function onBadgeCelebrationKeydown\(event\)/);
  assert.match(html,/event\.key === 'Escape'/);
  assert.match(html,/recordBadgeCelebration\(badgeCelebrationStudentId, activeBadgeCelebration\.threshold\)/);
  assert.match(html,/!badgeCelebrationIsPreview/);
  assert.match(html,/if \(document\.getElementById\('onboarding-modal'\)\?\.classList\.contains\('show'\)\) return;/);
  assert.match(html,/if \(pendingBadgeCelebration\) setTimeout\(maybeCelebrateBadge, 300\)/);
  assert.match(html,/if \(!window\.__dcTeacherTestMode\) return;/);
  assert.match(html,/isTestStudentProfile\(profile\)/);
  assert.match(html,/badge-celebration-image/);
});

test('celebration is readable on mobile, dark mode and with reduced motion',()=>{
  const css=readFileSync('style.css','utf8');
  assert.match(css,/\.badge-celebration-overlay\[hidden\]\{display:none!important;\}/);
  assert.match(css,/body\.dark-mode \.badge-celebration-panel/);
  assert.match(css,/@media\(max-width:480px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
