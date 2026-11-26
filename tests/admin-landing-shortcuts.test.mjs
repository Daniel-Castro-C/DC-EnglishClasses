import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('js/admin.js','utf8');
const styles = readFileSync('style.css','utf8');

test('landing shortcuts appear only in the teacher administration navigation', () => {
  const nav = source.slice(source.indexOf('function renderNav()'), source.indexOf('function filterAdminStudentNav'));
  assert.match(source, /profile\.role !== 'admin'/);
  assert.ok(nav.includes("['landing','Landing page'"));
  assert.ok(nav.includes("['leads','Administração da landing page'"));
  const student = readFileSync('js/common.js','utf8');
  const studentNav = student.slice(student.indexOf('function buildStudentTopNav'),student.indexOf('async function getNotificationCounts'));
  assert.doesNotMatch(studentNav, /Administração da landing page/);
});

test('sidebar shortcuts retain their current public landing and administration destinations', () => {
  const nav = source.slice(source.indexOf('function renderNav()'), source.indexOf('function filterAdminStudentNav'));
  for (const route of [
    'https://dc-englishclasses.vercel.app/',
    'https://dc-englishclasses.vercel.app/admin.html'
  ]) {
    assert.ok(nav.includes("window.open('" + route + "','_blank','noopener')"), route);
  }
});

test('links have responsive styles and remain legible in dark mode', () => {
  assert.match(styles, /\.admin-landing-actions\{display:flex/);
  assert.match(styles, /body\.dark-mode \.admin-landing-public/);
  assert.match(styles, /body\.dark-mode \.admin-landing-manage/);
  assert.match(styles, /\.admin-landing-link:focus-visible/);
});
