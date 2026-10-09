'use strict';
const P=window.THSRPlanner,D=window.THSR_DATA,$=id=>document.getElementById(id),WEEK=['','一','二','三','四','五','六','日'];
let result=null,mode='all',tmode='depart',limit=8,slowLimit=6,toastTimer;
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=v=>P.hhmm(v)+(v>=1440?' <small class="day-tag">隔日</small>':'');
const mdText=d=>Number(d.slice(5,7))+'/'+Number(d.slice(8,10));
// Per-date trains: say 每日 / 每週五 when the dates follow a weekday rule inside the fetched window, otherwise list date ranges.
const datesText=dates=>{const w=D.daily,all=[];for(let d=new Date(w.from+'T00:00:00');;d.setDate(d.getDate()+1)){const iso=isoDate(d);if(iso>w.to)break;all.push(iso);}
 const set=new Set(dates),wd=iso=>new Date(iso+'T00:00:00').getDay()||7,span='（'+mdText(w.from)+'～'+mdText(w.to)+'）';
 if(all.every(d=>set.has(d)))return '每日'+span;
 // Weekday rule by majority (holidays break strict patterns), then list the exceptions; fall back to date ranges if there are many.
 const days=[1,2,3,4,5,6,7].filter(w=>{const pool=all.filter(d=>wd(d)===w);return pool.length&&pool.filter(d=>set.has(d)).length*2>=pool.length;});
 const extra=dates.filter(d=>!days.includes(wd(d))),missing=all.filter(d=>days.includes(wd(d))&&!set.has(d));
 if(days.length&&extra.length+missing.length<=4)return (days.length===7?'每日':'每週'+days.map(d=>WEEK[d]).join('、'))+(extra.length?'，另 '+extra.map(mdText).join('、'):'')+(missing.length?'，'+missing.map(mdText).join('、')+' 除外':'')+span;
 const ranges=[];for(const d of dates){const last=ranges[ranges.length-1];if(last&&isoDate(new Date(new Date(last[1]+'T00:00:00').getTime()+864e5))===d)last[1]=d;else ranges.push([d,d]);}
 return ranges.map(([a,b])=>a===b?mdText(a)+'（'+WEEK[wd(a)]+'）':mdText(a)+'～'+mdText(b)).join('、');};
