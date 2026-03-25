// App modularizada desde indextest.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, where, orderBy, deleteDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxUI4bJsQ2wVPz9SS8UkfIiFPxLC9YMmY",
  authDomain: "bus-externo-ucr.firebaseapp.com",
  projectId: "bus-externo-ucr",
  storageBucket: "bus-externo-ucr.firebasestorage.app",
  messagingSenderId: "295955223912",
  appId: "1:295955223912:web:e02626d38a8cb57cfd32dd"
};

// ── COORDENADAS HARDCODEADAS (nunca van a Firebase) ─────────────────────────
const STOP_COORDS = [
  { lat: 9.9361, lng: -84.0511 }, // Edificio de Generales UCR
  { lat: 9.9372, lng: -84.0501 }, // Super Tacho / BomBom
  { lat: 9.9388, lng: -84.0489 }, // Facultad de Agro. UCR
  { lat: 9.9401, lng: -84.0479 }, // Facultad de Letras UCR
  { lat: 9.9415, lng: -84.0468 }, // Radio U
  { lat: 9.9458, lng: -84.0441 }, // El Lagar
  { lat: 9.9499, lng: -84.0418 }, // Escuela San Blas
  { lat: 9.9538, lng: -84.0396 }, // Mall Don Pancho
  { lat: 9.9571, lng: -84.0375 }, // Entrada Barrio Los Ángeles
  { lat: 9.9601, lng: -84.0356 }, // Bar Biever
  { lat: 9.9628, lng: -84.0339 }, // Iglesia San Antonio
  { lat: 9.9651, lng: -84.0323 }, // Lubricentro San Antonio
  { lat: 9.9673, lng: -84.0308 }, // Ciclo F.B
  { lat: 9.9694, lng: -84.0293 }, // Frente a La Casona
  { lat: 9.9715, lng: -84.0278 }, // Antiguo Perrico
  { lat: 9.9735, lng: -84.0263 }, // Al lado de El Trapiche
  { lat: 9.9754, lng: -84.0249 }, // Mil Sabores
  { lat: 9.9771, lng: -84.0236 }, // Iglesia de Coronado
];

const DEFAULT_DATA = {
  stops: [
    { name: "Edificio de Generales UCR", offset: 0, lat: 9.9361, lng: -84.0511 },
    { name: "Super Tacho / BomBom", offset: 3, lat: 9.9372, lng: -84.0501 },
    { name: "Facultad de Agro. UCR", offset: 5, lat: 9.9388, lng: -84.0489 },
    { name: "Facultad de Letras UCR", offset: 7, lat: 9.9401, lng: -84.0479 },
    { name: "Radio U", offset: 9, lat: 9.9415, lng: -84.0468 },
    { name: "El Lagar", offset: 13, lat: 9.9458, lng: -84.0441 },
    { name: "Escuela San Blas", offset: 17, lat: 9.9499, lng: -84.0418 },
    { name: "Mall Don Pancho", offset: 21, lat: 9.9538, lng: -84.0396 },
    { name: "Entrada Barrio Los Ángeles", offset: 24, lat: 9.9571, lng: -84.0375 },
    { name: "Bar Biever", offset: 27, lat: 9.9601, lng: -84.0356 },
    { name: "Iglesia San Antonio", offset: 30, lat: 9.9628, lng: -84.0339 },
    { name: "Lubricentro San Antonio", offset: 33, lat: 9.9651, lng: -84.0323 },
    { name: "Ciclo F.B", offset: 36, lat: 9.9673, lng: -84.0308 },
    { name: "Frente a La Casona", offset: 39, lat: 9.9694, lng: -84.0293 },
    { name: "Antiguo Perrico", offset: 42, lat: 9.9715, lng: -84.0278 },
    { name: "Al lado de El Trapiche", offset: 45, lat: 9.9735, lng: -84.0263 },
    { name: "Mil Sabores", offset: 48, lat: 9.9754, lng: -84.0249 },
    { name: "Iglesia de Coronado", offset: 52, lat: 9.9771, lng: -84.0236 },  ],
  times: {
    "UCR-Coronado": ["08:00","09:10","10:10","13:10","15:10","16:10","17:10","18:10","19:10","21:30"],
    "Coronado-UCR": ["06:00","06:15","07:10","08:20","09:20","12:20","14:20","15:20","16:05","17:05","18:05"]
  },
  waGroups: []
};

const NOTIF_ICONS = { warning:'⚠️', alert:'🚨', info:'ℹ️' };

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

