#!/usr/bin/env python3
# Transforma verbenas.json -> fichas.json (esquema limpio v2): clasifica fecha, dedup,
# parsea programa en dailyProgram estructurado, ficha por evento + coverImage suggestedType.
# No inventa datos: marca needsReview donde hay dudas.
import json, re, unicodedata
from datetime import date, timedelta
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))

def nt(s):
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower()
    return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9: ]',' ',s)).strip()
def pdate(s):
    try: y,m,d=map(int,str(s).split('-')); return date(y,m,d)
    except: return None
MESES={1:'xaneiro',2:'febreiro',3:'marzo',4:'abril',5:'maio',6:'xuño',7:'xullo',8:'agosto',9:'setembro',10:'outubro',11:'novembro',12:'decembro'}
DIASEM=['Luns','Martes','Mércores','Xoves','Venres','Sábado','Domingo']
DIASEM_ES=['lun','mar','mié','jue','vie','sáb','dom']
MES_ES={1:'ene',2:'feb',3:'mar',4:'abr',5:'may',6:'jun',7:'jul',8:'ago',9:'sep',10:'oct',11:'nov',12:'dic'}

# ---------- categorías de items del programa ----------
def categoria(txt):
    t=nt(txt)
    if re.search(r'\bmisa|procesi|relixios|eucarist|ofrenda|santo|virx|patron',t): return 'relixioso'
    if re.search(r'fogo|fuego|pirotecn',t): return 'fogos'
    if re.search(r'vermu|aperitivo',t): return 'vermu'
    if re.search(r'churrasc|sardin|sardi|pulp|polb|empanada|degustaci|comida|cea|xantar|callos|mexill|carne|paella|filloa|marisco|tapas|cocido|porco|cochi|carneiro|lacon|ostra|queixo|polo|cervex',t): return 'comida'
    if re.search(r'verbena|orquestr?a|disco movil|baile|gran noite',t): return 'verbena'
    if re.search(r'charanga|pasacalle|pasarrua|pasarru|alborada|diana|gaita',t): return 'pasarrúas'
    if re.search(r'concert|recital|tributo|dj\b|festival',t): return 'concerto'
    if re.search(r'infantil|hinchable|nenos|inflable|escuma|espuma|magia|mago|touro mecanico',t): return 'infantil'
    if re.search(r'deport|carreira|trail|torneo|partido|regata|rapa|bestas|carrilana',t): return 'deportivo'
    if re.search(r'feira|mercado|artesan|exposici',t): return 'feira'
    return 'acto'

def extrae_artistas(txt, bandas):
    found=[]
    tn=nt(txt)
    for b in bandas or []:
        bn=nt(re.sub(r'^(orquestra?|orquesta|grupo|charanga|d[uú]o|tr[ií]o|disco m[oó]vil|solista|artista)\s+','',b,flags=re.I))
        if bn and len(bn)>=4 and bn in tn: found.append(b)
    return list(dict.fromkeys(found))

# ---------- parser de programa prosa -> dailyProgram ----------
MESNUM={'xaneiro':1,'enero':1,'febreiro':2,'febrero':2,'marzo':3,'abril':4,'maio':5,'mayo':5,'xuño':6,'junio':6,'xullo':7,'julio':7,'agosto':8,'setembro':9,'septiembre':9,'sept':9,'outubro':10,'octubre':10,'novembro':11,'noviembre':11,'decembro':12,'diciembre':12}
DAYHDR=re.compile(r'(?:^|[.;]\s+|\n)\s*((?:luns|martes|m[ée]rcores|xoves|venres|s[áa]bado|domingo|lunes|mi[ée]rcoles|jueves|viernes|d[ií]a|xov|ven|s[áa]b|dom)\.?\s*\d{1,2}[^:]{0,22}?):',re.I)
TIME=re.compile(r'(\d{1,2})[:\.](\d{2})\s*h?')
def _mes_en(txt):
    m=re.search(r'/(\d{1,2})\b',txt)  # 22/06
    if m and 1<=int(m.group(1))<=12: return int(m.group(1))
    for nm,n in MESNUM.items():
        if nm in txt.lower(): return n
    return None
