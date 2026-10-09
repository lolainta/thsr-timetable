const assert=require('node:assert/strict');
const data=require('./data.json');
const P=require('./dist/planner.js');
let n=0;const DIR=new Map(data.trips.map(t=>[t.no,t.direction]));
function check(o,a,b,dur,via){const r=P.search(data,{origin:1,destination:9,day:4,after:0,minTransfer:5,maxWait:30,...o});const t=r.transfers.find(t=>t.first===a&&t.second===b);assert.ok(t,`${a} → ${b} absent`);if(dur!==undefined)assert.equal(t.duration,dur);if(via!==undefined)assert.equal(t.via,via);n++;return [r,t];}
const [taipei,a]=check({},'153','673',77,6);assert.equal(a.wait,7);assert.equal(a.legs[0].arrival,19*60+18);assert.equal(a.arrival,19*60+48);
check({origin:2,destination:7,day:1},'203','803',64,6);
check({origin:2,destination:7,day:2},'203','803',66,6);
check({origin:2,destination:7,day:6},'1209','1307',66,6);
check({origin:2,destination:7,day:7},'1257','1331',66,6);
check({origin:4,destination:11,day:6},'813','117',78,6);
check({origin:4,destination:10,day:7},'809','207',69,6);
check({origin:4,destination:9,day:6},'805','1607',61,6);
check({origin:11,destination:1,day:7},'806','108',124,6);
// Turn-back: 彰化 → 板橋 by riding north past 板橋 to 台北, then back south; collapsed because a forward change is strictly better.
const [,tb]=check({origin:7,destination:2,day:1},'300','205',undefined,1);assert.ok(tb.turnback);assert.ok(tb.dominated&&tb.dominatedBy.second==='508');  // beaten by the forward change 300→508 at 桃園, which must itself be useful
assert.ok(check({origin:7,destination:2,day:1},'300','508')[1].legs[0].destination===3);assert.ok(P.search(data,{origin:7,destination:2,day:1,after:0}).useful.some(t=>t.first==='300'&&t.second==='508'));
let r=P.search(data,{origin:1,destination:9,day:4,after:0,minTransfer:8,maxWait:30});assert.ok(!r.transfers.some(t=>t.first==='153'&&t.second==='673'));n++;
r=P.search(data,{origin:2,destination:7,day:5,after:0,minTransfer:5,maxWait:10});assert.ok(!r.transfers.some(t=>t.first==='249'&&t.second==='1327'));n++;
assert.ok(taipei.slower.some(t=>t.first==='849'&&t.second==='673'));assert.ok(!taipei.useful.some(t=>t.first==='849'&&t.second==='673'));n++;
r=P.search(data,{origin:11,destination:0,day:7,after:21*60+40,minTransfer:5,maxWait:30});assert.equal(r.direct.find(t=>t.train==='1336').arrival,1445);n++;
assert.ok(P.search(data,{origin:2,destination:2,day:1}).error);n++;
assert.equal(data.trips.reduce((a,t)=>a+t.days.length,0),1134);
for(let day=1;day<=7;day++)for(let o=0;o<12;o++)for(let e=0;e<12;e++)if(o!==e){
 const x=P.search(data,{origin:o,destination:e,day,after:0,minTransfer:5,maxWait:30});
 for(const t of x.transfers){assert.ok(t.wait>=5&&t.wait<=30);assert.equal(t.turnback,DIR.get(t.first)!==DIR.get(t.second));assert.ok(t.arrival>t.departure);assert.equal(t.legs[0].destination,t.legs[1].origin);assert.ok(t.days.includes(day));}
 for(const t of x.slower){assert.ok(t.dominated||t.marginal);}
 // Frontier invariant: no useful row is beaten by another useful row on both departure and arrival.
 for(const t of x.useful)if(t.type==='transfer')for(const u of x.useful)if(u!==t)assert.ok(!(u.departure>=t.departure&&u.arrival<=t.arrival&&(u.departure>t.departure||u.arrival<t.arrival)),`${t.first}→${t.second} beaten by ${u.train||u.first+'→'+u.second}`);
 n++;
}
if(data.daily){const w=data.daily;assert.ok(w.trips.length>100);if(w.fares){assert.ok(Object.keys(w.fares).length>=66);for(const f of Object.values(w.fares))assert.ok(f.free>0&&f.standard>=f.free);}if(w.trips.some(t=>t.cars))assert.ok(w.trips.some(t=>t.cars&&t.cars.length));for(const t of w.trips){assert.ok(t.dates.every(d=>d>=w.from&&d<=w.to));assert.ok(t.stops[0].dep<1440);for(const s of t.stops)if(s.dep!==null)assert.ok(s.dep-s.arr>=0&&s.dep-s.arr<=10,`${t.no} dwell at ${s.i}`);for(let i=1;i<t.stops.length;i++)assert.ok(t.stops[i].arr>t.stops[i-1].arr);assert.equal(t.stops.at(-1).dep,null);}
 // National Day extra 3541 (台北 16:36 → 台中, 10/8–10/9) appears when the window covers it.
 if(w.from<='2026-10-09'&&w.to>='2026-10-09'){const r=P.search(data,{origin:1,destination:6,date:'2026-10-09',after:16*60});assert.ok(r.direct.some(t=>t.train==='3541'));assert.ok(!P.search(data,{origin:1,destination:6,date:'2026-10-12',after:16*60}).direct.some(t=>t.train==='3541'));}n++;}
// Arrive-by: every row arrives by the limit, and it is the same candidate set as depart-mode filtered by arrival.
{const by=20*60,a=P.search(data,{origin:1,destination:9,day:4,arriveBy:by,sort:'departure'}),b=P.search(data,{origin:1,destination:9,day:4,after:0});for(const r of [...a.direct,...a.transfers])assert.ok(r.arrival<=by);assert.equal(a.direct.length,b.direct.filter(r=>r.arrival<=by).length);assert.equal(a.transfers.length,b.transfers.filter(r=>r.arrival<=by).length);assert.ok(a.useful.every((r,i,x)=>i===0||x[i-1].departure>=r.departure));n++;}
console.log(`Passed ${n} route and boundary checks across all station pairs and all weekdays.`);
