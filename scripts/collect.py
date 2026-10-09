#!/usr/bin/env python3
"""Fetch THSRC's official per-date timetable for the next four weeks from TDX and store it in data.json / dist/data.js.

TDX's THSR DailyTimetable answers one request per date, with every stop's arrival and departure, for today through
about today+28 days (empty beyond that). Needs a free TDX account: set TDX_CLIENT_ID and TDX_CLIENT_SECRET.
Usage: scripts/collect.py [--days N]
"""
import datetime,json,os,sys,time,urllib.error,urllib.parse,urllib.request,zoneinfo
ROOT=__import__('pathlib').Path(__file__).resolve().parent.parent
STATION_IDS=['0990','1000','1010','1020','1030','1035','1040','1043','1047','1050','1060','1070']  # TDX StationID per station index
API='https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/TrainDate/%s?$format=JSON'

def mins(s):h,m=map(int,s.split(':'));return h*60+m

def token():
    body=urllib.parse.urlencode({'grant_type':'client_credentials','client_id':os.environ['TDX_CLIENT_ID'],'client_secret':os.environ['TDX_CLIENT_SECRET']}).encode()
    r=urllib.request.Request('https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',data=body)
    return json.load(urllib.request.urlopen(r,timeout=30))['access_token']

def fetch_day(date,bearer):
    r=urllib.request.Request(API%date,headers={'Authorization':'Bearer '+bearer})
    for attempt in range(8):  # TDX throttles bursts with 429; back off and retry
        try:return json.load(urllib.request.urlopen(r,timeout=60))
        except urllib.error.HTTPError as ex:
            if ex.code!=429:raise
            wait=int(ex.headers.get('Retry-After') or 0) or 5*(attempt+1);print(date,'429, waiting',wait,'s',file=sys.stderr);time.sleep(wait)
    raise SystemExit('TDX kept throttling')

def trip(row):
    info=row['DailyTrainInfo'];stops=[]
    seq=sorted(row['StopTimes'],key=lambda x:x['StopSequence']);first=mins(seq[0]['DepartureTime'])
    for k,st in enumerate(seq):
        arr=mins(st['ArrivalTime']);dep=mins(st['DepartureTime'])
        if arr<first-60:arr+=1440  # past midnight
        if dep<first-60:dep+=1440
        stops.append({'i':STATION_IDS.index(st['StationID']),'dep':None if k==len(seq)-1 else dep,'arr':arr})
    return info['TrainNo'].lstrip('0'),'south' if info['Direction']==0 else 'north',stops

def build(dates):
    bearer=token();groups={};fetched=[]
    for date in dates:
        rows=fetch_day(date,bearer)
        if not rows:print(date,'not published yet, stopping',file=sys.stderr);break
        for row in rows:
            no,direction,stops=trip(row)
            groups.setdefault((no,direction,json.dumps(stops)),[]).append(date)  # merge identical schedules across dates
        fetched.append(date);print(date,'fetched',len(rows),'trains',file=sys.stderr);time.sleep(1.5)
    trips=[{'no':no,'direction':d,'dates':sorted(ds),'stops':json.loads(s)} for (no,d,s),ds in groups.items()]
    trips.sort(key=lambda t:(t['stops'][0]['dep'],t['no']))
    return {'fetched':fetched[0],'from':fetched[0],'to':fetched[-1],'source':'https://tdx.transportdata.tw/ (THSR DailyTimetable)','trips':trips}

if __name__=='__main__':
    args=sys.argv[1:];days=int(args[args.index('--days')+1]) if '--days' in args else 28
    today=datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Taipei')).date()
    daily=build([(today+datetime.timedelta(days=i)).isoformat() for i in range(days+1)])
    data=json.load(open(ROOT/'data.json'));data['daily']=daily
    json.dump(data,open(ROOT/'data.json','w'),ensure_ascii=False)
    (ROOT/'dist'/'data.js').write_text('window.THSR_DATA='+json.dumps(data,ensure_ascii=False)+';')
    print('daily timetable',daily['from'],'to',daily['to'],len(daily['trips']),'trips',sum(len(t['dates']) for t in daily['trips']),'services')
