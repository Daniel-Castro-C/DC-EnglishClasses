/* Shared metric renderer: current portal tokens, no change of visual identity. */
(function(){
 'use strict';
 const words={pt:{journey:'Minha jornada',classes:'Aulas realizadas',time:'Tempo em aula',saved:'Palavras salvas',guides:'Grammar Guides estudados',badges:'Marcos alcançados',year:'Retrospectiva',yearDesc:'Sua evolução neste ano'},en:{journey:'My journey',classes:'Lessons completed',time:'Learning time',saved:'Saved words',guides:'Grammar Guides studied',badges:'Milestones reached',year:'Year in review',yearDesc:'Your progress this year'}};
 function duration(count){if(count==null)return '—';const mins=Math.max(0,Math.trunc(Number(count)||0))*50;return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');}
 function text(n){return n==null?'—':String(Math.max(0,Math.trunc(Number(n)||0)));}
 function metrics({completed=null,saved=null,guides=null,badges=null,grammarUnlocked=false},lang='pt'){
  const labels=words[lang]||words.pt;
  return [[labels.classes,text(completed)],[labels.time,duration(completed)],[labels.saved,text(saved)],...(grammarUnlocked?[[labels.guides,text(guides)]]:[]),[labels.badges,text(badges)]];
 }
 function render(stats,lang='pt',year=null){
  const l=words[lang]||words.pt,title=year?l.year+' '+Number(year):l.journey;
  return '<section class="student-journey-panel"><h2>'+title+'</h2>'+(year?'<p class="journey-description">'+l.yearDesc+'</p>':'')+'<div class="student-journey-grid">'+metrics(stats,lang).map(([label,value])=>'<div class="student-journey-card"><span>'+label+'</span><strong>'+value+'</strong></div>').join('')+'</div></section>';
 }
 async function load(db,id,completed,grammarUnlocked,milestones){
  async function count(table,key,value){try{const r=await db.from(table).select('id',{head:true,count:'exact'}).eq('student_id',id).eq(key,value);return r.error||r.count==null?null:r.count;}catch(_){return null;}}
  // The word table uses a compound key rather than a separate ID.
  async function saved(){try{const r=await db.from('word_of_day_answers').select('day_index',{head:true,count:'exact'}).eq('student_id',id).eq('answer','nao_uso');return r.error||r.count==null?null:r.count;}catch(_){return null;}}
  const [savedCount,guides]=await Promise.all([saved(),grammarUnlocked?count('grammar_material_status','status','estudado'):null]);
  return {completed,saved:savedCount,guides,grammarUnlocked,badges:completed==null?null:milestones.filter(m=>completed>=m.threshold).length};
 }
 async function yearly(db,id,grammarUnlocked){
  try{const {data,error}=await db.from('student_retrospectives').select('year,stats').eq('student_id',id).eq('published',true).order('year',{ascending:false}).limit(1);if(error||!data?.length)return null;return {year:data[0].year,stats:{...data[0].stats,grammarUnlocked:grammarUnlocked&&data[0].stats.grammarUnlocked}};}catch(_){return null;}
 }
 window.StudentJourney={duration,metrics,render,load,yearly};
})();