const daysText=days=>typeof days[0]==='string'?datesText(days):days.length===7?'每日':days.map(d=>'週'+WEEK[d]).join('、');
// '10–12 車' / '全車自由座'; empty when the dataset has no car info for this train
const carsText=cars=>{if(!cars||!cars.length)return '';if(cars.length>=11)return '全車自由座';/* every car except business car 6 */const r=[];for(const c of cars){const last=r[r.length-1];if(last&&last[1]===c-1)last[1]=c;else r.push([c,c]);}return r.map(([a,b])=>a===b?String(a):a+'–'+b).join('、')+' 車';};
const isoDate=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
if(D.daily){const w=D.daily;$('data-note').textContent=' 逐日時刻表、自由座車廂與票價：TDX 運輸資料流通服務，'+mdText(w.fetched)+' 更新，涵蓋 '+mdText(w.from)+'～'+mdText(w.to)+'，每日 06:00 自動更新；更遠日期依常態時刻表。';}
P.STATIONS.forEach((name,i)=>{for(const id of ['origin','destination']){const o=document.createElement('option');o.value=i;o.textContent=name;$(id).append(o);}});
$('origin').value='1';$('destination').value='9';
// Departure picker is a native time input (a wheel on phones); default to today and the current minute.
const clampTime=t=>P.hhmm(Math.min(1439,Math.max(330,P.parseTime(t))));  // minute precision; first train leaves 05:50
const now=new Date();$('date').value=isoDate(now);$('after').value=clampTime(P.hhmm(now.getHours()*60+now.getMinutes()));
const SAMPLES=[[1,9],[4,11],[2,7],[11,1]];
const recent=()=>{try{return JSON.parse(localStorage.getItem('recent')||'[]');}catch{return [];}};
function remember(o,e){try{const r=recent().filter(x=>!(x[0]===o&&x[1]===e));r.unshift([o,e]);localStorage.setItem('recent',JSON.stringify(r.slice(0,4)));}catch{}renderPresets();}
function renderPresets(){const r=recent(),list=r.length?r:SAMPLES;$('presets-label').textContent=r.length?'最近查詢':'試試看';$('preset-list').innerHTML=list.map(([o,e])=>`<button type="button" data-route="${o}-${e}">${P.STATIONS[o]} → ${P.STATIONS[e]}</button>`).join('');}
function setTmode(m){tmode=m;document.querySelectorAll('[data-tmode]').forEach(b=>{const on=b.dataset.tmode===m;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 // Sort choices follow the mode: depart → earliest arrival first, arrive-by → latest departure first.
 const sort=$('sort'),opt=(v,off)=>{const o=sort.querySelector('[value='+v+']');o.hidden=off;o.disabled=off;};opt('arrival',m==='arrive');opt('departure',m==='depart');  /* iOS ignores hidden on <option>, so disable too */if(sort.value==='arrival'&&m==='arrive')sort.value='departure';if(sort.value==='departure'&&m==='depart')sort.value='arrival';}
function loadParams(){const p=new URLSearchParams(location.search),ints={from:['origin',0,11],to:['destination',0,11],min:['min-transfer',5,20],wait:['max-wait',20,1440]};for(const [key,[id,min,max]] of Object.entries(ints)){if(!p.has(key))continue;const n=Number(p.get(key));if(Number.isInteger(n)&&n>=min&&n<=max&&[...$(id).options].some(o=>Number(o.value)===n))$(id).value=String(n);}const d=p.get('date');if(d&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=$('date').min&&d<=$('date').max)$('date').value=d;const t=p.get('by')||p.get('after');if(t&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t))$('after').value=clampTime(t);setTmode(p.has('by')?'arrive':'depart');if(p.get('sort')==='duration')$('sort').value='duration';}
renderPresets();
loadParams();
function opts(){return {origin:Number($('origin').value),destination:Number($('destination').value),date:$('date').value||isoDate(new Date()),after:tmode==='depart'?P.parseTime($('after').value||'00:00'):0,arriveBy:tmode==='arrive'?P.parseTime($('after').value||'23:59'):null,minTransfer:Number($('min-transfer').value),maxWait:Number($('max-wait').value),sort:$('sort').value};}
function permalink(){const o=opts(),url=new URL(location.href);url.search='';const fields={from:o.origin,to:o.destination,date:o.date,[tmode==='arrive'?'by':'after']:P.hhmm(tmode==='arrive'?o.arriveBy:o.after),min:o.minTransfer,wait:o.maxWait,sort:o.sort};for(const [k,v] of Object.entries(fields))url.searchParams.set(k,v);return url.href;}
function toast(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);}
function query(){limit=8;slowLimit=6;result=P.search(D,opts());if(!result.error)remember(result.origin,result.destination);if(result.error){$('message').textContent=result.error;$('message').hidden=false;$('results').hidden=true;return;}$('message').hidden=true;$('results').hidden=false;try{history.replaceState(null,'',permalink());}catch{}render();}
function card(r,slow=false){
 const origin=P.STATIONS[result.origin],dest=P.STATIONS[result.destination],isT=r.type==='transfer';
 const badge=slow?'較慢／較不實用':isT?(r.turnback?'折返轉乘':'一次轉乘'):'直達';
 let delta=r.delta===null?'此區間無直達車':r.delta<0?'比最快直達省 '+(-r.delta)+' 分':r.delta===0?'與最快直達車程相同':'比最快直達多 '+r.delta+' 分';
 let compare='直達無需換車，按展開路線查看停靠站。';
 if(isT){
  if(r.nextDirect){const n=r.nextDirect;const c=r.arrivalGain>0?'<span class="gain">比下一班直達早到 '+r.arrivalGain+' 分</span>':r.arrivalGain===0?'<span>與下一班直達同時抵達</span>':'<span class="loss">比下一班直達晚到 '+(-r.arrivalGain)+' 分</span>';compare=c+'<span>直達 '+escapeHTML(n.train)+'｜'+P.hhmm(n.departure)+' → '+P.hhmm(n.arrival)+(n.arrival>=1440?'（隔日）':'')+'</span>';}
  else compare='此出發時間後，沒有可比較的直達班次。';
 }
 const warning=[isT&&r.turnback?'折返需另購超出區間的車票':'',isT&&r.dominated?'有更晚出發、同時或更早抵達的直達車':isT&&r.slow?'車程較長；已在第一班車上時可參考':''].filter(Boolean).join(' · ');
 const cars=r.legs.map(l=>carsText(l.cars)),carsNote=!cars.every(Boolean)?(result.official?'<small class="cars unknown">自由座車廂未公布</small>':''):'<small class="cars">'+(cars.length===1&&cars[0]==='全車自由座'?'全車自由座':'自由座 '+cars.map(c=>'<span>'+escapeHTML(c==='全車自由座'?'全車':c)+'</span>').join('｜'))+'</small>';
 return `<article class="route-card" data-id="${r.id}"><div class="card-main"><div class="card-type"><span class="badge ${slow?'slow':isT?'transfer':''}">${badge}</span><span class="train-nos">${isT?escapeHTML(r.first)+' → '+escapeHTML(r.second):escapeHTML(r.train)+' 車次'}</span><small>${isT?P.STATIONS[r.via]+(r.turnback?'折返':'轉乘'):'全程同一班車'}</small>${carsNote}</div><div class="journey"><div class="endpoint"><span class="time">${time(r.departure)}</span><span class="station-name">${origin}</span></div><div class="track"><div class="track-line">${isT?'<i class="change-dot"></i>':''}</div><span>${isT?'轉乘 '+r.wait+' 分鐘':'無需換車'}</span></div><div class="endpoint arrival"><span class="time">${time(r.arrival)}</span><span class="station-name">${dest}</span></div></div><div class="card-duration"><strong>${P.duration(r.duration)}</strong><span class="delta ${r.delta<0?'better':r.delta>=15?'worse':''}">${delta}</span></div></div><div class="comparison"><div class="comparison-text">${compare}${warning?'<span class="quick-warning">'+warning+'</span>':''}</div><button class="show-details" data-expand="${r.id}" type="button" aria-expanded="false" aria-controls="details-${r.id}">展開路線 ＋</button></div><div id="details-${r.id}" class="trip-details" hidden></div></article>`;
}
function render(){
 $('route-title').textContent=P.STATIONS[result.origin]+' → '+P.STATIONS[result.destination];
 $('route-subtitle').textContent=mdText(result.date)+'（週'+WEEK[result.day]+'）'+(result.official?' · 官方逐日時刻表（'+mdText(result.fetched)+' 更新）':result.date?' · 常態週時刻表，官方尚未公布該日班表':'')+' · '+$('after').value+(tmode==='arrive'?' 前抵達':' 起出發')+' · 轉乘至少 '+$('min-transfer').value+' 分鐘'+(result.fares&&result.fares.free?' · 單程自由座 NT$'+result.fares.free+'、標準 NT$'+result.fares.standard:'');
 $('benchmark').textContent=result.benchmark===null?'無直達車':P.duration(result.benchmark);
 $('benchmark-note').textContent=result.benchmark===null?'可參考轉乘方案':'全天最短 · '+result.benchmarkTrain+' 車次';
 const arrive=tmode==='arrive';$('earliest-label').textContent=arrive?'最晚出發方案':'最早抵達方案';
 const early=[...result.useful].sort(arrive?(a,b)=>b.departure-a.departure||a.duration-b.duration:(a,b)=>a.arrival-b.arrival||a.duration-b.duration)[0]||result.slower[0];
 $('earliest').textContent=early?P.hhmm(arrive?early.departure:early.arrival)+((arrive?early.departure:early.arrival)>=1440?' +1':''):'—';
 $('earliest-note').textContent=early?(early.type==='direct'?early.train:early.first+' → '+early.second)+' · '+P.duration(early.duration):'目前條件無班次';
 $('transfer-count').textContent=result.transfers.length+' 組';
 const rows=result.useful.filter(r=>mode==='all'||r.type===mode),slower=mode==='direct'?[]:result.slower;
 $('result-list').innerHTML=rows.slice(0,limit).map(r=>card(r)).join('');
 $('more').hidden=rows.length<=limit;$('more').textContent='顯示更多班次（還有 '+Math.max(0,rows.length-limit)+' 組）';
 $('slow-section').hidden=!slower.length;$('slow-count').textContent=slower.length+' 組';
 $('slow-list').innerHTML=slower.slice(0,slowLimit).map(r=>card(r,true)).join('');
 $('slow-more').hidden=slower.length<=slowLimit;
 $('empty').hidden=!!(rows.length||slower.length);
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
}
function details(r){return `<div class="legs">${r.legs.map((leg,i)=>{
 const a=leg.stops.findIndex(s=>s.i===leg.origin),b=leg.stops.findIndex(s=>s.i===leg.destination);const stops=leg.stops.slice(a,b+1).map(s=>P.STATIONS[s.i]).join(' → ');
 return `<div class="leg"><div class="leg-head"><span>${r.type==='transfer'?'第 '+(i+1)+' 段 · ':''}${escapeHTML(leg.train)} 車次</span><span>${P.duration(leg.arrival-leg.departure)}</span></div><p><span class="leg-time">${P.hhmm(leg.departure)}</span> ${P.STATIONS[leg.origin]}出發 → <span class="leg-time">${P.hhmm(leg.arrival)}</span> ${P.STATIONS[leg.destination]}抵達${leg.arrival>=1440?'（隔日）':''}</p><div class="stops">${stops}</div>${carsText(leg.cars)?'<p class="leg-cars">自由座車廂：'+escapeHTML(carsText(leg.cars))+'</p>':''}</div>`;}).join('')}</div><div class="operating-days">行駛日：${daysText(r.days)}${r.type==='transfer'?' · '+P.STATIONS[r.via]+'轉乘 '+r.wait+' 分鐘':''} · 抵達時間依目前選擇的日期顯示。</div>`;}
