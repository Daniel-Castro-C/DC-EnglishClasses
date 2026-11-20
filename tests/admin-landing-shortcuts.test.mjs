import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('js/admin.js','utf8');
const styles = readFileSync('style.css','utf8');

test('landing shortcuts appear on the administrator dashboard only', () => {
  const dashboard = source.slice(source.indexOf('async function renderHome()'), source.indexOf('async function renderRecentAdminActivity()'));
  assert.match(source, /profile\.role !== 'admin'/);
  assert.match(dashboard, /<nav class="admin-landing-actions" aria-label="Acessos à landing page">/);
  assert.match(dashboard, /Visitar a landing page/);
  assert.match(dashboard, /Acessar a área de administrador/);
});

test('shortcuts target the public production landing and its actual admin route', () => {
  const dashboard = source.slice(source.indexOf('async function renderHome()'), source.indexOf('async function renderRecentAdminActivity()'));
  for (const route of [
    'https://dc-english-classes-leads.vercel.app/',
    'https://dc-english-classes-leads.vercel.app/admin.html'
  ]) {
    assert.ok(dashboard.includes('href="' + route + '"'), route);
  }
  assert.equal((dashboard.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 2);
});

test('links have responsive styles and remain legible in dark mode', () => {
  assert.match(styles, /\.admin-landing-actions\{display:flex/);
  assert.match(styles, /body\.dark-mode \.admin-landing-public/);
  assert.match(styles, /body\.dark-mode \.admin-landing-manage/);
  assert.match(styles, /\.admin-landing-link:focus-visible/);
});
