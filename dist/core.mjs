const DAY=86400000;
export function grade(progress,id,skill,correct,now=Date.now()) {
 const row=progress[id]||{}, previous=row[skill]||{level:0};
 if(correct&&previous.due>now)return progress;
 const level=correct?Math.min(4,previous.level+1):0;
 return {...progress,[id]:{...row,[skill]:{level,due:correct?now+[1,3,7,14][level-1]*DAY:now}}};
}
export function selectSession(phrases,progress,now=Date.now()) {
 const valid=phrases.filter(p=>p.verified);
 const due=valid.filter(p=>progress[p.id]&&(!progress[p.id].recall||progress[p.id].recall.due<=now||progress[p.id].recognition?.due<=now));
 const fresh=valid.filter(p=>!progress[p.id]).slice(0,5);
 return [...due.slice(0,10),...fresh];
}
export function retry(queue,index,task) {
 if((task.attempt||0)>=2)return;
 queue.splice(Math.min(index+3,queue.length),0,{...task,attempt:(task.attempt||0)+1});
}
export function readState(raw) {
 try {
  const s=JSON.parse(raw); if(!s||!s.progress||typeof s.progress!=='object'||Array.isArray(s.progress))throw Error();
  const progress={};
  for(const [id,row] of Object.entries(s.progress)) {
   if(!/^\d+$/.test(id)||!row||typeof row!=='object')throw Error();
   progress[id]={};
   for(const key of ['recognition','recall'])if(row[key]) {
    const {level,due}=row[key]; if(!Number.isInteger(level)||level<0||level>4||!Number.isFinite(due)||due<0)throw Error();
    progress[id][key]={level,due};
   }
  }
  return {progress};
 }catch{return {progress:{}};}
}
export function shuffle(values) {
 const a=[...values]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
export function optionsFor(phrase,phrases) {
 // Related agreement, opinion and reaction phrases can all fit the same prompt.
 const families=[[0],[1,4,7],[2],[3],[5,6],[8],[9]];
 const excluded=families.find(g=>g.includes(phrase.category))||[phrase.category];
 const conflicts=[[42,46,47,48,49,50],[13,14,33],[4,5,31,32]];
 const related=conflicts.filter(group=>group.includes(phrase.id)).flat();
 const others=phrases.filter(p=>p.id!==phrase.id&&p.en!==phrase.en&&p.ru!==phrase.ru&&!excluded.includes(p.category)&&!related.includes(p.id));
 return shuffle([phrase,...shuffle(others).slice(0,3)]);
}