let appData        = null;
let reports        = [];
let notifications  = [];   // active notifications from Firestore
let currentDirection = 'UCR-Coronado';
let nearestStopIdx = -1;
let dismissedNotifs = new Set(JSON.parse(sessionStorage.getItem('dismissed')||'[]'));

// ── utils ───────────────────────────────────────────────────────────────────
const CR_TZ = 'America/Costa_Rica';
const nowMin   = () => { const n=new Date(); return n.getHours()*60+n.getMinutes(); };
const toMin    = t  => { const [h,m]=String(t).split(':').map(Number); return h*60+m; };
const fmtCD    = d  => d<=0?'Saliendo ahora':d<60?`En ${d} min`:`En ${Math.floor(d/60)}h${d%60>0?' '+d%60+'min':''}`;
const todayKey = () => new Intl.DateTimeFormat('en-CA',{timeZone:CR_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dirLabel = d  => d==='UCR-Coronado'?'UCR → Coronado':'Coronado → UCR';
const normText = v => String(v||'').replace(/\s+/g,' ').trim();
const clamp = (n,min,max) => Math.min(Math.max(n,min),max);
function localDateTimeInputValue(dateObj){
  const pad=n=>String(n).padStart(2,'0');
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth()+1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
}
function haversineKm(la1,lo1,la2,lo2) {
  const R=6371,dL=(la2-la1)*Math.PI/180,dG=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dG/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function migrateStopsWithCoords(rawStops=[]) {
  return rawStops.map((stop,i)=>({
    ...stop,
    lat: typeof stop.lat==='number' ? stop.lat : (STOP_COORDS[i]?.lat ?? null),
    lng: typeof stop.lng==='number' ? stop.lng : (STOP_COORDS[i]?.lng ?? null)
  }));
}
function getStopsForDirection(dir){
  const baseStops=(appData?.stops||[]).map((s,i)=>({ ...s, baseIdx:i }));
  if(dir==='UCR-Coronado') return baseStops;
  const totalOffset = baseStops.at(-1)?.offset || 0;
  return [...baseStops].reverse().map(s=>({ ...s, offset: totalOffset - (s.offset||0) }));
}
function getDirectionalIndexFromBase(dir, baseIdx){
  return getStopsForDirection(dir).findIndex(s=>s.baseIdx===baseIdx);
}
function sortAndUniqueTimes(times=[]){
  return [...new Set(times.filter(Boolean))].sort((a,b)=>toMin(a)-toMin(b));
}
function validateAppData(data){
  const errors=[];
  const names=new Set();
  let prevOffset=-1;
  (data.stops||[]).forEach((s,idx)=>{
    s.name = normText(s.name);
    if(!s.name) errors.push(`La parada ${idx+1} no tiene nombre`);
    const key=s.name.toLowerCase();
    if(names.has(key)) errors.push(`La parada "${s.name}" está repetida`);
    names.add(key);
    if(!Number.isFinite(Number(s.offset)) || Number(s.offset)<0) errors.push(`La parada "${s.name}" tiene un offset inválido`);
    s.offset = Number(s.offset);
    if(s.offset < prevOffset) errors.push(`Los offsets deben ir en orden ascendente. Revisá "${s.name}"`);
    prevOffset = s.offset;
    if((s.lat!==null && s.lat!==undefined && s.lat!=='') || (s.lng!==null && s.lng!==undefined && s.lng!=='')){
      if(!Number.isFinite(Number(s.lat)) || !Number.isFinite(Number(s.lng))) errors.push(`La parada "${s.name}" tiene coordenadas inválidas`);
      else { s.lat=Number(s.lat); s.lng=Number(s.lng); }
    } else {
      s.lat=null; s.lng=null;
    }
  });
  ['UCR-Coronado','Coronado-UCR'].forEach(dir=>{ data.times[dir]=sortAndUniqueTimes(data.times[dir]||[]); });
  data.waGroups=(data.waGroups||[]).map(x=>({name:normText(x.name),desc:normText(x.desc),link:normText(x.link)}));
  data.waGroups.forEach((g,idx)=>{
    if(!g.name) errors.push(`El grupo #${idx+1} no tiene nombre`);
    if(!/^https:\/\/(chat\.whatsapp\.com|wa\.me)\//i.test(g.link)) errors.push(`El link del grupo "${g.name||('#'+(idx+1))}" no parece válido de WhatsApp`);
  });
  return errors;
}

// ── BUS POSITION LOGIC ──────────────────────────────────────────────────────
function getNextBus(dir) {
  if (!appData) return null;
  const times=[...(appData.times[dir]||[])].sort();
  const now=nowMin();
  for (const t of times) { const m=toMin(t); if(m>=now) return {time:t,diff:m-now}; }
  return null;
}
function getPrevBus(dir) {
  if (!appData) return null;
  const times=[...(appData.times[dir]||[])].sort();
  const now=nowMin(); let prev=null;
  for (const t of times) { if(toMin(t)<now) prev=t; else break; }
  return prev;
}
function getReportsForPrev(dir) {
  const prev=getPrevBus(dir); if(!prev) return [];
  return reports.filter(r=>r.direction===dir&&r.departure===prev);
}
function getLatestReportForPrev(dir) {
  const dirStops=getStopsForDirection(dir);
  const dirReports=getReportsForPrev(dir)
    .map(r=>({ ...r, dirIdx: dirStops.findIndex(s=>s.baseIdx===r.stopIdx) }))
    .filter(r=>r.dirIdx>=0);
  if(!dirReports.length) return null;
  return dirReports.reduce((best,cur)=>cur.dirIdx>best.dirIdx?cur:best,dirReports[0]);
}

/**
 * Calculates estimated bus position index for the PREVIOUS bus in the selected direction.
 * Returns { stopIdx, isReal } where stopIdx is directional, not base.
 */
function getBusEstimatedPosition(dir) {
  const prev=getPrevBus(dir); if(!prev) return null;
  const stops=getStopsForDirection(dir); if(!stops.length) return null;
  const rep=getLatestReportForPrev(dir);
  const nowM=nowMin();
  const depM=toMin(prev);
  const elapsedSinceDep=Math.max(0, nowM-depM);

  if (rep) {
    const anchorOffset = stops[rep.dirIdx]?.offset ?? 0;
    const reportTimeM  = Number.isFinite(rep.reportedAtMin) ? rep.reportedAtMin : depM + anchorOffset;
    const elapsedSinceReport = Math.max(0, nowM - reportTimeM);
    let bestIdx = rep.dirIdx;
    for (let i=rep.dirIdx+1; i<stops.length; i++) {
      const addedTime = (stops[i].offset||0) - anchorOffset;
      if (elapsedSinceReport >= addedTime) bestIdx=i;
      else break;
    }
    return { stopIdx: clamp(bestIdx,0,stops.length-1), isReal: rep.dirIdx===bestIdx };
  }

  let bestIdx=0;
  for (let i=0; i<stops.length; i++) {
    if (elapsedSinceDep >= (stops[i].offset||0)) bestIdx=i;
    else break;
  }
  return { stopIdx: clamp(bestIdx,0,stops.length-1), isReal: false };
}

// ── NOTIFICATIONS ───────────────────────────────────────────────────────────
function subscribeNotifications() {
  const now = Date.now();
  // Listen to active (non-expired) notifications
  const q = query(collection(db,'notifications'), where('expiresAt','>',now), orderBy('expiresAt','asc'));
  onSnapshot(q, snap => {
    notifications = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderNotifBanner();
    renderNotifAdmin();
  });
}

function renderNotifBanner() {
  const banner=document.getElementById('notif-banner');
  // Find first non-dismissed active notification
  const active = notifications.find(n => !dismissedNotifs.has(n.id) && n.expiresAt > Date.now());
  if (!active) { banner.classList.remove('visible'); return; }

  const typeIcons = { warning:'⚠️', alert:'🚨', info:'ℹ️' };
  document.getElementById('notif-icon').textContent  = typeIcons[active.type]||'📢';
  document.getElementById('notif-title').textContent = active.title;
  document.getElementById('notif-msg').textContent   = active.message;
  const expDate = new Date(active.expiresAt);
  document.getElementById('notif-exp').textContent   = `Expira: ${expDate.toLocaleDateString('es-CR',{weekday:'short',month:'short',day:'numeric'})} ${expDate.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'})}`;
  banner.className = `notif-banner visible type-${active.type||'warning'}`;
  banner._currentId = active.id;
}

window.dismissNotif = function() {
  const banner=document.getElementById('notif-banner');
  if (banner._currentId) {
    dismissedNotifs.add(banner._currentId);
    sessionStorage.setItem('dismissed', JSON.stringify([...dismissedNotifs]));
  }
  // Try to show next notification if any
  renderNotifBanner();
};

// ── GPS ─────────────────────────────────────────────────────────────────────
window.requestGPS = function() {
  const btn=document.getElementById('gps-btn'),title=document.getElementById('gps-title'),sub=document.getElementById('gps-sub');
  btn.textContent='Buscando...'; btn.style.opacity='.6';
  if (!navigator.geolocation) { title.textContent='GPS no disponible'; btn.textContent='No disponible'; return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude:lat,longitude:lng}=pos.coords;
    const coords=(appData?.stops||[])
      .map((s,i)=>({baseIdx:i,lat:s.lat,lng:s.lng,name:s.name}))
      .filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng));
    if(!coords.length){
      title.textContent='Faltan coordenadas de paradas';
      sub.textContent='Agregalas desde Admin para usar GPS';
      btn.textContent='Sin datos'; btn.style.opacity='1';
      return;
    }
    let minDist=Infinity,nearestBaseIdx=coords[0].baseIdx,stopName=coords[0].name;
    coords.forEach((c)=>{ const d=haversineKm(lat,lng,c.lat,c.lng); if(d<minDist){minDist=d;nearestBaseIdx=c.baseIdx;stopName=c.name;} });
    nearestStopIdx=nearestBaseIdx;
    const distM=Math.round(minDist*1000);
    document.getElementById('nearest-name').textContent=stopName;
    document.getElementById('nearest-dist').textContent=distM<1000?`A ${distM} metros de vos`:`A ${minDist.toFixed(1)} km de vos`;
    document.getElementById('nearest-card').classList.add('visible');
    title.textContent=`Parada más cercana: ${stopName}`;
    sub.textContent=distM<1000?`A ${distM}m · toca para actualizar`:`A ${minDist.toFixed(1)}km · toca para actualizar`;
    btn.textContent='Actualizar'; btn.style.opacity='1';
    updateStops();
  }, err => {
    title.textContent='No se pudo obtener tu ubicación';
    sub.textContent=err.code===1?'Permiso denegado — activalo en tu navegador':'Intentá de nuevo';
    btn.textContent='Reintentar'; btn.style.opacity='1';
  }, {enableHighAccuracy:true,timeout:10000});
};

