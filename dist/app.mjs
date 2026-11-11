import {phrases,categories} from './phrases.mjs';
import {grade,selectSession,retry,readState,optionsFor,shuffle} from './core.mjs';
const app=document.querySelector('#app'), KEY='say50-v1';
let state={progress:{}},storageOK=true,voiceName='',session=null,noticeTimer;
try{state=readState(localStorage.getItem(KEY));voiceName=localStorage.getItem('say50-voice')||'';localStorage.setItem('say50-check','1');localStorage.removeItem('say50-check');}catch{storageOK=false;}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(text,action,cls='primary',extra='')=>`<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const source=p=>`<a class="source" href="https://www.youtube.com/watch?v=zLRybDSJRP4&t=${p.time}s" target="_blank" rel="noopener">Посмотреть в ролике ↗</a>`;
const audio=p=>`<div class="audio-row">${button('▶ Послушать',`speak:${p.id}`,'audio-btn')}${button('◷ Медленнее',`slow:${p.id}`,'audio-btn')}</div>`;
function tell(message){clearTimeout(noticeTimer);document.querySelector('#notice').textContent=message;noticeTimer=setTimeout(()=>document.querySelector('#notice').textContent='',6500);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageOK=false;tell('Не удалось сохранить прогресс. Разреши хранение данных сайта в браузере.');}}
function voices(){return window.speechSynthesis?.getVoices().filter(v=>/^en([-_]|$)/i.test(v.lang))||[];}
function speak(p,slow=false){
 if(!window.speechSynthesis){tell('Этот браузер не поддерживает озвучку. Попробуй открыть сайт в Chrome на Android.');return;}
 const list=voices();if(!list.length){tell('Английский голос пока недоступен. Проверь английский голос в настройках синтеза речи Android и нажми ещё раз.');return;}
 speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(p.en.replace('…?','?').replace('…','.'));u.voice=list.find(v=>v.name===voiceName)||list.find(v=>v.lang==='en-US')||list[0];u.lang=u.voice.lang;u.rate=slow?.72:.9;
 u.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))tell('Озвучка не запустилась. Проверь громкость, интернет и выбранный голос.');};speechSynthesis.speak(u);
}
function stop(){window.speechSynthesis?.cancel();}
const dueCount=()=>phrases.filter(p=>state.progress[p.id]&&(!state.progress[p.id].recall||state.progress[p.id].recall.due<=Date.now()||state.progress[p.id].recognition?.due<=Date.now())).length;
function home(){
 const started=Object.keys(state.progress).length, ready=selectSession(phrases,state.progress),newCount=ready.filter(p=>!state.progress[p.id]).length;
 app.innerHTML=`<section class="intro"><div class="label">Английский для жизни</div><h1>От «понимаю»<br>к «говорю».</h1><p class="subtitle">Пять фраз за раз. Слушай, вспоминай и говори вслух.</p></section><div class="speech-card"><div class="wave" aria-hidden="true">${'<i></i>'.repeat(13)}</div><span class="tag">Начни с простого</span><h2 lang="en">How’s it going?</h2><p>Любой разговор начинается с пары слов.</p></div>${button(ready.length?'Начать занятие':'Повторить знакомое','start')}<p class="small-note">${newCount?`${newCount} новых фраз · `:''}${dueCount()?`${Math.min(10,dueCount())} к повторению · `:''}5–10 минут в своём темпе</p>${!storageOK?'<p class="notice-inline">Хранение данных недоступно. Прогресс сохранится только до закрытия страницы.</p>':''}<div class="stats-strip"><div><strong>${started} <span>/ ${phrases.length}</span></strong><span>фраз в работе</span></div><div><strong>${dueCount()}</strong><span>пора повторить</span></div></div><div class="section-head"><h2>Разговор по темам</h2><a href="#library">Все фразы</a></div>${categories.slice(0,3).map((c,i)=>`<div class="topic"><div class="topic-icon" aria-hidden="true">${['☏','!','?'][i]}</div><div><strong>${c}</strong><small>5 фраз из видео</small></div></div>`).join('')}<p class="small-note">По ролику LinguaTrip TV. Переводы и упражнения адаптированы для практики.</p>`;
}
function start(){
 let selected=selectSession(phrases,state.progress);const extraPractice=!selected.length;
 if(extraPractice)selected=shuffle(phrases.filter(p=>p.verified)).slice(0,5);
 const queue=[];
 for(const p of selected)queue.push({id:p.id,mode:'learn'});
 for(const mode of ['listen','situation','recall'])for(const p of shuffle(selected))queue.push({id:p.id,mode,attempt:0});
 session={queue,index:0,answered:false,revealed:false,right:0,total:0,selected,failed:new Set(),extraPractice};
 location.hash='lesson';render();
}
function lesson(){
 if(!session){location.hash='home';return;}
 const s=session;if(s.index>=s.queue.length){finish();return;}
 const task=s.queue[s.index],p=phrases.find(p=>p.id===task.id);
 if(s.renderedIndex!==s.index){s.renderedIndex=s.index;s.answered=false;s.revealed=false;s.selectedAnswer=null;s.currentOptions=optionsFor(p,phrases.filter(p=>p.verified));}
 const titles={learn:'Послушай и повтори',listen:'Что ты услышал?',situation:'Что ты скажешь?',recall:'Вспомни и произнеси'};
 app.innerHTML=`<div class="lesson-top">${button('×','exit','','aria-label="Выйти из занятия"')}<div class="bar" role="progressbar" aria-label="Ход занятия" aria-valuemin="0" aria-valuemax="${s.queue.length}" aria-valuenow="${s.index}"><div style="width:${s.index/s.queue.length*100}%"></div></div><span class="counter">${s.index+1}/${s.queue.length}</span></div><span class="pill">${categories[p.category]}${task.attempt?' · ещё раз':''}</span><h1 class="lesson-title">${titles[task.mode]}</h1><div id="exercise"></div><div id="feedback" aria-live="polite"></div><div id="controls"></div>`;
 const exercise=app.querySelector('#exercise'),controls=app.querySelector('#controls');
 if(task.mode==='learn'){
  exercise.innerHTML=`<div class="phrase-box"><div class="english" lang="en">${esc(p.en)}</div><div class="translation">${esc(p.ru)}</div>${audio(p)}</div><p class="muted">${esc(p.situation)}</p><p>Повтори вслух два раза. Во второй раз попробуй не смотреть на текст.</p>${source(p)}`;
  controls.innerHTML=button('Дальше','next');
 }else if(task.mode==='recall'){
  exercise.innerHTML=`<p class="muted">Сначала скажи по-английски без подсказки.</p><div class="phrase-box"><div class="english">${esc(p.ru)}</div></div>`;
  controls.innerHTML=button('Показать ответ','reveal');
  if(s.revealed){s.revealed=false;reveal();}
 }else{
  exercise.innerHTML=task.mode==='listen'?`${button('<span aria-hidden="true">◖))</span>Послушать фразу',`speak:${p.id}`,'listen-big')}${button('Послушать медленнее',`slow:${p.id}`,'secondary wide')}`:`<p class="subtitle">${esc(p.situation)}</p>`;
  exercise.innerHTML+=`<div class="options">${s.currentOptions.map((o,i)=>button(`<span class="letter">${i+1}</span><span ${task.mode==='situation'?'lang="en"':''}>${esc(task.mode==='listen'?o.ru:o.en)}</span>`,`answer:${o.id}`,'option',`data-id="${o.id}"`)).join('')}</div>`;
  if(s.answered)answer(s.selectedAnswer,true);
 }
}
function record(correct){
 const s=session,t=s.queue[s.index],skill=t.mode==='recall'?'recall':'recognition';s.total++;if(correct)s.right++;else{s.failed.add(t.id);retry(s.queue,s.index,t);}
 // Each skill advances at most once per session, and any error keeps it due.
 s.results??={};const key=`${t.id}:${skill}`;const previous=s.results[key];s.results[key]=previous===false?false:correct;
 s.initial??=structuredClone(state.progress);const base=s.initial[t.id]||{};const updated=grade({[t.id]:base},t.id,skill,s.results[key]);state.progress={...state.progress,[t.id]:{...state.progress[t.id],[skill]:updated[t.id][skill]}};save();
}
function answer(id,restoring=false){
 const s=session;if(!s||s.answered&&!restoring)return;s.answered=true;s.selectedAnswer=id;const t=s.queue[s.index],p=phrases.find(p=>p.id===t.id),correct=id===p.id;if(!restoring)record(correct);
 app.querySelectorAll('.option').forEach(b=>{b.disabled=true;if(Number(b.dataset.id)===p.id)b.classList.add('correct');else if(Number(b.dataset.id)===id)b.classList.add('wrong');});
 app.querySelector('#feedback').innerHTML=`<div class="feedback ${correct?'':'bad'}"><strong>${correct?'Верно!':'Запомним и попробуем ещё раз'}</strong><p><span lang="en">${esc(p.en)}</span> — ${esc(p.ru)}</p></div>${audio(p)}`;
 app.querySelector('#controls').innerHTML=button('Продолжить','next');
}
function reveal(){if(!session||session.revealed)return;session.revealed=true;const p=phrases.find(p=>p.id===session.queue[session.index].id);app.querySelector('#exercise').innerHTML+=`<div class="phrase-box"><div class="english" lang="en">${esc(p.en)}</div>${audio(p)}</div><p class="muted">Удалось вспомнить до открытия ответа?</p>`;app.querySelector('#controls').innerHTML=`<div class="actions">${button('Ещё учу','recall:no','secondary')}${button('Вспомнил','recall:yes')}</div>`;}
function finish(){
 const s=session;app.innerHTML=`<div class="completion" aria-hidden="true">✓</div><span class="pill">Занятие завершено</span><h1>Хорошая<br>практика.</h1><p class="subtitle">Сегодня ты потренировал ${s.selected.length} фраз. Дай им немного времени — и вернись к повторению.</p><div class="stats-strip"><div><strong>${s.right} / ${s.total}</strong><span>верных ответов</span></div><div><strong>${s.failed.size}</strong><span>фраз требуют внимания</span></div></div><h2>${s.failed.size?'Ещё немного практики':'Следующий шаг'}</h2><p class="muted">${s.failed.size?'Трудные фразы уже добавлены в ближайшее повторение.':'Вернись завтра: повторение поможет закрепить фразы.'}</p>${button('На главную','home')}<p class="small-note">${storageOK?'Прогресс сохранён в этом браузере.':'Прогресс не сохранён: хранение данных недоступно.'}</p>`;
}
function library(){app.innerHTML=`<span class="label">Твоя разговорная коллекция</span><h1>50 фраз.<br>Много поводов.</h1><input class="search" type="search" id="search" placeholder="Найти фразу или перевод" aria-label="Поиск фраз"><div id="phrase-list"></div>`;drawList('');}
function drawList(query){const found=phrases.filter(p=>`${p.en} ${p.ru} ${categories[p.category]}`.toLowerCase().includes(query.toLowerCase()));app.querySelector('#phrase-list').innerHTML=found.length?found.map(p=>`<details class="phrase-item"><summary><span lang="en">${esc(p.en)}</span><small>${esc(p.ru)}</small></summary><p>${esc(p.situation)}</p><span class="status-text">${categories[p.category]}${p.verified?'':' · формулировка ещё сверяется'}</span>${audio(p)}${p.id===12?'<p>Например: Do you mind if I sit here? Ответ «No, go ahead» означает, что человек не возражает.</p>':''}${source(p)}</details>`).join(''):'<p class="empty">Такой фразы нет. Попробуй другое слово.</p>';}
function progress(){
 const list=phrases.filter(p=>state.progress[p.id]);const mastered=list.filter(p=>state.progress[p.id].recall?.level>=3).length;
 app.innerHTML=`<span class="label">Маленькие шаги каждый день</span><h1>Твой прогресс</h1><div class="stats-strip"><div><strong>${mastered} / 50</strong><span>закреплены вспоминанием</span></div><div><strong>${dueCount()}</strong><span>к повторению</span></div></div><p class="small-note">«Закреплена» — три успешных повторения в разные занятия без подсказок.</p>${list.length?list.map(p=>{const row=state.progress[p.id];return `<div class="progress-row"><strong lang="en">${esc(p.en)}</strong><p class="muted">${esc(p.ru)}</p><small>Узнавание ${row.recognition?.level||0}/4 · Вспоминание ${row.recall?.level||0}/4</small><div class="bar"><div style="width:${(row.recall?.level||0)*25}%"></div></div><small>${!row.recall||row.recall.due<=Date.now()?'Пора повторить':`Следующее вспоминание: ${new Date(row.recall.due).toLocaleDateString('ru-RU')}`}</small></div>`;}).join(''):`<div class="empty"><p>Здесь появятся фразы после первых ответов.</p>${button('Начать занятие','start')}</div>`}`;
}
function settings(){const list=voices();app.innerHTML=`<section class="settings"><a class="back-link" href="#home">‹ На главную</a><h1>Как звучит<br>твой английский</h1><label for="voice">Английский голос</label><select id="voice"><option value="">Автоматически</option>${list.map(v=>`<option value="${esc(v.name)}" ${voiceName===v.name?'selected':''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select>${!list.length?'<p class="notice-inline">Английский голос пока не найден. Проверь настройки синтеза речи Android, затем вернись сюда.</p>':''}${audio(phrases[0])}<p class="muted">Это синтезированная речь, а не голос автора видео. Некоторым голосам нужен интернет.</p><h2>Как заниматься</h2><p>Слушай образец, повторяй вслух и вспоминай фразу до открытия ответа. Тренажёр не записывает микрофон и не оценивает произношение.</p><h2>На главном экране</h2><p>В меню браузера Android найди «Добавить на главный экран», если этот пункт доступен.</p><h2>Твой прогресс</h2><p>Хранится только в этом браузере. Очистка данных сайта удалит результаты. На другом устройстве они не появятся.</p><a class="source" href="https://www.youtube.com/watch?v=zLRybDSJRP4" target="_blank" rel="noopener">Исходный ролик LinguaTrip TV ↗</a></section>`;}
function render(){stop();const page=location.hash.slice(1)||'home';document.querySelectorAll('nav a').forEach(a=>{const active=a.dataset.tab===(page==='lesson'?'home':page);a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});({home,library,progress,settings,lesson}[page]||home)();window.scrollTo(0,0);app.focus({preventScroll:true});}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const [action,value]=b.dataset.action.split(':');
 if(action==='speak'||action==='slow'){speak(phrases.find(p=>p.id===Number(value)),action==='slow');return;}
 if(action==='start')start();
 if(action==='home'){session=null;location.hash='home';}
 if(action==='exit'){stop();if(window.confirm('Выйти из занятия? Ответы уже сохранены, но ход занятия не сохранится.')){session=null;location.hash='home';}}
 if(action==='next'&&session){const t=session.queue[session.index];if(t.mode!=='learn'&&!session.answered)return;stop();session.index++;lesson();window.scrollTo(0,0);app.focus({preventScroll:true});}
 if(action==='answer')answer(Number(value));
 if(action==='reveal')reveal();
 if(action==='recall'&&session?.revealed&&!session.answered){session.answered=true;record(value==='yes');session.index++;stop();lesson();window.scrollTo(0,0);}
});
document.addEventListener('input',e=>{if(e.target.id==='search')drawList(e.target.value);});
document.addEventListener('change',e=>{if(e.target.id==='voice'){voiceName=e.target.value;try{localStorage.setItem('say50-voice',voiceName);}catch{tell('Выбор голоса действует до закрытия страницы.');}}});
document.querySelector('#settings').onclick=()=>location.hash='settings';
window.addEventListener('hashchange',render);window.addEventListener('pagehide',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.speechSynthesis?.addEventListener('voiceschanged',()=>{if(location.hash==='#settings')settings();});
render();
