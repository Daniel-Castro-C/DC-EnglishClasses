// Signature 2027 for GENERATED visitor assets only. No changes to live student files.
const exact=new Map(Object.entries({
 '#16213e':'#1E3D2F','#0e1730':'#102D21','#eaf2fa':'#F8F9F9',
 '#e4eff9':'#DDE7E1','#d3e1ef':'#D2E0D6','#5b93c4':'#557B64',
 '#23262b':'#303936','#5b5f68':'#5D6F66','#f5f8fd':'#F8F9F9',
 '#0e1524':'#101F19','#182238':'#1C3027','#2b3550':'#365044',
 '#2f6eaa':'#35664A','#172947':'#1E3D2F','#c98a2e':'#B69A69',
 '#1a2a49':'#1E3D2F','#3f6a9e':'#41654A',
 '#344f77':'#365A46','#91bde6':'#B69A69','#b7d2eb':'#DDE7E1'
}));
function recolor(r,g,b){
 // Translate blue UI shades into green equivalents while retaining luminance bands.
 // Preserve warning, danger, status, flags and neutral colors.
 if(!(b>r+8 && b>g && g>=r-5 && (b-g)>3))return [r,g,b];
 const light=(Math.max(r,g,b)+Math.min(r,g,b))/2;
 const stops=[[0,[0,0,0]],[25,[12,31,22]],[43,[30,61,47]],[82,[45,86,62]],[120,[68,112,82]],[150,[100,140,113]],[185,[150,180,159]],[219,[200,219,207]],[240,[229,238,232]],[255,[255,255,255]]];
 const hi=stops.findIndex(([x])=>x>=light);
 if(hi<=0)return stops[0][1];
 const [l,a]=stops[hi-1],[h,z]=stops[hi],t=(light-l)/(h-l);
 return a.map((v,i)=>Math.round(v+(z[i]-v)*t));
}
function hex(rgb){return '#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase()}
export function brandColors(source){
 return source.replace(/#[0-9a-f]{6}(?:[0-9a-f]{2})?\b/gi,match=>{
   const base=match.slice(0,7),rgb=base.slice(1).match(/../g).map(v=>parseInt(v,16)),replacement=exact.get(base.toLowerCase())||hex(recolor(...rgb));
   return replacement+match.slice(7);
 }).replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(\s*,[^)]*)?\)/gi,(match,r,g,b,alpha='')=>{
   const rgb=recolor(Number(r),Number(g),Number(b));return (alpha?'rgba(':'rgb(')+rgb.join(',')+alpha+')';
 });
}
export function brandStyles(source){
 return brandColors(source)
  .replace(/['"]IBM Plex Sans['"]/g,"'Manrope'")
  .replace(/['"]Baskerville Old Face['"]\s*,\s*/g,'')
  .replace(/['"]Libre Baskerville['"]/g,"'DM Serif Display'");
}
