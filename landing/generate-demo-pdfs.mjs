// Generate only the fictional writing-correction example. Lesson slides and
// reports are supplied by the administrator through the public demo upload slots.
import fs from 'node:fs';
import path from 'node:path';
import {brandColors} from './visitor-brand.mjs';
const out=path.join(process.cwd(),'landing','dist','visit','demo');
fs.mkdirSync(out,{recursive:true});
const fstr=s=>String(s??'').replace(/[^\x20-\x7E\xA0-\xFF]/g,c=>({"’":"'","‘":"'","“":'"',"”":'"',"—":"-","–":"-","•":"-","✓":"OK","…":"..."}[c]||'?')).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const color=(hex)=>{const h=brandColors(hex).replace('#','');return [0,2,4].map(i=>(parseInt(h.slice(i,i+2),16)/255).toFixed(3)).join(' ')};
class PDF{
 constructor(w,h){this.w=w;this.h=h;this.pages=[];this.ops=[]}
 cmd(x){this.ops.push(x)}
 rect(x,y,w,h,c){this.cmd(color(c)+' rg '+x+' '+(this.h-y-h)+' '+w+' '+h+' re f')}
 line(x,y,x2,y2,c='#d3e1ed',stroke=1){this.cmd(color(c)+' RG '+stroke+' w '+x+' '+(this.h-y)+' m '+x2+' '+(this.h-y2)+' l S')}
 text(s,x,y,size=12,c='#203650',font='F1'){this.cmd('BT /'+font+' '+size+' Tf '+color(c)+' rg 1 0 0 1 '+x+' '+(this.h-y-size)+' Tm ('+fstr(s)+') Tj ET')}
 wrap(s,x,y,maxWidth,size=12,leading=1.43,c='#203650',font='F1'){const max=Math.floor(maxWidth/(size*.49));let line='',py=y;for(const word of String(s).split(/\s+/)){const next=line?line+' '+word:word;if(next.length>max&&line){this.text(line,x,py,size,c,font);py+=size*leading;line=word}else line=next}if(line)this.text(line,x,py,size,c,font);return py+size*leading}
 page(){if(this.ops.length)this.pages.push(this.ops.join('\n'));this.ops=[]}
 finish(dest){this.page();const objects=[];const push=x=>(objects.push(x),objects.length);const catalog=push('<< /Type /Catalog /Pages 2 0 R >>');const pages=push('');const font1=push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');const font2=push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');const font3=push('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>');const refs=[];for(const str of this.pages){const buffer=Buffer.from(str,'latin1');const id=push('<< /Length '+buffer.length+' >>\nstream\n'+str+'\nendstream');const page=push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+this.w+' '+this.h+'] /Resources << /Font << /F1 '+font1+' 0 R /F2 '+font2+' 0 R /F3 '+font3+' 0 R >> >> /Contents '+id+' 0 R >>');refs.push(page+' 0 R')}objects[1]='<< /Type /Pages /Kids ['+refs.join(' ')+'] /Count '+refs.length+' >>';let output='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(output,'latin1'));output+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n'}const xref=Buffer.byteLength(output,'latin1');output+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';for(const o of offsets.slice(1))output+=String(o).padStart(10,'0')+' 00000 n \n';output+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';fs.writeFileSync(path.join(out,dest),Buffer.from(output,'latin1'));}
}
function frame(p,title,kicker,page,footer='D.C English Classes - Modo Demonstração'){p.rect(0,0,p.w,p.h,'#edf4fa');p.rect(0,0,p.w,76,'#162e51');p.rect(0,76,p.w,6,'#619acb');p.text('D.C English Classes',33,22,13,'#e8f3ff','F2');p.text('MODO DEMONSTRACAO',p.w-165,25,10,'#b2cdeb','F2');p.text(kicker.toUpperCase(),40,103,11,'#5782aa','F2');p.wrap(title,40,128,p.w-80,27,1.2,'#172d4b','F3');p.line(40,p.h-47,p.w-40,p.h-47);p.text(footer,40,p.h-31,9,'#6a85a0');p.text(String(page),p.w-53,p.h-31,9,'#6a85a0')}
function correction(){
 const p=new PDF(596,842);
 frame(p,'Text Correction - Teamwork','Writing practice',1);
 p.text('YOUR TEXT',45,216,13,'#172d4d','F2');
 const orig='I think a good team need communicate clear. Sometimes people dont agree in meetings, and this make the work more difficult. A leader should listening carefully and give a clear feedback. If everyone share their ideas, the group can find more better solutions.';
 p.wrap(orig,45,251,506,12,1.6);
 p.rect(40,398,516,144,'#eff4fa');p.text('FOCUS AREAS',55,413,14,'#172d4d','F2');
 p.wrap('Grammar (4)  /  Word choice (3)  /  Spelling (1)  /  Clarity (2)',55,447,480,12);
 p.wrap('Explore the underlined ideas. Identify the errors and try to correct them before checking the answer.',55,486,480,11);
 p.page();
 frame(p,'What to Check','Teacher feedback',2);
 const tips=['1. Subject-verb agreement: team needs or team need?','2. Which preposition follows need?','3. Use an adverb with communicate.','4. Remember the apostrophe in don\\u0027t.','5. Agreement with the subject this.','6. Use the base verb after should.','7. Is clear feedback natural English here?','8. Agreement with everyone.','9. Is more better a correct comparison?'];
 let y=218;for(const t of tips){y=p.wrap(t,52,y,495,14,1.32)+14}
 p.page();
 frame(p,'Corrected Text','One possible version',3);
 p.wrap('I think a good team needs to communicate clearly. Sometimes people do not agree during meetings, and this makes work more difficult. A leader should listen carefully and give constructive feedback. If everyone shares their ideas, the group can find better solutions.',48,228,500,13,1.75);
 p.rect(40,427,516,190,'#f0f5f9');p.text('WHAT CHANGED',52,444,14,'#172d4d','F2');
 p.wrap('needs to / clearly / do not / makes / listen / constructive / shares / better',52,487,485,13,1.8);
 p.wrap('Demonstration text only. No student name, attendance record or actual student writing is included.',52,567,480,10,1.5,'#59738f');p.finish('Teamwork - Text Correction - Modo Demonstração.pdf');
}
correction();
console.log('Generated one anonymized writing-correction example. Lesson PDFs are uploaded by the administrator.');
