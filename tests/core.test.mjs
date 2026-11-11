import test from 'node:test';
import assert from 'node:assert/strict';
import {grade, selectSession, retry, readState, optionsFor} from '../dist/core.mjs';
import {phrases} from '../dist/phrases.mjs';
test('recognition does not advance recall, review steps are 1/3/7/14 days',()=>{
 let p={}; let now=100000;
 p=grade(p,1,'recognition',true,now); assert.equal(p[1].recall,undefined);
 for(const days of [1,3,7,14]) {p=grade(p,1,'recall',true,now);assert.equal(p[1].recall.due,now+days*86400000);now=p[1].recall.due;}
 p=grade(p,1,'recall',false,now); assert.equal(p[1].recall.level,0); assert.equal(p[1].recall.due,now);
});
test('select due phrases first, max five new, exclude unverified',()=>{
 const rows=Array.from({length:12},(_,i)=>({id:i+1,verified:i!==11}));
 const p={1:{recall:{due:99999}},2:{recall:{due:1}}};
 const out=selectSession(rows,p,100); assert.equal(out[0].id,2); assert.equal(out.length,6);assert.ok(!out.some(x=>[1,12].includes(x.id)));
});
test('mistake retries after two other tasks or at session end, only twice',()=>{
 const q=[{id:1},{id:2},{id:3}]; retry(q,0,{id:1,attempt:0});assert.equal(q[3].id,1);
 retry(q,3,{id:1,attempt:1});assert.equal(q[4].attempt,2);
 retry(q,4,{id:1,attempt:2});assert.equal(q.length,5);
});
test('invalid or hostile persisted shapes reset safely',()=>{
 for(const raw of ['bad','null','[]','{"progress":null}','{"progress":{"1":{"recall":{"level":999,"due":"oops"}}}}']) assert.deepEqual(readState(raw),{progress:{}});
 const s={progress:{1:{recall:{level:1,due:123}}}};assert.deepEqual(readState(JSON.stringify(s)),s);
});
test('early practice cannot advance a future review, a mistake can make it due',()=>{
 const p={1:{recall:{level:1,due:100000}}};
 assert.deepEqual(grade(p,1,'recall',true,50000),p);
 assert.equal(grade(p,1,'recall',false,50000)[1].recall.due,50000);
});
test('quiz distractors avoid phrases with equivalent conversational uses',()=>{
 const target={id:1,en:'Really?',ru:'Правда?',category:1};
 const rows=[target,{id:2,en:'No way!',ru:'Не может быть!',category:1},...Array.from({length:3},(_,i)=>({id:i+3,en:`different ${i}`,ru:`другое ${i}`,category:5}))];
 for(let i=0;i<20;i++){const options=optionsFor(target,rows);assert.equal(options.length,4);assert.ok(!options.some(p=>p.id===2));}
});
test('all fifty source phrases are verified and every quiz has four unique options',()=>{
 assert.equal(phrases.length,50);assert.equal(new Set(phrases.map(p=>p.id)).size,50);
 assert.ok(phrases.every(p=>p.verified));
 for(const p of phrases){const options=optionsFor(p,phrases);assert.equal(options.length,4);assert.equal(new Set(options.map(x=>x.id)).size,4);assert.ok(options.some(x=>x.id===p.id));}
});
test('informal farewells and help acceptance do not offer equivalent distractors',()=>{
 for(const [id,conflict] of [[48,42],[42,48],[14,33],[33,14]]){
  const p=phrases.find(p=>p.id===id);
  for(let i=0;i<30;i++)assert.ok(!optionsFor(p,phrases).some(o=>o.id===conflict));
 }
});
