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
// Turn-back: 彰化 → 板橋 by riding north past 板橋 to 台北, then back south.
const [,tb]=check({origin:7,destination:2,day:1},'300','205',undefined,1);assert.ok(tb.turnback);assert.ok(!tb.slow&&!tb.dominated);
let r=P.search(data,{origin:1,destination:9,day:4,after:0,minTransfer:8,maxWait:30});assert.ok(!r.transfers.some(t=>t.first==='153'&&t.second==='673'));n++;
r=P.search(data,{origin:2,destination:7,day:5,after:0,minTransfer:5,maxWait:10});assert.ok(!r.transfers.some(t=>t.first==='249'&&t.second==='1327'));n++;
assert.ok(taipei.slower.some(t=>t.first==='849'&&t.second==='673'));assert.ok(!taipei.useful.some(t=>t.first==='849'&&t.second==='673'));n++;
r=P.search(data,{origin:11,destination:0,day:7,after:21*60+40,minTransfer:5,maxWait:30});assert.equal(r.direct.find(t=>t.train==='1336').arrival,1445);n++;
assert.ok(P.search(data,{origin:2,destination:2,day:1}).error);n++;
assert.equal(data.trips.reduce((a,t)=>a+t.days.length,0),1134);
for(let day=1;day<=7;day++)for(let o=0;o<12;o++)for(let e=0;e<12;e++)if(o!==e){
 const x=P.search(data,{origin:o,destination:e,day,after:0,minTransfer:5,maxWait:30});
 for(const t of x.transfers){assert.ok(t.wait>=5&&t.wait<=30);assert.equal(t.turnback,DIR.get(t.first)!==DIR.get(t.second));assert.ok(t.arrival>t.departure);assert.equal(t.legs[0].destination,t.legs[1].origin);assert.ok(t.days.includes(day));}
 for(const t of x.slower){assert.ok(t.slow||t.dominated);}
 for(const t of x.useful){assert.ok(!t.slow&&!t.dominated);}
 n++;
}
console.log(`Passed ${n} route and boundary checks across all station pairs and all weekdays.`);