def parse_programa(prog, start, end, bandas, year):
    if not prog: return [], None, None
    idxs=[(m.start(1),m.group(1).strip()) for m in DAYHDR.finditer(prog)]
    chunks=[]
    if len(idxs)>=2:
        for i,(pos,lab) in enumerate(idxs):
            nxt=idxs[i+1][0] if i+1<len(idxs) else len(prog)
            body=prog[pos:nxt][len(lab):].lstrip(' :')
            chunks.append((lab,body))
    else:
        chunks=[(None,prog)]
    days=[]; prevday=None; curmonth=(start.month if start else None)
    for lab,body in chunks:
        d=None; num=None
        mnum=re.search(r'(\d{1,2})',lab or '')
        if mnum: num=int(mnum.group(1))
        if num:
            mes=_mes_en(lab or '') or _mes_en(body[:40])
            if mes: curmonth=mes
            elif prevday is not None and num<prevday: curmonth=(curmonth%12)+1  # rollover de mes
            if curmonth:
                try: d=date(year,curmonth,num)
                except: d=None
            prevday=num
        items=[]; ts=list(TIME.finditer(body))
        if ts:
            for j,m in enumerate(ts):
                seg=body[m.end():(ts[j+1].start() if j+1<len(ts) else len(body))].strip(' .,-;')
                if not seg: continue
                items.append({'time':f"{int(m.group(1)):02d}:{m.group(2)}",'title':seg[:90].strip(),'category':categoria(seg),'artists':extrae_artistas(seg,bandas)})
        else:
            seg=body.strip(' .,-;')
            if seg: items.append({'time':None,'title':seg[:120].strip(),'category':categoria(seg),'artists':extrae_artistas(seg,bandas)})
        if not items: continue
        dl = (f"{DIASEM[d.weekday()]} {d.day}" if d else (lab or ''))
        days.append({'date':d.isoformat() if d else None,'dayLabel':dl,'items':items})
    pdates=[date.fromisoformat(x['date']) for x in days if x['date']]
    return days, (min(pdates).isoformat() if pdates else None), (max(pdates).isoformat() if pdates else None)

# ---------- clasificación de fecha ----------
def clasifica(v, start, end):
    nr=False; notes=[]
    if v.get('estado')=='recurrente': return 'recurring_event', nr, notes
    if not start: return ('needs_review', True, ['Sen data'])
    days=((end-start).days+1) if end else 1
    nm=nt(v.get('nombre'))+' '+nt(v.get('tipo'))
    if days==1: return 'one_day_event', nr, notes
    if 2<=days<=10: return 'multi_day_festival', nr, notes
    # rango largo: sospechoso salvo que sea programa de mes/festas do verán
    if re.search(r'festas do veran|programa|veran 20|festas patronais',nm) and days<=40:
        return 'monthly_program', True, [f'Rango de {days} días: revisar se é programa mensual']
    return 'needs_review', True, [f'Rango sospeitoso de {days} días']

def status_map(e):
    return {'confirmada':'confirmed','fija':'confirmed','estimada':'estimated','recurrente':'recurring','desconocida':'unconfirmed','fuera':'off_season'}.get(e,'unconfirmed')

