(function(global){
'use strict';
const STATIONS=['南港','台北','板橋','桃園','新竹','苗栗','台中','彰化','雲林','嘉義','台南','左營'];
function hhmm(value){const v=((value%1440)+1440)%1440;return String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');}
function duration(value){return value>=60?Math.floor(value/60)+' 小時'+(value%60?' '+value%60+' 分':'') :value+' 分';}
function parseTime(value){const [h,m]=value.split(':').map(Number);return h*60+m;}
function search(data,opts){
 const {origin,destination}=opts;const date=opts.date||null;
 const day=date?(new Date(date+'T00:00:00').getDay()||7):opts.day;
 // Dates inside the fetched official window use the per-date timetable (holiday extras included); later dates fall back to the weekly one.
 const official=date&&data.daily&&date>=data.daily.from&&date<=data.daily.to?data.daily:null;
 const active=t=>official?t.dates.includes(date):t.days.includes(day);
 const shown=t=>t.dates||t.operatingDays||t.days;
 const after=opts.after??0,minTransfer=Math.max(5,opts.minTransfer??5),maxWait=opts.maxWait??30,slowThreshold=opts.slowThreshold??15;
 if(origin===destination)return {error:'請選擇不同的出發站與到達站。',direct:[],transfers:[],useful:[],slower:[]};
 const dir=origin<destination?'south':'north';
 const pool=official?official.trips:data.trips;
 const trips=pool.filter(t=>t.direction===dir&&active(t));
 const all=pool.filter(active);
 const directAll=[];
 for(const t of trips){const a=t.stops.find(s=>s.i===origin),b=t.stops.find(s=>s.i===destination);if(a&&b&&a.dep!==null&&b.arr>a.dep)directAll.push({id:'d'+t.no+'-'+a.dep,type:'direct',departure:a.dep,arrival:b.arr,duration:b.arr-a.dep,train:t.no,legs:[{train:t.no,origin,destination,departure:a.dep,arrival:b.arr}],days:shown(t)});}
 const benchmark=directAll.length?Math.min(...directAll.map(x=>x.duration)):null;
 const direct=directAll.filter(x=>x.departure>=after);
 // Second leg may run either direction: a train that overshoots to 左營 and turns back counts too.
 const destTrips=all.map(t=>({trip:t,endAt:t.stops.findIndex(s=>s.i===destination)})).filter(x=>x.endAt>=0).map(x=>({...x,end:x.trip.stops[x.endAt]}));
 const map=new Map();
 for(const first of all){
  const startAt=first.stops.findIndex(s=>s.i===origin),start=first.stops[startAt];if(!start||start.dep===null||start.dep<after)continue;
  // Change at any later stop; stop scanning once the first train reaches the destination itself (that is the direct train).
  const mids=[];for(const s of first.stops.slice(startAt+1)){if(s.i===destination)break;mids.push(s);}
  for(const mid of mids){
   for(const {trip:second,end,endAt} of destTrips){
    if(first.no===second.no)continue;
    const leaveAt=second.stops.findIndex(s=>s.i===mid.i),leave=second.stops[leaveAt];if(leaveAt<0||leaveAt>=endAt||leave.dep===null)continue;
    const wait=leave.dep-mid.arr;if(wait<minTransfer||wait>maxWait||end.arr<=leave.dep)continue;
    const row={id:'t'+first.no+'-'+second.no+'-'+start.dep,type:'transfer',departure:start.dep,arrival:end.arr,duration:end.arr-start.dep,first:first.no,second:second.no,via:mid.i,wait,turnback:first.direction!==second.direction,days:shown(first).filter(d=>shown(second).includes(d)),legs:[{train:first.no,origin,destination:mid.i,departure:start.dep,arrival:mid.arr},{train:second.no,origin:mid.i,destination,departure:leave.dep,arrival:end.arr}]};
    const old=map.get(row.id);
    // One train pair can connect at several stops; prefer Taichung, then the larger buffer.
    if(!old||(row.via===6&&old.via!==6)||(row.via===old.via&&row.wait>old.wait)||(row.via!==6&&old.via!==6&&row.wait>old.wait))map.set(row.id,row);
   }
  }
 }
 const transfers=[...map.values()];
 for(const r of [...direct,...transfers]){
  r.delta=benchmark===null?null:r.duration-benchmark;
  if(r.type==='transfer'){
   const next=directAll.filter(x=>x.departure>=r.departure).sort((a,b)=>a.arrival-b.arrival||a.departure-b.departure)[0];
   r.nextDirect=next?{train:next.train,departure:next.departure,arrival:next.arrival,duration:next.duration}:null;
   r.arrivalGain=next?next.arrival-r.arrival:null;
   r.slow=r.delta!==null&&r.delta>=slowThreshold;
   r.dominated=directAll.some(d=>d.departure>=r.departure&&d.arrival<=r.arrival&&d.duration<=r.duration);
  }
 }
 const sort=opts.sort==='duration'?(a,b)=>a.duration-b.duration||a.arrival-b.arrival||a.departure-b.departure:(a,b)=>a.arrival-b.arrival||a.duration-b.duration||(a.type==='direct'?-1:1);
 const slower=transfers.filter(t=>t.slow||t.dominated).sort(sort);
 const useful=[...direct,...transfers.filter(t=>!t.slow&&!t.dominated)].sort(sort);
 return {origin,destination,day,date,official:!!official,fetched:data.daily?data.daily.fetched:null,window:data.daily?[data.daily.from,data.daily.to]:null,direct:direct.sort(sort),transfers:transfers.sort(sort),useful,slower,benchmark,benchmarkTrain:directAll.find(x=>x.duration===benchmark)?.train,trains:trips.length};
}
const api={STATIONS,hhmm,duration,parseTime,search};global.THSRPlanner=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