// ── FIREBASE ─────────────────────────────────────────────────────────────────
async function loadConfig() {
  try {
    const snap=await getDoc(doc(db,'config','schedule'));
    appData=snap.exists()?snap.data():JSON.parse(JSON.stringify(DEFAULT_DATA));
    appData.stops = migrateStopsWithCoords(appData.stops || DEFAULT_DATA.stops);
    if(!snap.exists()) await setDoc(doc(db,'config','schedule'),appData);
    if(!appData.waGroups) appData.waGroups=[];
  } catch(e) {
    appData=JSON.parse(JSON.stringify(DEFAULT_DATA));
    appData.stops = migrateStopsWithCoords(appData.stops || []);
    showAlert('Sin conexión — usando datos de ejemplo','info');
  }
  refreshHome(); renderSchedules(); renderWaGroups();
}

function subscribeReports() {
  try {
    const q=query(collection(db,'reports'),where('date','==',todayKey()));
    onSnapshot(q,snap=>{
      reports=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.reportedAt||0)-(a.reportedAt||0)).map(data=>({
        ...data,
        reportedAtMin: Number.isFinite(data.reportedAtMin)
          ? data.reportedAtMin
          : (Number.isFinite(data.reportedAt) ? new Date(data.reportedAt).getHours()*60 + new Date(data.reportedAt).getMinutes() : null)
      }));
      refreshHome(); renderReportHistory();
    });
  } catch(e){console.warn(e);}
}