$('query-form').addEventListener('submit',e=>{e.preventDefault();query();const target=result.error?$('message'):$('results');target.scrollIntoView({behavior:'smooth',block:'start'});if(!result.error)toast('已更新：直達 '+result.direct.length+' 班、轉乘 '+result.transfers.length+' 組');});$('query-form').addEventListener('change',query);
$('swap').addEventListener('click',()=>{const x=$('origin').value;$('origin').value=$('destination').value;$('destination').value=x;query();});
$('sort').addEventListener('change',query);
$('more').addEventListener('click',()=>{limit+=10;render();});$('slow-more').addEventListener('click',()=>{slowLimit+=10;render();});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;limit=8;render();}));
$('results').addEventListener('click',e=>{const btn=e.target.closest('[data-expand]');if(!btn)return;const id=btn.dataset.expand,r=[...result.direct,...result.transfers].find(x=>x.id===id);const el=$('details-'+id);if(el.hidden){el.innerHTML=details(r);el.hidden=false;btn.textContent='收合路線 −';btn.setAttribute('aria-expanded','true');}else{el.hidden=true;btn.textContent='展開路線 ＋';btn.setAttribute('aria-expanded','false');}});
document.querySelectorAll('[data-tmode]').forEach(b=>b.addEventListener('click',()=>{setTmode(b.dataset.tmode);query();}));
$('now').addEventListener('click',()=>{const n=new Date();$('date').value=isoDate(n);$('after').value=clampTime(P.hhmm(n.getHours()*60+n.getMinutes()));setTmode('depart');mode='all';query();$('results').scrollIntoView({behavior:'smooth',block:'start'});});
$('preset-list').addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(!b)return;const [o,d]=b.dataset.route.split('-');$('origin').value=o;$('destination').value=d;mode='all';query();});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(permalink());toast('已複製查詢連結');}catch{toast('請複製瀏覽器網址列的查詢連結');}});
query();
