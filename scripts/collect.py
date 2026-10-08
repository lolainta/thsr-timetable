#!/usr/bin/env python3
"""Fetch THSRC's official per-date timetable for the next four weeks and store it in data.json / dist/data.js.

Source A (preferred): TDX (tdx.transportdata.tw) THSR DailyTimetable, one request per date with every stop's arrival and
departure. Needs a free TDX account; set TDX_CLIENT_ID and TDX_CLIENT_SECRET (repo secrets in Actions).
Source B (fallback, no credentials): THSRC's website timetable query, one request per (origin, destination, date), so each
stop's arrival is explicit. Both answer for today through about today+28 days; the site falls back to the weekly regular
timetable for later dates. Usage: scripts/collect.py [--days N] [--raw fetched.json] [--rebuild raw.json]
"""
import concurrent.futures,datetime,json,os,sys,time,urllib.error,urllib.parse,urllib.request,zoneinfo
ROOT=__import__('pathlib').Path(__file__).resolve().parent.parent
CODES=['NanGang','TaiPei','BanQiao','TaoYuan','XinZhu','MiaoLi','TaiZhong','ZhangHua','YunLin','JiaYi','TaiNan','ZuoYing']
STARTS={'south':[0,1,6],'north':[11,6,10]}  # trains only originate at these stations
URL='https://www.thsrc.com.tw/TimeTable/Search'
TDX_IDS=['0990','1000','1010','1020','1030','1035','1040','1043','1047','1050','1060','1070']  # TDX StationID per station index

def tdx_token():
    body=urllib.parse.urlencode({'grant_type':'client_credentials','client_id':os.environ['TDX_CLIENT_ID'],'client_secret':os.environ['TDX_CLIENT_SECRET']}).encode()
    r=urllib.request.Request('https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',data=body)
    return json.load(urllib.request.urlopen(r,timeout=30))['access_token']

def fetch_tdx(dates):
    token=tdx_token();trips={}
    for date in dates:
        r=urllib.request.Request('https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/TrainDate/%s?$format=JSON'%date,headers={'Authorization':'Bearer '+token})
        for attempt in range(8):  # TDX throttles bursts with 429; back off and retry
            try:rows=json.load(urllib.request.urlopen(r,timeout=60));break
            except urllib.error.HTTPError as ex:
                if ex.code!=429:raise
                wait=int(ex.headers.get('Retry-After') or 0) or 5*(attempt+1);print(date,'429, waiting',wait,'s',file=sys.stderr);time.sleep(wait)
        else:raise SystemExit('TDX kept throttling')
        if not rows:print(date,'not published yet, stopping',file=sys.stderr);break
        for row in rows:
            info=row['DailyTrainInfo'];direction='south' if info['Direction']==0 else 'north'
            stops=sorted(row['StopTimes'],key=lambda x:x['StopSequence']);first=mins(stops[0]['DepartureTime']);out={}
            for k,st in enumerate(stops):
                arr=mins(st['ArrivalTime']);dep=mins(st['DepartureTime'])
                if arr<first-60:arr+=1440
                if dep<first-60:dep+=1440
                out[str(TDX_IDS.index(st['StationID']))]={'arr':arr,'dep':dep}
            trips[date+'|'+info['TrainNo'].lstrip('0')]={'direction':direction,'first':TDX_IDS.index(stops[0]['StationID']),'last':TDX_IDS.index(stops[-1]['StationID']),'stops':out}
        print(date,'fetched from TDX',len(rows),'trains',file=sys.stderr);time.sleep(1.5)
    return trips

def query(o,e,date):
    body=urllib.parse.urlencode({'SearchType':'S','Lang':'TW','StartStation':CODES[o],'EndStation':CODES[e],'OutWardSearchDate':date.replace('-','/'),'OutWardSearchTime':'00:00','ReturnSearchDate':date.replace('-','/'),'ReturnSearchTime':'00:00','DiscountType':''}).encode()
    for attempt in range(5):
        try:
            r=urllib.request.Request(URL,data=body,headers={'User-Agent':'Mozilla/5.0'})
            return json.load(urllib.request.urlopen(r,timeout=30))['data']['DepartureTable']['TrainItem']
        except Exception as ex:
            print('retry',o,e,date,ex,file=sys.stderr);time.sleep(5*(attempt+1))
    raise SystemExit('THSRC query kept failing')