// ── HOME ─────────────────────────────────────────────────────────────────────
function refreshHome() {
  if(!appData) return;
  updateBusProgress(); updateNextBus(); updateStops();
}

function updateBusProgress() {
  const card=document.getElementById('bus-progress-card');
  const prev=getPrevBus(currentDirection);
  if(!prev){
    card.innerHTML='';
    card.classList.remove('visible');
    return;
  }

  const stops=getStopsForDirection(currentDirection);
  const pos=getBusEstimatedPosition(currentDirection);
  if(!pos || !stops.length){
    card.innerHTML='';
    card.classList.remove('visible');
    return;
  }

  const currentStop=stops[pos.stopIdx] || null;
  const nextStop=stops[pos.stopIdx + 1] || null;
  const currentOffset=Number(currentStop?.offset || 0);
  const nextOffset=Number(nextStop?.offset || currentOffset);
  const routeEndOffset=Number(stops.at(-1)?.offset || 0);

  let progressOffset=currentOffset;
  if(nextStop){
    const rep=getLatestReportForPrev(currentDirection);
    const depM=toMin(prev);
    const reportMinute=(rep && Number.isFinite(rep.reportedAtMin)) ? rep.reportedAtMin : depM + currentOffset;
    const elapsedFromAnchor=Math.max(0, nowMin() - reportMinute);
    const segmentDuration=Math.max(1, nextOffset - currentOffset);
    const segmentFraction=clamp(elapsedFromAnchor / segmentDuration, 0, 1);
    progressOffset=currentOffset + (segmentDuration * segmentFraction);
  }

  const progressPercent=routeEndOffset > 0 ? clamp((progressOffset / routeEndOffset) * 100, 0, 100) : 0;
  const badgeClass=pos.isReal ? 'real' : 'estimated';
  const badgeText=pos.isReal ? 'Reportado' : 'Estimado';

  card.innerHTML=`
    <div class="bus-progress-head">
      <div class="bus-progress-title">🚌 Seguimiento bus que salió a las ${prev}</div>
      <div class="bus-progress-badge ${badgeClass}">${badgeText}</div>
    </div>
    <div class="bus-progress-sub">Última parada aprox.: <strong>${currentStop?.name || '—'}</strong></div>
    <div class="bus-progress-sub">Siguiente parada: <strong>${nextStop?.name || 'Final de ruta'}</strong></div>
    <div class="bus-progress-track-wrap">
      <div class="bus-progress-labels">
        <div><strong>${currentStop?.name || '—'}</strong></div>
        <div class="right"><strong>${nextStop?.name || 'Final de ruta'}</strong></div>
      </div>
      <div class="bus-progress-track">
        <div class="bus-progress-fill" style="width:${progressPercent}%;"></div>
        <div class="bus-progress-dot" style="left:${progressPercent}%;"></div>
        <div class="bus-progress-end"></div>
      </div>
    </div>
    <div class="bus-progress-footer">${pos.isReal ? '📍 Basado en un reporte reciente de usuarios' : '⚠️ Ubicación aproximada basada en tiempos y reportes de usuarios'}</div>
  `;
  card.classList.add('visible');
}

