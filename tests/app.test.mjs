import test from 'node:test';
import assert from 'node:assert/strict';

// A small event harness tests the actual app handlers without browser dependencies.
async function setup(initial={progress:{}}){
 const elements=new Map();
 const element=id=>{if(!elements.has(id)){let html='';elements.set(id,{get innerHTML(){return html;},set innerHTML(value){html=value;if(id==='#app')for(const child of ['#exercise','#controls','#feedback'])elements.delete(child);},textContent:'',focus(){},querySelector:s=>element(s),querySelectorAll:()=>[]});}return elements.get(id);};
 const handlers={};const data=new Map([['say50-v1',JSON.stringify(initial)]]);
 globalThis.document={querySelector:element,querySelectorAll:()=>[],addEventListener:(type,fn)=>handlers[type]=fn};
 const windowHandlers={};globalThis.window={scrollTo(){},addEventListener:(type,fn)=>windowHandlers[type]=fn,confirm:()=>false};
 let hash='#home';globalThis.location={get hash(){return hash;},set hash(value){hash=value.startsWith('#')?value:`#${value}`;}};
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 await import(`../dist/app.mjs?test=${Math.random()}`);
 return {html:id=>element(id).innerHTML,render(){windowHandlers.hashchange();},click(action){handlers.click({target:{closest:()=>({dataset:{action}})}});},saved:()=>JSON.parse(data.get('say50-v1')),data};
}
test('cancelled exit preserves the answered question and prevents a second score',async()=>{
 const h=await setup();h.click('start');for(let i=0;i<5;i++)h.click('next');
 h.click('answer:1');const saved=h.saved();const feedback=h.html('#feedback');
 assert.ok(feedback.includes('feedback'));
 const controls=h.html('#controls');h.click('exit');assert.equal(h.html('#controls'),controls);assert.equal(h.html('#feedback'),feedback);
 h.click('answer:2');assert.deepEqual(h.saved(),saved);
});
test('mistakes in voluntary early practice are saved and become due',async()=>{
 const progress={};for(let id=1;id<=50;id++)progress[id]={recognition:{level:3,due:Date.now()+99999999},recall:{level:3,due:Date.now()+99999999}};
 const h=await setup({progress});h.click('start');for(let i=0;i<5;i++)h.click('next');
 const id=Number(h.html('#exercise').match(/speak:(\d+)/)[1]);
 h.click(`answer:${id===1?2:1}`);
 assert.equal(h.saved().progress[id].recognition.level,0);
 assert.ok(h.saved().progress[id].recognition.due<=Date.now());
});
test('returning to a revealed recall question keeps self-assessment available',async()=>{
 const h=await setup();h.click('start');for(let i=0;i<5;i++)h.click('next');
 for(let i=0;i<10;i++){const id=h.html('#exercise').match(/(?:speak:|answer:)(\d+)/)[1];h.click(`answer:${id}`);h.click('next');}
 // Answer any queued retries before the recall section.
 for(let i=0;i<20&&h.html('#controls').includes('Продолжить')===false&&!h.html('#controls').includes('Показать ответ');i++){const id=h.html('#exercise').match(/(?:speak:|answer:)(\d+)/)?.[1];if(!id)break;h.click(`answer:${id}`);h.click('next');}
 assert.ok(h.html('#controls').includes('Показать ответ'));
 h.click('reveal');h.render();assert.ok(h.html('#controls').includes('Вспомнил'));
});
