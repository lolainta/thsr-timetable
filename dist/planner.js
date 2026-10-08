(function(global){
'use strict';
const STATIONS=['南港','台北','板橋','桃園','新竹','苗栗','台中','彰化','雲林','嘉義','台南','左營'];
function hhmm(value){const v=((value%1440)+1440)%1440;return String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');}
function duration(value){return value>=60?Math.floor(value/60)+' 小時'+(value%60?' '+value%60+' 分':'') :value+' 分';}
function parseTime(value){const [h,m]=value.split(':').map(Number);return h*60+m;}
function search(data,opts){
 const {origin,destination,day}=opts;const after=opts.after??0,minTransfer=Math.max(5,opts.minTransfer??5),maxWait=opts.maxWait??30,slowThreshold=opts.slowThreshold??15;
 if(origin===destination)return {error:'請選擇不同的出發站與到達站。',direct:[],transfers:[],useful:[],slower:[]};
 const dir=origin<destination?'south':'north';
 const trips=data.trips.filter(t=>t.direction===dir&&t.days.includes(day));
 const directAll=[];
 for(const t of trips){const a=t.stops.find(s=>s.i===origin),b=t.stops.find(s=>s.i===destination);if(a&&b&&a.dep!==null&&b.arr>a.dep)directAll.push({id:'d'+t.no+'-'+a.dep,type:'direct',departure:a.dep,arrival:b.arr,duration:b.arr-a.dep,train:t.no,legs:[{train:t.no,origin,destination,departure:a.dep,arrival:b.arr}],days:t.operatingDays||t.days});}
 const benchmark=directAll.length?Math.min(...directAll.map(x=>x.duration)):null;
 const direct=directAll.filter(x=>x.departure>=after);
 const destTrips=trips.map(t=>({trip:t,end:t.stops.find(s=>s.i===destination)})).filter(x=>x.end);
 const map=new Map();
 for(const first of trips){
  const start=first.stops.find(s=>s.i===origin);if(!start||start.dep===null||start.dep<after)continue;
  const mids=first.stops.filter(s=>s.i!==origin&&s.i!==destination&&(dir==='south'?s.i>origin&&s.i<destination:s.i<origin&&s.i>destination));
  for(const mid of mids){
   for(const {trip:second,end} of destTrips){
    if(first.no===second.no)continue;
    const leave=second.stops.find(s=>s.i===mid.i);if(!leave||leave.dep===null)continue;
    const wait=leave.dep-mid.arr;if(wait<minTransfer||wait>maxWait||end.arr<=leave.dep)continue;
    const row={id:'t'+first.no+'-'+second.no+'-'+start.dep,type:'transfer',departure:start.dep,arrival:end.arr,duration:end.arr-start.dep,first:first.no,second:second.no,via:mid.i,wait,days:(first.operatingDays||first.days).filter(d=>(second.operatingDays||second.days).includes(d)),legs:[{train:first.no,origin,destination:mid.i,departure:start.dep,arrival:mid.arr},{train:second.no,origin:mid.i,destination,departure:leave.dep,arrival:end.arr}]};
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
 return {origin,destination,day,direct:direct.sort(sort),transfers:transfers.sort(sort),useful,slower,benchmark,benchmarkTrain:directAll.find(x=>x.duration===benchmark)?.train,trains:trips.length};
}
const api={STATIONS,hhmm,duration,parseTime,search};global.THSRPlanner=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