function updateNextBus() {
  const next=getNextBus(currentDirection);
  const el=document.getElementById('next-bus-content');
  if(!next){el.innerHTML=`<div class="no-bus">No hay más salidas hoy 🌙</div>`;return;}
  el.innerHTML=`<div class="next-time">${next.time}</div>
    <div class="next-info">${next.diff===0?'Saliendo ahora':'Próxima salida en '+next.diff+' min'}</div>
    <div class="countdown">${fmtCD(next.diff)}</div>`;
}

function updateStops() {
  const el=document.getElementById('stops-list');
  const stops=getStopsForDirection(currentDirection);
  if(!stops.length){el.innerHTML='';return;}

  const pos=getBusEstimatedPosition(currentDirection);
  el.innerHTML=stops.map((s,i)=>{
    const isNearest=s.baseIdx===nearestStopIdx;
    const busHere=pos && pos.stopIdx===i;
    const busPassed=pos && pos.stopIdx>i;
    let eta='';
    if (pos && pos.stopIdx < i) {
      const currentOffset=stops[pos.stopIdx]?.offset||0;
      const diff=(s.offset||0)-currentOffset;
      if (diff>=0) eta=diff===0?'Llegando':`~${diff} min`;
    }

    let circleClass='', circleContent=i+1, rowClass='', badge='';
    if (busHere && pos.isReal) {
      circleClass='bus-real'; circleContent='🚌';
      badge=`<span class="stop-bus-badge-real">🚌 Aquí ahora (reportado)</span>`;
      rowClass=' bus-here';
    } else if (busHere) {
      circleClass='bus-est'; circleContent='🚌';
      badge=`<span class="stop-bus-badge-est">🚌 Aquí aprox. (estimado)</span>`;
      rowClass=' bus-here';
    } else if (busPassed) {
      circleClass='passed'; circleContent='✓';
    } else if (isNearest) {
      circleClass='nearest'; circleContent='📍';
    }
    if (isNearest && !busHere) badge+=`<span class="stop-nearest-badge">Tu parada</span>`;
    if (eta) badge+=`<span class="stop-eta">${eta}</span>`;

    return `<div class="stop-row${rowClass}${isNearest&&!busHere?' nearest-highlight':''}">
      <div class="stop-left">
        <div class="stop-circle ${circleClass}">${circleContent}</div>
        <div class="stop-info">
          <div class="stop-name">${s.name}</div>
          ${badge?`<div class="stop-tags">${badge}</div>`:''}
        </div>
      </div>
      ${busPassed
        ?`<div class="report-btn passed-lbl">Ya pasó</div>`
        :`<button class="report-btn" onclick="window._report(${s.baseIdx})">Ya pasó aquí</button>`}
    </div>`;
  }).join('');
}

