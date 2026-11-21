import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const html=readFileSync('landing/index.html','utf8');
const helperStart=html.indexOf('function slotInterval(start){');
const helperEnd=html.indexOf('function renderSchedule(){',helperStart);
const helperCode=helperStart<0||helperEnd<0?'':html.slice(helperStart,helperEnd);
const ctx=vm.createContext({});
vm.runInContext("const p=n=>String(n).padStart(2,'0');"+helperCode,ctx);
const interval=vm.runInContext('slotInterval',ctx);

test('both plans explain the 50 minute duration directly after weekly frequency',()=>{
  assert.match(html,/<b>1 aula por semana<\/b><p class="plan-duration">Duração de cada aula: <strong>50 minutos<\/strong><\/p>/);
  assert.match(html,/<b>2 aulas por semana<\/b><p class="plan-duration">Duração de cada aula: <strong>50 minutos<\/strong><\/p>/);
  assert.equal((html.match(/class="plan-duration"/g)||[]).length,2);
});

test('available times correctly display a 50 minute end time, including hour changes',()=>{
  assert.equal(interval('18:00'),'18:00-18:50');
  assert.equal(interval('18:20'),'18:20-19:10');
  assert.equal(interval('23:30'),'23:30-00:20');
  assert.match(html,/Cada aula tem 50 minutos/);
  assert.match(html,/Aulas de 50 min · Brasília/);
  assert.match(html,/slotInterval\(t\)\+'<\/button>'/);
});

test('selection keys preserve the start time for schedule availability and WhatsApp',()=>{
  assert.match(html,/const key=day\+'\|'\+t;all\.push\(key\)/);
  assert.match(html,/const \[d,t\]=k\.split\('\|'\);return days\[Number\(d\)\]\+' às '\+slotInterval\(t\)/);
});

test('waitlist CTA is directly below its question and retains its action',()=>{
  assert.match(html,/<div class="waitlist-cta"><p>Não encontrou um horário compatível\?<\/p><button class="btn outline" data-action="waitlist">Entrar na lista de espera →<\/button><\/div>/);
  assert.match(html,/\.waitlist-cta\{display:flex;flex-direction:column/);
  assert.match(html,/data-action="waitlist"/);
});