def cover(v, kind):
    fc=v.get('fuenteCartel') or ''
    es_img=bool(re.search(r'\.(jpg|jpeg|png|webp)(\?|$)',fc,re.I))
    cur='' ; notes=''
    if v.get('fotoOrquesta'):
        cur='Usa foto/logo da orquestra cabeza' ; notes='Non usar logo de orquestra como portada salvo evento exclusivo desa orquestra.'
    if v.get('temCartel') and es_img: st='official_poster'
    elif kind=='festival': st='official_poster'
    elif v.get('fuegos') or v.get('imagenCat')=='fuegos': st='fireworks_photo'
    elif 'foliada' in nt(v.get('nombre')): st='foliada_traditional_photo'
    elif kind in ('gastronomica',) or v.get('comida'): st='food_popular_photo'
    elif kind=='rapa': st='town_photo'
    elif v.get('verbena'): st='generic_verbena_photo'
    else: st='neutral_placeholder'
    sugg = fc if (st=='official_poster' and es_img) else ''
    return {'currentImage': v.get('fotoOrquesta') or '', 'currentIssue':cur, 'suggestedType':st, 'suggestedImage':sugg, 'notes':notes}

def highlights(v, kind):
    h=[]
    if v.get('interesTuristico'): h.append(v['interesTuristico'] if len(v['interesTuristico'])<40 else 'Interés Turístico')
    if v.get('orquestaCabeza'): h.append(re.sub(r'^Orquesta ','',v['orquestaCabeza']))
    for c in (v.get('comida') or [])[:2]: h.append(c)
    if v.get('fuegos'): h.append('Fogos artificiais')
    if v.get('atracciones'): h.append('Atraccións')
    if v.get('fundacion'): h.append(f"Desde {v['fundacion']}")
    # dedup conservando orden, máx 5
    out=[]
    for x in h:
        if x and x not in out: out.append(x)
    return out[:5]

def servicios(v):
    s=list(v.get('servicios') or [])
    if v.get('fuegos'): s.append('Fogos artificiais')
    if v.get('atracciones'): s.append('Atraccións de feira')
    if v.get('aparcamiento'): s.append('Aparcamento')
    if v.get('procesion'): s.append('Procesión')
    if v.get('familiar'): s.append('Familiar')
    # unifica fogos/fuegos
    norm=[]; seen=set()
    for x in s:
        k=nt(x)
        k=re.sub(r'fuegos?( artificiales)?|fogos?( artificiais)?','fogos',k)
        if k in seen: continue
        seen.add(k); norm.append(x)
    return norm

KIND={'gastronomica':'gastronómica','rapa':'rapa das bestas','festival':'festival','feira':'feira','deportivo':'deportivo','tradicional':'tradicional','concierto':'concerto','verbena':'verbena','fiesta':'festa'}
_CONN={'la','las','el','los','o','a','os','as','do','da','de','del','dos','das','e','y'}
def tc(s):
    if not s or not s.isupper(): return s
    out=[]
    for w in s.split():
        lw=w.lower()
        if lw in _CONN: out.append(lw)
        elif len(w)<=3 and not (set(lw)&set('aeiou')): out.append(w)
        else: out.append(w.capitalize())
    r=' '.join(out); return r[0].upper()+r[1:] if r else r
def tclist(xs):
    seen=[];
    for x in xs or []:
        t=tc(x)
        if t not in seen: seen.append(t)
    return seen