// ── REPORT ───────────────────────────────────────────────────────────────────
window._report = async function(stopIdx) {
  const prev=getPrevBus(currentDirection);
  if(!prev){showAlert('Aún no ha salido ningún bus hoy en esta dirección','info');return;}
  const baseStops=appData?.stops||[];
  const stopName=baseStops[stopIdx]?.name || '';
  if(!stopName){showAlert('Parada inválida','error');return;}

  const cooldownKey=`reportCooldown:${currentDirection}:${prev}:${stopIdx}`;
  const lastLocal=Number(localStorage.getItem(cooldownKey)||0);
  if(Date.now()-lastLocal < 90000){
    showAlert('Esperá un poco antes de volver a reportar esta misma parada','info');
    return;
  }
  const repeated = reports.some(r => r.direction===currentDirection && r.departure===prev && r.stopIdx===stopIdx && Math.abs((r.reportedAt||0)-Date.now()) < 120000);
  if(repeated){
    showAlert('Ya existe un reporte reciente para esta parada y este bus','info');
    return;
  }

  const userName=normText((prompt('¿Tu nombre o apodo? (podés dejarlo vacío)')||'').slice(0,30)) || 'Anónimo';
  try {
    await addDoc(collection(db,'reports'),{
      stopIdx, stopName,
      direction:currentDirection, departure:prev,
      userName, date:todayKey(), reportedAt:Date.now(),
      reportedAtMin: nowMin(),
      timestamp:new Date().toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'})
    });
    localStorage.setItem(cooldownKey,String(Date.now()));
    showAlert(`✅ Bus de las ${prev} — pasó por ${stopName}`,'success');
  } catch(e){showAlert('Error: '+e.message,'error');}
};

function renderReportHistory() {
  const el=document.getElementById('report-history-list');
  if(!reports.length){el.innerHTML='<div style="color:var(--muted);font-size:13px;padding:4px 0;">Sin reportes hoy 👆</div>';return;}
  el.innerHTML=reports.slice(0,8).map(r=>`
    <div class="report-item">
      <div><div class="ri-stop">${r.stopName}</div><div class="ri-sub">${dirLabel(r.direction)} · Bus ${r.departure} · ${r.userName}</div></div>
      <div class="ri-sub" style="white-space:nowrap;">${r.timestamp}</div>
    </div>`).join('');
}

// ── SCHEDULES ────────────────────────────────────────────────────────────────
function renderSchedules() {
  if(!appData) return;
  const now=nowMin();
  [['UCR-Coronado','sched-list-ucr'],['Coronado-UCR','sched-list-cor']].forEach(([dir,id])=>{
    const el=document.getElementById(id);
    const times=[...(appData.times[dir]||[])].sort();
    if(!times.length){el.innerHTML='<div style="padding:10px 13px;color:var(--muted);font-size:13px;">Sin horarios</div>';return;}
    const ni=times.findIndex(t=>toMin(t)>=now);
    el.innerHTML=times.map((t,i)=>{
      const past=toMin(t)<now,isNext=i===ni;
      const badge=isNext?'<span class="sched-badge badge-next">Próximo</span>':past?'<span class="sched-badge badge-past">Pasado</span>':'';
      return `<div class="sched-entry${past?' past':''}${isNext?' next-dep':''}"><span class="sched-time">${t}</span>${badge}</div>`;
    }).join('');
  });
}

// ── WA ────────────────────────────────────────────────────────────────────────
function renderWaGroups() {
  const el=document.getElementById('wa-list');
  const g=appData?.waGroups||[];
  if(!g.length){el.innerHTML=`<div class="wa-card"><div class="wa-empty">Aún no hay grupos.<br>El admin puede agregarlos ⚙️</div></div>`;return;}
  el.innerHTML=`<div class="wa-card">${g.map(x=>`
    <div class="wa-item">
      <div class="wa-left"><div class="wa-icon">💬</div>
        <div><div class="wa-name">${x.name}</div>${x.desc?`<div class="wa-desc">${x.desc}</div>`:''}</div>
      </div>
      <a class="wa-join" href="${x.link}" target="_blank" rel="noopener">Unirse</a>
    </div>`).join('')}</div>`;
}

// ── DIRECTION ────────────────────────────────────────────────────────────────
window.setDirection = function(dir) {
  currentDirection=dir;
  document.getElementById('btn-ucr').classList.toggle('active',dir==='UCR-Coronado');
  document.getElementById('btn-cor').classList.toggle('active',dir==='Coronado-UCR');
  refreshHome();
};

// ── VIEWS ────────────────────────────────────────────────────────────────────
window.showView = function(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  const map={home:'inicio',horarios:'horario',grupos:'grupos',admin:'admin'};
  document.querySelectorAll('.tab-btn').forEach(b=>{if(b.textContent.toLowerCase().includes(map[name]))b.classList.add('active');});
  if(name==='horarios') renderSchedules();
  if(name==='grupos')   renderWaGroups();
};

