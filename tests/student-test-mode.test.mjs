import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function setup(){
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const context = vm.createContext({
    localStorage, sessionStorage,
    console,
    alert() {},
    document: { addEventListener() {}, write() {}, body: { classList: { toggle() {} } } },
    window: { location: { href: '', reload() {} } },
    sb: { auth: { async getUser() { return { data: { user: { id: 'teacher-uid' } }, error: null }; } } },
    async getMyProfile(id) { return { id, role: 'admin', full_name: 'Professor' }; }
  });
  vm.runInContext(readFileSync('js/common.js', 'utf8'), context);
  return context;
}
const testAdmin = { id: 'teacher-uid', role: 'admin', full_name: 'Professor' };
const realStudent = { id: 'student-uid', role: 'student' };

test('student mode is never activated for a regular student', () => {
  const ctx = setup();
  ctx.sessionStorage.setItem('dc_teacher_student_test_id', 'student-uid');
  assert.equal(vm.runInContext('isTeacherStudentMode',ctx)(realStudent), false);
  assert.equal(vm.runInContext('canAccessStudentPortal',ctx)(realStudent), true);
});

test('an administrator cannot access student pages without explicitly entering test mode', () => {
  const ctx = setup();
  assert.equal(vm.runInContext('canAccessStudentPortal',ctx)(testAdmin), false);
  const view = vm.runInContext('studentPortalProfile',ctx)(testAdmin);
  assert.equal(view.role, 'admin');
});

test('test profile is a projection of the teacher UID, not a new Auth account', () => {
  const ctx = setup();
  ctx.sessionStorage.setItem('dc_teacher_student_test_id', 'teacher-uid');
  const profile = vm.runInContext('studentPortalProfile',ctx)(testAdmin);
  assert.equal(profile.id, 'teacher-uid');
  assert.equal(profile.role, 'student');
  assert.equal(profile.full_name, 'Perfil de teste');
  assert.equal(profile.email, 'teacherdaniel.cas@gmail.com');
  assert.equal(profile.is_test_profile, true);
  assert.equal(profile.has_seen_onboarding, true);
  assert.equal(testAdmin.role, 'admin');
  assert.match(vm.runInContext('buildStudentTopNav',ctx)('home', true, {}), /Voltar ao painel do professor/);
});

test('enter and leave preserve the teacher language/theme and do not end the login session', async () => {
  const ctx = setup();
  const enter = vm.runInContext('enterStudentTestMode',ctx);
  const leave = vm.runInContext('leaveStudentTestMode',ctx);
  ctx.localStorage.setItem('portal_lang','pt');
  ctx.localStorage.setItem('portal_theme','dark');
  await enter();
  assert.equal(ctx.window.location.href, 'home.html');
  assert.equal(ctx.sessionStorage.getItem('dc_teacher_student_test_id'), 'teacher-uid');
  ctx.localStorage.setItem('portal_lang', 'en');
  ctx.localStorage.setItem('portal_theme', 'light');
  leave();
  assert.equal(ctx.window.location.href, 'admin.html');
  assert.equal(ctx.localStorage.getItem('portal_lang'), 'pt');
  assert.equal(ctx.localStorage.getItem('portal_theme'), 'dark');
  assert.equal(ctx.sessionStorage.getItem('dc_teacher_student_test_id'), null);
});

test('no student-only action mutates teacher profile or delivers an unrelated email', () => {
  const admin = readFileSync('js/admin.js','utf8');
  const profile = readFileSync('js/perfil.js','utf8');
  const requests = readFileSync('js/enviarMaterial.js','utf8');
  const questions = readFileSync('js/perguntaAoDaniel.js','utf8');
  const resources = readFileSync('js/recursos.js','utf8');
  assert.match(admin, /if \(s\.is_test_profile\)/);
  assert.match(profile, /if \(isTestStudentProfile\(myProfile\)\)/);
  for(const source of [requests,questions,resources]){
    assert.match(source,/if \(isTestStudentProfile\(myProfile\)\)/);
  }
  assert.match(admin,/data-test-profile/);
  assert.match(admin,/TEACHER_TEST_EMAIL/);
  assert.match(admin,/\.broadcast-student-checkbox:not\(\[data-test-profile="true"\]\)/);
});
