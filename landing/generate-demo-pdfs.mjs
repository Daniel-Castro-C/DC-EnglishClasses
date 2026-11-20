// Source-derived DEMONSTRATION PDF assets. The originals are user-supplied PDF
// presentations. This pure-Node renderer keeps the subjects and exercise flow,
// but intentionally omits private student content, names, lesson dates and
// inaccessible embedded third-party audiovisual content.
import fs from 'node:fs';
import path from 'node:path';
const out=path.join(process.cwd(),'landing','dist','visit','demo');
fs.mkdirSync(out,{recursive:true});
const fstr=s=>String(s??'').replace(/[^\x20-\x7E\xA0-\xFF]/g,c=>({"’":"'","‘":"'","“":'"',"”":'"',"—":"-","–":"-","•":"-","✓":"OK","…":"..."}[c]||'?')).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const color=(hex)=>{const h=hex.replace('#','');return [0,2,4].map(i=>(parseInt(h.slice(i,i+2),16)/255).toFixed(3)).join(' ')};
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
function slide(name,frames){
 const p=new PDF(960,540);
 frames.forEach((item,i)=>{frame(p,item.title,item.label||'Conversation',i+1);let y=206;
 if(item.intro)y=p.wrap(item.intro,45,y,865,18,1.4,'#284665')+15;
 for(const bullet of item.items||[]){p.rect(45,y+4,7,7,'#619acb');y=p.wrap(bullet,64,y,835,18,1.26,'#213d5b')+13;if(y>445)break}
 });p.finish(name);
}
slide('Giving and Receiving Feedback - Modo Demonstração.pdf',[
 {title:'Giving and Receiving Feedback',label:'Conversation and listening',intro:'How can we give useful feedback and receive criticism constructively?'},
 {title:'Feedback or Let It Go?',items:['Arriving five minutes late','A typing mistake in an email to a client','Interrupting in meetings','A report with wrong numbers','No reply to emails for days','A very long presentation']},
 {title:'The Secret to Giving Constructive Feedback',label:'Listening',items:['What makes feedback constructive rather than hurtful?','Consider tone, timing, and specific examples.','Original lesson contains an external listening/video activity.']},
 {title:'The SBI Framework for Difficult Conversations',label:'Listening',items:['SITUATION: Describe when and where it happened.','BEHAVIOR: State the observable action.','IMPACT: Explain the consequence or effect.','How would you apply this framework in a real conversation?']},
 {title:'Ways to Give Feedback - Pros and Cons',items:['Face to face','Email','Video call','Performance review','Team meeting','Anonymous survey']},
 {title:'Same Message, Different Words',items:['Compare a direct comment with a constructive one.','Use specific observations, respectful language, and practical next steps.','Practice rephrasing uncomfortable feedback.']}
]);
slide('Productivity - Modo Demonstração.pdf',[
 {title:'Productivity',label:'Conversation',intro:'Working smarter, managing priorities and communicating about work.'},
 {title:'What Does Productivity Mean to You?',items:['What does being productive mean in your job?','What helps you work efficiently?','Which daily habits can make a difference?']},
 {title:'What Is Your View On...?',items:["Working longer hours means you are more productive.","Multitasking helps people accomplish more.","Taking breaks reduces productivity.","Working under pressure leads to better results.","Good planning is more important than working hard.","It is better to do something well than many things quickly."]},
 {title:'Planning Your Day',items:['Identify your three most important tasks.','Set realistic priorities and leave room for interruptions.','Explain your planned routine using clear time expressions.']},
 {title:'Which Would You Choose?',items:['Finish early OR deliver perfect quality?','Fewer meetings OR better communication?','AI assistance OR human creativity?','Flexible schedule OR fixed routine?']},
 {title:'Getting into a Flow State of Mind',label:'Reading',items:['What conditions help you focus intensely?','How do distractions interrupt your flow?','Discuss the concept of flow and its relevance at work.']},
 {title:'Reflection',items:['Share one habit you want to improve.','Describe a realistic change in your weekly routine.','What would make the biggest difference to your productivity?']}
]);
function report(name,topic,highlight,review,vocab,pron,ratings,homework,writing){
 const p=new PDF(596,842);p.rect(0,0,596,842,'#ffffff');p.rect(28,22,46,46,'#172d4d');p.text('DC',35,36,20,'#ffffff','F2');p.text('ENGLISH LESSON REPORT',88,26,19,'#172d4d','F3');p.text('D.C English Classes - Modo Demonstração',88,52,9,'#59799e');p.line(30,85,566,85,'#172d4d',2);
 p.rect(30,100,536,48,'#edf2f8');p.text('LESSON TOPIC',44,109,9,'#5481a6','F2');p.text(topic,44,123,17,'#172d4d','F3');
 p.rect(30,168,258,150,'#f4f8fc');p.rect(307,168,259,150,'#f4f8fc');p.text('HIGHLIGHT',43,179,12,'#172d4d','F2');p.wrap(highlight,43,209,230,11,1.5);
 p.text('REVIEW',321,179,12,'#172d4d','F2');p.wrap(review,321,209,230,11,1.5);
 p.rect(30,336,258,110,'#f4f8fc');p.rect(307,336,259,110,'#f4f8fc');p.text('VOCABULARY',43,348,12,'#172d4d','F2');p.wrap(vocab.join('  |  '),43,381,230,10,1.7);
 p.text('PRONUNCIATION',321,348,12,'#172d4d','F2');p.wrap(pron.join('  |  '),321,381,230,10,1.7);
 p.rect(30,461,536,165,'#eef4fb');p.text('PERFORMANCE REPORT',43,471,12,'#172d4d','F2');const overall=(ratings.reduce((a,b)=>a+b,0)/4).toFixed(1);p.text('Overall  '+overall+' / 5',431,471,11,'#172d4d','F2');
 ['SPEAKING','GRAMMAR','VOCABULARY','LISTENING'].forEach((name,i)=>{const y=504+i*25;p.text(name,45,y,10,'#172d4d','F2');p.rect(168,y+4,337,8,'#d4e2ef');p.rect(168,y+4,337*ratings[i]/5,8,'#619acb');p.text(ratings[i]+'/5',521,y,10,'#172d4d','F2')});
 p.text('1 = needs work  /  3 = good  /  5 = excellent',43,611,9,'#66829f');
 p.rect(30,644,536,62,'#f4f8fc');p.text('HOMEWORK',43,652,12,'#172d4d','F2');p.wrap(homework,43,674,506,10,1.3);
 p.rect(30,718,536,75,'#f4f8fc');p.text('WRITING PRACTICE',43,726,12,'#172d4d','F2');p.wrap(writing,43,751,506,10,1.34);
 p.text('D.C English Classes',30,818,9,'#748ca6');p.finish(name);
}
report('Giving and Receiving Feedback - Relatório de Performance - Modo Demonstração.pdf','Giving and Receiving Feedback',
 'Clear explanations and confident use of expressions such as "I see your point" and "Could we try another approach?" helped make feedback more constructive.',
 'Review softening expressions and question forms. For example: "You are wrong" can become "Could we consider another option?"',
 ['constructive','specific','approach','acknowledge','tone','follow-up'],['constructive','acknowledge','colleague'],[4,4,4,3],
 'Write three examples of professional feedback using situation, behavior and impact.',
 'Describe how you would respond to a colleague who missed an important deadline.');
report('Productivity - Relatório de Performance - Modo Demonstração.pdf','Productivity',
 'Good fluency when comparing methods of organizing work, especially when using expressions such as "set priorities" and "meet deadlines".',
 'Review the contrast between "efficient" (doing things well) and "effective" (achieving desired results), and revise comparative structures.',
 ['prioritize','deadline','workflow','distraction','efficient','schedule'],['productivity','prioritize','workflow'],[4,3,4,4],
 'Make a short plan for improving one part of your working routine.',
 'What is one habit that could make you more productive without increasing working hours?');
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
console.log('Generated four public class files and one anonymized writing-correction example.');