// ── ADMIN ACTIONS UI

window.lockAdmin = function() {
  showAdminAlert('No hay bloqueo de admin en esta versión','info');
};

// ── ADMIN RENDER ──────────────────────────────────────────────────────────────
function renderAdminContent() {
  if(!appData) return;
  document.getElementById('stops-admin-list').innerHTML=(appData.stops||[]).map((s,i)=>`
    <div class="stop-admin-row">
      <div class="stop-admin-num">${i+1}</div>
      <div class="stop-admin-name">${s.name}</div>
      <div class="stop-time-offset">+${s.offset}min${Number.isFinite(s.lat)&&Number.isFinite(s.lng)?` · GPS`:``}</div>
      <button class="btn-danger" onclick="window._rmStop(${i})">✕</button>
    </div>`).join('')||'<div style="color:var(--muted);font-size:13px;padding:6px 0;">Sin paradas</div>';
  renderChips('UCR-Coronado','times-ucr');
  renderChips('Coronado-UCR','times-cor');
  renderWaAdmin();
  renderNotifAdmin();
}
function renderChips(dir,id) {
  const el=document.getElementById(id);
  const times=[...(appData.times[dir]||[])].sort();
  el.innerHTML=times.length?times.map(t=>`<div class="time-chip">${t}<button onclick="window._rmTime('${dir}','${t}')">✕</button></div>`).join('')
    :'<div style="color:var(--muted);font-size:12px;padding:4px 0;">Sin horarios</div>';
}
function renderWaAdmin() {
  const el=document.getElementById('wa-admin-list');
  const g=appData.waGroups||[];
  el.innerHTML=g.length?g.map((x,i)=>`
    <div class="wa-admin-row">
      <div style="flex:1;min-width:0;"><div class="wa-admin-name">${x.name}</div><div class="wa-admin-link">${x.link}</div></div>
      <button class="btn-danger" onclick="window._rmWa(${i})">✕</button>
    </div>`).join(''):'<div style="color:var(--muted);font-size:13px;padding:6px 0;">Sin grupos</div>';
}
function renderNotifAdmin() {
  const el=document.getElementById('notif-admin-list');
  if(!notifications.length){el.innerHTML='<div style="color:var(--muted);font-size:13px;padding:6px 0;">Sin notificaciones activas</div>';return;}
  el.innerHTML=notifications.map(n=>{
    const exp=new Date(n.expiresAt);
    const expStr=`${exp.toLocaleDateString('es-CR',{month:'short',day:'numeric'})} ${exp.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'})}`;
    return `<div class="notif-admin-row">
      <div class="notif-admin-body">
        <div class="notif-admin-title">${NOTIF_ICONS[n.type]||'📢'} ${n.title}</div>
        <div class="notif-admin-meta">${n.message} · expira ${expStr}</div>
      </div>
      <button class="btn-danger" onclick="window._rmNotif('${n.id}')">✕</button>
    </div>`;
  }).join('');
}

// ── ADMIN ACTIONS ─────────────────────────────────────────────────────────────
window._rmStop  = i=>{ appData.stops.splice(i,1); renderAdminContent(); };
window._rmTime  = (dir,t)=>{ appData.times[dir]=appData.times[dir].filter(x=>x!==t); renderAdminContent(); };
window._rmWa    = i=>{ appData.waGroups.splice(i,1); renderAdminContent(); };
window._rmNotif = async id=>{
  try { await deleteDoc(doc(db,'notifications',id)); }
  catch(e){ showAdminAlert('Error: '+e.message,'error'); }
};

