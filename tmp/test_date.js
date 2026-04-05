const tz = 'Asia/Kolkata';
const tzOptions = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
const parts = new Intl.DateTimeFormat('en-US', tzOptions).formatToParts(new Date('2026-04-04T04:00:00Z'));
const p = {};
parts.forEach(({type, value}) => p[type] = value);

console.log('Parts:', p);
const todayDateStr = `${p.year}-${p.month}-${p.day}`;
console.log('todayDateStr:', todayDateStr);
console.log('Is "2026-04-04" === todayDateStr?', "2026-04-04" === todayDateStr);
console.log('Is "2026-04-04" < todayDateStr?', "2026-04-04" < todayDateStr);