def mins(s):h,m=map(int,s.split(':'));return h*60+m

def fetch(dates):
    trips={};n=0
    for date in dates:
        if not query(0,11,date):print(date,'not published yet, stopping',file=sys.stderr);break
        pairs=[(direction,o,e) for direction,origins in STARTS.items() for o in origins for e in (range(o+1,12) if direction=='south' else range(o-1,-1,-1))]
        with concurrent.futures.ThreadPoolExecutor(4) as pool:  # THSRC answers in ~3 s; a few parallel queries keep the run short
            results=list(pool.map(lambda p:query(p[1],p[2],date),pairs))
        for (direction,o,e),items in zip(pairs,results):
                    n+=1
                    for t in items:
                        if t['DepartureDate'] and t['DepartureDate'].replace('/','-')!=date[5:]:continue  # previous-night trains listed first
                        if not t['DepartureTime'] or not t['DestinationTime']:continue
                        tr=trips.setdefault(date+'|'+t['TrainNumber'].lstrip('0'),{'direction':direction,'stops':{}})
                        dep=mins(t['DepartureTime']);arr=mins(t['DestinationTime'])
                        if arr<dep:arr+=1440
                        served=[si for si in t['StationInfo'] if si['Show'] and si['DepartureTime']]
                        seq=sorted((int(si['StationNo'])-1 for si in served),reverse=direction=='north')
                        times={int(si['StationNo'])-1:mins(si['DepartureTime']) for si in served}
                        for i,d in times.items():
                            if d<times[seq[0]]:d+=1440  # stops are listed in travel order; a smaller time than the first stop means past midnight
                            tr['stops'].setdefault(str(i),{})['dep']=d
                        tr['stops'].setdefault(str(e),{})['arr']=arr
                        if seq[0]==o:tr['stops'].setdefault(str(o),{})['arr']=dep  # arrival at the first stop equals departure
                        tr['first'],tr['last']=seq[0],seq[-1]
        print(date,'fetched',n,'requests',len(trips),'date-trains',file=sys.stderr)
    return trips

def build(raw):
    groups={}
    for k,v in raw.items():
        date,no=k.split('|');no=no.lstrip('0');stops=[]
        for i in sorted(v['stops'],key=int,reverse=v['direction']=='north'):
            st=v['stops'][i];assert st.get('arr') is not None,(k,i)
            stops.append({'i':int(i),'dep':None if int(i)==v['last'] else st.get('dep'),'arr':st['arr']})
        groups.setdefault((no,v['direction'],json.dumps(stops)),[]).append(date)
    trips=[{'no':no,'direction':d,'dates':sorted(ds),'stops':json.loads(s)} for (no,d,s),ds in groups.items()]
    trips.sort(key=lambda t:(t['stops'][0]['dep'],t['no']))
    dates=sorted({d for k in raw for d in [k.split('|')[0]]})
    return {'fetched':dates[0] if dates else None,'from':dates[0],'to':dates[-1],'source':URL,'trips':trips}

if __name__=='__main__':
    args=sys.argv[1:];days=int(args[args.index('--days')+1]) if '--days' in args else 28
    if '--rebuild' in args:raw=json.load(open(args[args.index('--rebuild')+1]))
    else:
        today=datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Taipei')).date()
        dates=[(today+datetime.timedelta(days=i)).isoformat() for i in range(days+1)]
        raw=fetch_tdx(dates) if os.environ.get('TDX_CLIENT_ID') else fetch(dates)
        if '--raw' in args:json.dump(raw,open(args[args.index('--raw')+1],'w'))
    daily=build(raw);daily['fetched']=datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Taipei')).date().isoformat()
    data=json.load(open(ROOT/'data.json'));data['daily']=daily
    json.dump(data,open(ROOT/'data.json','w'),ensure_ascii=False)
    (ROOT/'dist'/'data.js').write_text('window.THSR_DATA='+json.dumps(data,ensure_ascii=False)+';')
    print('daily timetable',daily['from'],'to',daily['to'],len(daily['trips']),'trips',sum(len(t['dates']) for t in daily['trips']),'services')