window.addStop = function() {
  const name=normText(document.getElementById('new-stop-name').value).slice(0,60);
  const offset=Number(document.getElementById('new-stop-offset').value);
  const latRaw=normText(document.getElementById('new-stop-lat').value);
  const lngRaw=normText(document.getElementById('new-stop-lng').value);
  if(!name){ showAdminAlert('Escribí un nombre de parada','error'); return; }
  if(!Number.isFinite(offset) || offset < 0){ showAdminAlert('El offset debe ser un número mayor o igual a 0','error'); return; }
  if((latRaw && !Number.isFinite(Number(latRaw))) || (lngRaw && !Number.isFinite(Number(lngRaw)))){ showAdminAlert('Latitud o longitud inválidas','error'); return; }
  if(appData.stops.some(s=>s.name.toLowerCase()===name.toLowerCase())){ showAdminAlert('Ya existe una parada con ese nombre','error'); return; }
  appData.stops.push({name,offset,lat:latRaw?Number(latRaw):null,lng:lngRaw?Number(lngRaw):null});
  appData.stops.sort((a,b)=>(a.offset||0)-(b.offset||0));
  document.getElementById('new-stop-name').value='';
  document.getElementById('new-stop-offset').value='';
  document.getElementById('new-stop-lat').value='';
  document.getElementById('new-stop-lng').value='';
  renderAdminContent();
};
window.addTime = function(dir) {
  const id=dir==='UCR-Coronado'?'new-time-ucr':'new-time-cor';
  const val=document.getElementById(id).value;
  if(!val) return;
  if(!appData.times[dir]) appData.times[dir]=[];
  if(!appData.times[dir].includes(val)) appData.times[dir].push(val);
  document.getElementById(id).value=''; renderAdminContent();
};
window.addWaGroup = function() {
  const name=document.getElementById('new-wa-name').value.trim();
  const desc=document.getElementById('new-wa-desc').value.trim();
  const link=document.getElementById('new-wa-link').value.trim();
  if(!name||!link){showAdminAlert('Nombre y link son requeridos','error');return;}
  if(!link.startsWith('http')){showAdminAlert('El link debe comenzar con https://','error');return;}
  if(!appData.waGroups) appData.waGroups=[];
  appData.waGroups.push({name,desc,link});
  document.getElementById('new-wa-name').value='';
  document.getElementById('new-wa-desc').value='';
  document.getElementById('new-wa-link').value='';
  renderAdminContent();
};

window.addNotif = async function() {
  const title=document.getElementById('new-notif-title').value.trim();
  const message=document.getElementById('new-notif-msg').value.trim();
  const type=document.getElementById('new-notif-type').value;
  const expVal=document.getElementById('new-notif-exp').value;
  if(!title||!message){showAdminAlert('Título y mensaje son requeridos','error');return;}
  if(!expVal){showAdminAlert('Especificá una fecha de expiración','error');return;}
  const expiresAt=new Date(expVal).getTime();
  if(expiresAt<=Date.now()){showAdminAlert('La fecha de expiración debe ser en el futuro','error');return;}
  try {
    await addDoc(collection(db,'notifications'),{
      title, message, type, expiresAt,
      createdAt: Date.now(),
      createdAtStr: new Date().toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'})
    });
    document.getElementById('new-notif-title').value='';
    document.getElementById('new-notif-msg').value='';
    showAdminAlert('✅ Notificación publicada — todos los usuarios la verán','success');
  } catch(e){ showAdminAlert('Error: '+e.message,'error'); }
};

window.saveAdmin = async function() {
  try {
    const cloned = JSON.parse(JSON.stringify(appData));
    const errors = validateAppData(cloned);
    if(errors.length){ showAdminAlert(errors[0],'error'); return; }
    appData = cloned;
    await setDoc(doc(db,'config','schedule'),appData);
    showAdminAlert('✅ Guardado — todos los usuarios ven los cambios','success');
    refreshHome(); renderSchedules(); renderWaGroups();
  } catch(e){ showAdminAlert('Error: '+e.message,'error'); }
};
window.clearReports = async function() {
  try {
    const q=query(collection(db,'reports'),where('date','==',todayKey()));
    const snap=await getDocs(q);
    await Promise.all(snap.docs.map(d=>deleteDoc(d.ref)));
    showAdminAlert('🗑️ Reportes del día eliminados','info');
  } catch(e){ showAdminAlert('Error: '+e.message,'error'); }
};

function showAdminAlert(msg,type) {
  const el=document.getElementById('admin-alert');
  el.innerHTML=`<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(()=>el.innerHTML='',5000);
}
function showAlert(msg,type) {
  const el=document.getElementById('alert-area');
  el.innerHTML=`<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(()=>el.innerHTML='',4000);
}

// ── CLOCK ─────────────────────────────────────────────────────────────────────
function updateClock() {
  const now=new Date();
  document.getElementById('big-clock').textContent=now.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  document.getElementById('live-time').textContent=now.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'});
  const d=now.toLocaleDateString('es-CR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  document.getElementById('clock-date').textContent=d.charAt(0).toUpperCase()+d.slice(1);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
updateClock();
setInterval(updateClock, 1000);
// Refresh home every minute (bus position moves)
setInterval(()=>{ refreshHome(); renderSchedules(); }, 60000);
// Check expired notifications every 2 minutes
setInterval(()=>{ renderNotifBanner(); }, 120000);



loadConfig();
subscribeReports();
subscribeNotifications();