ver=json.load(open(f'{BASE}/verbenas.json'))
fichas=[]
for v in ver:
    start=pdate(v.get('fechaInicio')); end=pdate(v.get('fechaFin')) or start
    kind=v.get('tipo') or 'verbena'
    etype, nr, notes = clasifica(v,start,end)
    if v.get('fechaOrientativa'): nr=True; notes=notes+['Data orientativa (anos anteriores ou estimada)']
    bandas=v.get('bandas') or []
    yr=start.year if start else 2026
    dp, pstart, pend = parse_programa(v.get('programa'), start, end, bandas, yr)
    # si el programa da su propio rango fiable, manda sobre el rango (corrige carteles fusionados/recortados)
    review_extra=[]
    if pstart and pend:
        ps,pe=date.fromisoformat(pstart),date.fromisoformat(pend)
        if start is None or ps!=start or pe!=end:
            # solo si el span del programa es razonable (<=12 días) y dentro de verano
            if (pe-ps).days<=12 and 5<=ps.month<=10:
                if start and abs((ps-start).days)>2: review_extra.append('Rango axustado ao programa do cartel')
                start, end = ps, pe
                v=dict(v); v['fechaInicio']=pstart; v['fechaFin']=pend
                # recalcular etiqueta
                if pstart==pend:
                    v['cuando']=f"{DIASEM_ES[ps.weekday()]} {ps.day} {MES_ES[ps.month]}"
                else:
                    v['cuando']=f"{ps.day} {MES_ES[ps.month]}–{pe.day} {MES_ES[pe.month]}"
            else:
                review_extra.append('Programa con varias fiestas/fechas: revisar')
    isfree = False if kind=='festival' else True
    f={
      'id':v['id'],
      'title':v.get('nombrePopular') or v.get('nombre'),
      'name':v.get('nombre'),
      'kind':KIND.get(kind,kind),
      'eventType':etype,
      'status':status_map(v.get('estado')),
      'startDate':v.get('fechaInicio'),
      'endDate':v.get('fechaFin') or v.get('fechaInicio'),
      'dateLabel':v.get('cuando'),
      'timeStart':v.get('horaInicio'),
      'location':{'municipality':v.get('concello'),'area':v.get('parroquia') or v.get('comarca') or '','venue':'','province':v.get('provincia'),
                  'coordinates':([v['lat'],v['lng']] if v.get('lat') is not None else None),'precision':v.get('precisionGeo')},
      'shortDescription':v.get('historia') or v.get('reclamo') or v.get('descripcion') or '',
      'longDescription':v.get('historiaLarga') or '',
      'highlights':tclist(highlights(v,kind)),
      'headliner':tc(re.sub(r'^Orquesta ','',v['orquestaCabeza']) if v.get('orquestaCabeza') else (bandas[0] if bandas else '')),
      'dailyProgram':dp,
      'artists':tclist(bandas),
      'pastArtists':tclist(v.get('bandasHistoricas') or []),
      'food':v.get('comida') or [],
      'services':servicios(v),
      'tradition':v.get('tradicion') or '',
      'tags':list(dict.fromkeys([KIND.get(kind,kind)]+([v['franja']] if v.get('franja') else [])+(['gratis'] if isfree else [])+(['destacada'] if v.get('destacada') else [])+(['interese turístico'] if v.get('interesTuristico') else []))),
      'isFree':isfree,
      'history':{'text':v.get('historicoTexto') or '', 'pastDates':v.get('historico',{}).get('anios') if isinstance(v.get('historico'),dict) else None},
      'coverImage':cover(v,kind),
      'sources':v.get('fuentesWeb') or [],
      'posterSource':v.get('fuenteCartel') or '',
      'hasOfficialProgram':bool(v.get('temCartel')),
      'cobertura':v.get('cobertura'),
      'search':v.get('busqueda'),
      'needsReview':nr or bool(review_extra),
      'reviewNotes':'; '.join(notes+review_extra),
    }
    fichas.append(f)
json.dump(fichas, open(f'{BASE}/fichas.json','w'), ensure_ascii=False, indent=1)
# lite para listado
LITE=['id','title','kind','eventType','status','startDate','endDate','dateLabel','timeStart','location','shortDescription','highlights','headliner','food','services','tags','isFree','coverImage','cobertura','hasOfficialProgram','needsReview','search']
lite=[{k:f.get(k) for k in LITE} for f in fichas]
json.dump(lite, open(f'{BASE}/fichas-lite.json','w'), ensure_ascii=False, separators=(',',':'))
from collections import Counter
print('fichas.json:',len(fichas))
print('eventType:',dict(Counter(f['eventType'] for f in fichas)))
print('con dailyProgram:',sum(1 for f in fichas if f['dailyProgram']))
print('needsReview:',sum(1 for f in fichas if f['needsReview']))
import os
print('tamaño fichas.json:',round(os.path.getsize(f'{BASE}/fichas.json')/1e6,1),'MB | lite:',round(os.path.getsize(f'{BASE}/fichas-lite.json')/1e6,1),'MB')
