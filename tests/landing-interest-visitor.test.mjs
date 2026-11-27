import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {brandStyles,brandColors} from '../landing/visitor-brand.mjs';
const root=process.cwd();
const real=fs.readFileSync('style.css','utf8');
test('visitor palette preserves semantic colors and replaces original brand palette',()=>{
 assert.equal(brandColors('#16213E #B5432F #25D366'),'#1E3D2F #B5432F #25D366');
 assert.equal(brandColors('#EAF2FA'),'#F8F9F9');
 assert.match(brandStyles("font-family:'IBM Plex Sans';"),/Manrope/);
});
test('building landing embeds shared form and styles only visitor portal',()=>{
 execFileSync(process.execPath,['landing/build.mjs'],{cwd:root});
 const index=fs.readFileSync('landing/dist/index.html','utf8');
 const standalone=fs.readFileSync('landing/dist/disponibilidade.html','utf8');
 assert.match(index,/data-enrollment-mode="interest"/);
 assert.match(index,/id="availability-form" data-source="landing"/);
 assert.match(index,/id="open-enrollment" hidden/);
 assert.match(index,/if\(!interestMode\)loadSchedule\(\)/);
 assert.match(index,/<script src="availability.js"><\/script>/);
 assert.match(standalone,/id="availability-form"/);
 assert.doesNotMatch(standalone,/data-source="landing"/);
 for(const page of ['home','aluno','perfil','enviar-material','pergunte-ao-daniel','guias-gramatica','recursos']){
   const html=fs.readFileSync('landing/dist/visit/'+page+'.html','utf8');
   assert.match(html,/data-brand-surface="visitor"/);
   assert.match(html,/logo-reversa.svg/);
   assert.match(html,/visitor-tour.js/);
   assert.doesNotMatch(html,/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/);
 }
 const css=fs.readFileSync('landing/dist/visit/style.css','utf8');
 assert.match(css,/--ink:#1E3D2F/);
 assert.match(css,/--paper:#F8F9F9/);
 assert.match(css,/DM Serif Display/);
 assert.match(css,/body\.dark-mode/);
 assert.match(fs.readFileSync('landing/dist/visit/js/supabaseClient.js','utf8'),/window\.__dcGuestDemo=true/);
 assert.equal(fs.readFileSync('style.css','utf8'),real);
});
