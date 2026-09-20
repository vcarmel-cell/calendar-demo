// Resets the demo database to a fresh, relative-dated sample: 5 calendars, appointments from 14 days
// back to 28 days ahead. Runs daily from .github/workflows/reset-demo.yml.
const KEY = 'AIzaSyApnp1xNJg-L2suwMjCxSfvaXEPXlDc5uM', PROJ = 'dmo-next1-cal';
const DB = `projects/${PROJ}/databases/(default)/documents`;
const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({returnSecureToken:true}) }).then(r=>r.json());
if (!auth.idToken) { console.error('anonymous sign-in failed', JSON.stringify(auth)); process.exit(1); }
const H = { Authorization: 'Bearer ' + auth.idToken, 'Content-Type': 'application/json' };

// deterministic pseudo-random so a re-run produces the same demo
let seed = 20260920; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)];

const DESIGNERS = [
  { id: '1', name: 'משה',     color: '#2E6F95' },
  { id: '2', name: 'תמר',     color: '#B4532A' },
  { id: '3', name: 'רחל',     color: '#3F7D58' },
  { id: '4', name: 'אלון',    color: '#8B4513' },
  { id: '5', name: 'התקנות',  color: '#55606E' },
];
const FIRST = ['דנה','יוסי','מיכל','אבי','נועה','רון','שירה','עמית','הילה','גיל','ליאת','אורי','טל','יעל','ניר','מור','עומר','קרן','דור','אילנה'];
const LAST  = ['כהן','לוי','מזרחי','פרץ','ביטון','אברהם','דהן','אזולאי','חזן','שמעון','גולן','ברק','סגל','נחום','אוחיון'];
const NOTES_DESIGN = ['פגישת ייעוץ ראשונית','בחירת חומרים וגוונים','הצגת הדמיה ללקוח','מדידות בשטח','התאמת תכנית עבודה','אישור הצעת מחיר','פגישת מעקב לפני ייצור','בחירת ידיות ואביזרים'];
const SUMMARY = ['הלקוח אישר את התכנון, ממתינים להצעת מחיר.','נבחרו חזיתות בגוון טבעי; נקבעה פגישת המשך.','נדרשו שינויים קלים בפריסה, יישלחו הדמיות מעודכנות.','הצעת המחיר אושרה, עוברים לייצור.','נמדדו כל הקירות; יש להתאים את גובה הארון העליון.'];
const STREETS = ['הרצל 14, אשדוד','ז׳בוטינסקי 3, אשקלון','הנרקיסים 21, רחובות','סוקולוב 7, נתניה','הגפן 8, יבנה','אלנבי 30, ראשון לציון','הנשיא 12, גדרה','הרימון 5, קרית מלאכי'];
const NOTES_INSTALL = ['התקנת מטבח מלא','התקנת חזיתות וידיות','התקנת ארון קיר','התקנת משטח עבודה','תיקון והתאמות אחרי התקנה'];

const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmt = m => `${pad(Math.floor(m/60))}:${pad(m%60)}`;
const str = v => ({ stringValue: v });

const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })); today.setHours(0,0,0,0);
async function wipe(collection) {
  const names = [];
  let pageToken = '';
  do {
    const r = await fetch(`https://firestore.googleapis.com/v1/${DB}/${collection}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`, { headers: H });
    const j = await r.json();
    if (j.error) throw new Error(collection + ': ' + JSON.stringify(j.error));
    for (const d of j.documents || []) names.push(d.name);
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  for (let i = 0; i < names.length; i += 400) {
    const r = await fetch(`https://firestore.googleapis.com/v1/${DB}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes: names.slice(i, i + 400).map(name => ({ delete: name })) }) });
    if (!r.ok) throw new Error('delete failed: ' + (await r.text()).slice(0, 300));
  }
  console.log('wiped', collection + ':', names.length);
}
await wipe('appointments');
await wipe('deleted_appointments');

const writes = [];
let phoneN = 1, count = 0;

writes.push({ update: { name: `${DB}/settings/designers`, fields: {
  list: { arrayValue: { values: DESIGNERS.map(d => ({ mapValue: { fields: { id: str(d.id), name: str(d.name), color: str(d.color) } } })) } },
  deletedList: { arrayValue: { values: [] } },
} } });

for (let off = -14; off <= 28; off++) {
  const day = new Date(today); day.setDate(today.getDate() + off);
  const dow = day.getDay();                      // 0 Sun .. 6 Sat
  if (dow === 6) continue;                       // no Saturday
  for (const d of DESIGNERS) {
    const install = d.name === 'התקנות';
    let n = dow === 5 ? (rnd() < 0.5 ? 1 : 0) : (install ? 1 + Math.floor(rnd()*2) : 2 + Math.floor(rnd()*3));
    let cursor = 8 * 60 + (rnd() < 0.5 ? 0 : 30);
    for (let i = 0; i < n; i++) {
      const dur = install ? 120 + 60*Math.floor(rnd()*3) : 45 + 15*Math.floor(rnd()*5);
      const maxEnd = dow === 5 ? 13*60 : 19*60;
      if (cursor + dur > maxEnd) break;
      const client = `${pick(FIRST)} ${pick(LAST)}`;
      const past = off < 0;
      const fields = {
        date: str(key(day)), designerId: str(d.id), clientName: str(client),
        phone: str(`050-000-${pad(Math.floor(phoneN/100)%100)}${pad(phoneN%100)}`.replace('050-000-','050-000') ),
        startTime: str(fmt(cursor)), endTime: str(fmt(cursor + dur)),
        address: str(install ? pick(STREETS) : ''),
        notes: str(install ? pick(NOTES_INSTALL) : pick(NOTES_DESIGN)),
        summary: str(past && rnd() < 0.6 ? pick(SUMMARY) : ''),
      };
      phoneN++;
      writes.push({ update: { name: `${DB}/appointments/demo${String(count).padStart(4,'0')}`, fields } });
      count++;
      cursor += dur + 15 * Math.floor(rnd() * 8);
    }
  }
}

for (let i = 0; i < writes.length; i += 400) {
  const r = await fetch(`https://firestore.googleapis.com/v1/${DB}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
  const j = await r.json();
  console.log('batch', i / 400 + 1, r.status, j.error ? JSON.stringify(j.error).slice(0, 300) : `${(j.writeResults || []).length} writes`);
  if (j.error) process.exit(1);
}
console.log('appointments seeded:', count);
