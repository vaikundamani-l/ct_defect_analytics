/* Shared data engine: no DOM, no network, no generated records. */
(function(root){
'use strict';
const FIELDS=['Date','Barcode','Defect Name','Defect Spotting','Defect Location','Defect Area','Defect Group','Defect Resp','TBMDate','TBMTime','TBMMachine ID','TBM GT Code','Curing Tyre Size','Curing Date','Curing Time','Curing Machine ID'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const text=v=>v==null?'':String(v).trim();
function date(v,date1904=false){
 if(v==null||v==='')return null;
 function valid(y,m,d){const dt=new Date(Date.UTC(y,m-1,d));return y>=1900&&y<=9999&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?dt.toISOString().slice(0,10):null;}
 if(v instanceof Date)return isNaN(v)?null:valid(v.getUTCFullYear(),v.getUTCMonth()+1,v.getUTCDate());
 if(typeof v==='number'||/^\d{5}(\.\d+)?$/.test(text(v))){let n=Number(v);if(!Number.isFinite(n)||n<0||n>2958465)return null;if(!date1904&&Math.floor(n)===60)return null;const epoch=date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,31);const dt=new Date(epoch+(Math.floor(n)-(!date1904&&n>60?1:0))*86400000);return valid(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate());}
 const s=text(v);let m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);if(m)return valid(+m[1],+m[2],+m[3]);
 m=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})(?:[ T].*)?$/);if(m)return valid(+m[3]<100?2000+(+m[3]):+m[3],+m[2],+m[1]);
 m=s.match(/^(\d{1,2})[ -]([A-Za-z]+)[ ,\-]+(\d{4})$/);if(m){const mo=MONTHS.findIndex(x=>x.toLowerCase().startsWith(m[2].toLowerCase()));return mo<0?null:valid(+m[3],mo+1,+m[1]);}return null;
}
function time(v){if(typeof v==='number'){let seconds=Math.round(((v%1)+1)%1*86400)%86400;return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(x=>String(x).padStart(2,'0')).join(':');}return text(v);}
function shift(v){if(!v)return '';const s=text(v),m=s.match(/^(\d{1,2}):(\d{2})/);if(!m)return '';const h=+m[1];if(h>=6&&h<14)return 'Shift A (06-14)';if(h>=14&&h<22)return 'Shift B (14-22)';return 'Shift C (22-06)';}
function normalize(raw,date1904=false){const seen=new Set();let duplicates=0,invalidDates=0,missingDates=0,fallbackDates=0;const rows=[];for(let i=0;i<raw.length;i++){const r=raw[i],out={};FIELDS.forEach(f=>out[f]=text(r[f]));for(const f of ['TBMDate','Curing Date']){const parsed=date(r[f],date1904);out[f]=parsed||text(r[f]);}for(const f of ['TBMTime','Curing Time'])out[f]=time(r[f]);const primaryRaw=r.Date,fallbackRaw=r['Xray Date'],primaryDate=date(primaryRaw,date1904),fallbackDate=date(fallbackRaw,date1904),analysisDate=primaryDate||fallbackDate;if(!primaryDate&&fallbackDate)fallbackDates++;if(!analysisDate){if(text(primaryRaw)||text(fallbackRaw))invalidDates++;else missingDates++;}out.Date=primaryDate||text(primaryRaw)||(fallbackDate||text(fallbackRaw));out._analysisDate=analysisDate||'';out._year=analysisDate?analysisDate.slice(0,4):'';out._month=analysisDate?String(+analysisDate.slice(5,7)):'';out._day=analysisDate?String(+analysisDate.slice(8,10)):'';out._period=analysisDate?analysisDate.slice(0,7):'';out._shift=shift(out.TBMTime)||shift(out['Curing Time'])||'';out.Shift=out._shift;const key=JSON.stringify(FIELDS.map(f=>out[f]));if(seen.has(key)){duplicates++;continue;}seen.add(key);out._duplicate=false;out._id=rows.length;out._search=[...FIELDS.map(f=>out[f]),text(primaryRaw),text(fallbackRaw),out.Shift].join('\u0000').toLocaleLowerCase();rows.push(out);}return {rows,duplicates,invalidDates,missingDates,fallbackDates};}
function filter(rows,slicers={},charts={},query='',dedupe=true){const selections=[...Object.entries(slicers),...Object.entries(charts)].filter(([,v])=>v.size);const q=query.trim().toLocaleLowerCase();return rows.filter(r=>(!dedupe||!r._duplicate)&&(!q||r._search.includes(q))&&selections.every(([f,set])=>set.has(r[f])));}
function group(rows,field){const map=new Map();rows.forEach(r=>{if(r[field])map.set(r[field],(map.get(r[field])||0)+1);});return [...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],undefined,{numeric:true}));}
function kpis(rows){return [rows.length,...['Barcode','Defect Name','Defect Group','Defect Area','Defect Resp'].map(f=>new Set(rows.map(r=>r[f]).filter(Boolean)).size)];}
function months(rows,years){return [...new Set(rows.filter(r=>r._year&&(!years?.size||years.has(r._year))).map(r=>r._month))].sort((a,b)=>a-b);}
function comparison(rows,slicers,charts,query,dedupe){const ys=slicers._year;if(!ys||ys.size!==1||charts._period?.size||charts._year?.size)return null;const year=[...ys][0],prev=String(+year-1);let base=filter(rows,{...slicers,_year:new Set()},charts,query,dedupe);const a=new Set(base.filter(r=>r._year===year).map(r=>r._month));const b=new Set(base.filter(r=>r._year===prev).map(r=>r._month));const common=[...a].filter(m=>b.has(m));if(!common.length)return null;const cur=base.filter(r=>r._year===year&&common.includes(r._month)).length,prior=base.filter(r=>r._year===prev&&common.includes(r._month)).length;return prior?{year,prev,cur,prior,months:common.length,percent:(cur-prior)/prior*100}:null;}
function csv(rows,fields=FIELDS){const cell=v=>'"'+(/^[=+@\-\t\r]/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';return '\ufeff'+[fields,...rows.map(r=>fields.map(f=>r[f]))].map(r=>r.map(cell).join(',')).join('\r\n');}
function spc(rows){const dayCounts=group(rows,'_day');if(dayCounts.length<2)return null;const values=dayCounts.map(p=>p[1]),n=values.length,mean=values.reduce((a,b)=>a+b,0)/n,variance=values.reduce((sum,v)=>sum+Math.pow(v-mean,2),0)/(n-1||1),stdDev=Math.sqrt(variance),ucl=Math.round((mean+3*stdDev)*10)/10,lcl=Math.max(0,Math.round((mean-3*stdDev)*10)/10),uwl=Math.round((mean+2*stdDev)*10)/10,anomalies=dayCounts.filter(p=>p[1]>ucl).map(p=>({day:p[0],count:p[1]})),warnings=dayCounts.filter(p=>p[1]>uwl&&p[1]<=ucl).map(p=>({day:p[0],count:p[1]}));return {mean:Math.round(mean*10)/10,stdDev:Math.round(stdDev*10)/10,ucl,lcl,uwl,anomalies,warnings,dayMap:new Map(dayCounts)};}
function rootCause(rows,defectName){if(!rows.length)return null;const topDefects=group(rows,'Defect Name');if(!topDefects.length)return null;const target=defectName||topDefects[0][0],defectRows=rows.filter(r=>r['Defect Name']===target),defectCount=defectRows.length,totalInScope=rows.length,defectShare=totalInScope?+(defectCount/totalInScope*100).toFixed(1):0;const curingM=group(defectRows,'Curing Machine ID'),tbmM=group(defectRows,'TBMMachine ID'),areaG=group(defectRows,'Defect Area'),locG=group(defectRows,'Defect Location'),spotG=group(defectRows,'Defect Spotting'),sizeG=group(defectRows,'Curing Tyre Size'),gtG=group(defectRows,'TBM GT Code');return {defectName:target,defectCount,defectShare,topCuring:curingM[0]?{id:curingM[0][0],count:curingM[0][1],pct:+(curingM[0][1]/defectCount*100).toFixed(1)}:null,topTbm:tbmM[0]?{id:tbmM[0][0],count:tbmM[0][1],pct:+(tbmM[0][1]/defectCount*100).toFixed(1)}:null,topArea:areaG[0]?{name:areaG[0][0],count:areaG[0][1],pct:+(areaG[0][1]/defectCount*100).toFixed(1)}:null,topLoc:locG[0]?{name:locG[0][0],count:locG[0][1],pct:+(locG[0][1]/defectCount*100).toFixed(1)}:null,topSpot:spotG[0]?{angle:spotG[0][0],count:spotG[0][1],pct:+(spotG[0][1]/defectCount*100).toFixed(1)}:null,topSize:sizeG[0]?{size:sizeG[0][0],count:sizeG[0][1],pct:+(sizeG[0][1]/defectCount*100).toFixed(1)}:null,topGT:gtG[0]?{code:gtG[0][0],count:gtG[0][1],pct:+(gtG[0][1]/defectCount*100).toFixed(1)}:null,allDefects:topDefects.map(d=>d[0])};}
function heatmap(rows,machineField='TBMMachine ID',defectField='Defect Name',topMachines=10,topDefects=8){const machines=group(rows,machineField).slice(0,topMachines).map(p=>p[0]),defects=group(rows,defectField).slice(0,topDefects).map(p=>p[0]),matrix={};let maxVal=0;machines.forEach(m=>{matrix[m]={};defects.forEach(d=>{matrix[m][d]=0;});});rows.forEach(r=>{const m=r[machineField],d=r[defectField];if(m&&d&&matrix[m]&&matrix[m][d]!==undefined){matrix[m][d]++;if(matrix[m][d]>maxVal)maxVal=matrix[m][d];}});return {machines,defects,matrix,maxVal};}
function getTireZoneStats(rows){const counts={Crown:0,Shoulder:0,Sidewall:0,Bead:0,Innerliner:0,Other:0};rows.forEach(r=>{const t=((r['Defect Area']||'')+' '+(r['Defect Location']||'')).toLowerCase();if(t.includes('crown')||t.includes('tread'))counts.Crown++;else if(t.includes('shoulder'))counts.Shoulder++;else if(t.includes('sidewall'))counts.Sidewall++;else if(t.includes('bead'))counts.Bead++;else if(t.includes('inner')||t.includes('liner')||t.includes('carcass'))counts.Innerliner++;else counts.Other++;});const total=rows.length||1;return Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,{count:v,pct:+(v/total*100).toFixed(1)}]));}
/* ── trendBadges: Month-over-Month Trend Calculation ── */
function trendBadges(rows, slicers) {
 if (!rows || !rows.length) return null;
 var sl = slicers || {};
 var selectedMonth = sl._month && sl._month.size === 1 ? [...sl._month][0] : null;
 var selectedYear = sl._year && sl._year.size === 1 ? [...sl._year][0] : null;
 var curRows, prevRows;
 if (selectedMonth && selectedYear) {
  var curM = +selectedMonth, curY = +selectedYear;
  var prevM = curM === 1 ? 12 : curM - 1;
  var prevY = curM === 1 ? curY - 1 : curY;
  curRows = rows.filter(function(r){ return r._year === String(curY) && r._month === String(curM); });
  prevRows = rows.filter(function(r){ return r._year === String(prevY) && r._month === String(prevM); });
 } else if (selectedYear) {
  curRows = rows.filter(function(r){ return r._year === selectedYear; });
  prevRows = rows.filter(function(r){ return r._year === String(+selectedYear - 1); });
 } else {
  var periods = [...new Set(rows.map(function(r){ return r._period; }).filter(Boolean))].sort();
  if (periods.length < 2) return null;
  var curP = periods[periods.length - 1], prevP = periods[periods.length - 2];
  curRows = rows.filter(function(r){ return r._period === curP; });
  prevRows = rows.filter(function(r){ return r._period === prevP; });
 }
 if (!prevRows.length) return null;
 function pctChange(cur, prev) { return prev === 0 ? (cur > 0 ? 100 : 0) : +((cur - prev) / prev * 100).toFixed(1); }
 var curBarcodes = new Set(curRows.map(function(r){ return r.Barcode; }).filter(Boolean)).size;
 var prevBarcodes = new Set(prevRows.map(function(r){ return r.Barcode; }).filter(Boolean)).size;
 var curDefects = new Set(curRows.map(function(r){ return r['Defect Name']; }).filter(Boolean)).size;
 var prevDefects = new Set(prevRows.map(function(r){ return r['Defect Name']; }).filter(Boolean)).size;
 return {
  totalChange: pctChange(curRows.length, prevRows.length),
  barcodeChange: pctChange(curBarcodes, prevBarcodes),
  defectNameChange: pctChange(curDefects, prevDefects),
  curTotal: curRows.length,
  prevTotal: prevRows.length
 };
}

/* ── repeatOffenders: Repeat Offender Machine Detection ── */
function repeatOffenders(rows, machineField, topN) {
 machineField = machineField || 'TBMMachine ID';
 topN = topN || 10;
 if (!rows || !rows.length) return [];
 var pairMap = new Map(), defectTotals = new Map(), defectMachines = new Map();
 rows.forEach(function(r){
  var m = r[machineField], d = r['Defect Name'];
  if (!m || !d) return;
  var key = m + '\u0000' + d;
  pairMap.set(key, (pairMap.get(key) || 0) + 1);
  defectTotals.set(d, (defectTotals.get(d) || 0) + 1);
  if (!defectMachines.has(d)) defectMachines.set(d, new Set());
  defectMachines.get(d).add(m);
 });
 var results = [];
 pairMap.forEach(function(count, key){
  var parts = key.split('\u0000'), machine = parts[0], defect = parts[1];
  var numMachines = defectMachines.get(defect).size;
  var avgForDefect = numMachines > 0 ? defectTotals.get(defect) / numMachines : 0;
  if (avgForDefect > 0) {
   var ratio = +(count / avgForDefect).toFixed(2);
   if (ratio > 1) results.push({ machine: machine, defect: defect, count: count, avgForDefect: +avgForDefect.toFixed(1), ratio: ratio });
  }
 });
 return results.sort(function(a, b){ return b.ratio - a.ratio; }).slice(0, topN);
}

/* ── recurrence: Defect Recurrence Tracking ── */
function recurrence(rows) {
 if (!rows || !rows.length) return { recurring: [], totalRecurring: 0, recurringPct: 0 };
 var map = new Map();
 rows.forEach(function(r){
  var bc = r.Barcode, dn = r['Defect Name'];
  if (!bc || !dn) return;
  var key = bc + '\u0000' + dn;
  if (!map.has(key)) map.set(key, { barcode: bc, defect: dn, count: 0, dates: [] });
  var entry = map.get(key);
  entry.count++;
  if (r._analysisDate) entry.dates.push(r._analysisDate);
 });
 var recurring = [];
 map.forEach(function(entry){
  if (entry.count > 1) { entry.dates.sort(); recurring.push(entry); }
 });
 recurring.sort(function(a, b){ return b.count - a.count; });
 var totalBarcodes = new Set(rows.map(function(r){ return r.Barcode; }).filter(Boolean)).size;
 var totalRecurring = recurring.length;
 var recurringPct = totalBarcodes > 0 ? +((totalRecurring / totalBarcodes) * 100).toFixed(1) : 0;
 return { recurring: recurring, totalRecurring: totalRecurring, recurringPct: recurringPct };
}

/* ── machineHealth: Machine Health Score (0-100, lower = worse) ── */
function machineHealth(rows, machineField, topN) {
 machineField = machineField || 'TBMMachine ID';
 topN = topN || 20;
 if (!rows || !rows.length) return [];
 var machineMap = new Map();
 rows.forEach(function(r){
  var m = r[machineField];
  if (!m) return;
  if (!machineMap.has(m)) machineMap.set(m, { total: 0, uniqueDefects: new Set(), periodCounts: new Map() });
  var entry = machineMap.get(m);
  entry.total++;
  if (r['Defect Name']) entry.uniqueDefects.add(r['Defect Name']);
  if (r._period) entry.periodCounts.set(r._period, (entry.periodCounts.get(r._period) || 0) + 1);
 });
 var allTotals = [], allUniques = [];
 machineMap.forEach(function(e){ allTotals.push(e.total); allUniques.push(e.uniqueDefects.size); });
 var maxTotal = Math.max.apply(null, allTotals.concat([1]));
 var maxUnique = Math.max.apply(null, allUniques.concat([1]));
 function assignGrade(s) { if (s >= 80) return 'A'; if (s >= 60) return 'B'; if (s >= 40) return 'C'; if (s >= 20) return 'D'; return 'F'; }
 var results = [];
 machineMap.forEach(function(entry, machine){
  var totalDefects = entry.total, uniqueDefects = entry.uniqueDefects.size;
  var freqScore = (1 - totalDefects / maxTotal) * 100;
  var varietyScore = (1 - uniqueDefects / maxUnique) * 100;
  var trendScore = 50;
  var periods = [...entry.periodCounts.entries()].sort(function(a, b){ return a[0].localeCompare(b[0]); });
  if (periods.length >= 2) {
   var half = Math.floor(periods.length / 2);
   var firstHalf = periods.slice(0, half), secondHalf = periods.slice(half);
   var avgFirst = firstHalf.reduce(function(s, p){ return s + p[1]; }, 0) / firstHalf.length;
   var avgSecond = secondHalf.reduce(function(s, p){ return s + p[1]; }, 0) / secondHalf.length;
   if (avgFirst > 0) { var change = (avgSecond - avgFirst) / avgFirst; trendScore = Math.max(0, Math.min(100, 50 - change * 50)); }
  }
  var trendDir = trendScore > 55 ? 'improving' : trendScore < 45 ? 'worsening' : 'stable';
  var score = Math.max(0, Math.min(100, Math.round(freqScore * 0.4 + varietyScore * 0.3 + trendScore * 0.3)));
  results.push({ machine: machine, score: score, rank: 0, totalDefects: totalDefects, uniqueDefects: uniqueDefects, trend: trendDir, grade: assignGrade(score) });
 });
 results.sort(function(a, b){ return a.score - b.score; });
 results.forEach(function(r, i){ r.rank = i + 1; });
 return results.slice(0, topN);
}

/* ── paretoProgress: Pareto Progress Tracking ── */
function paretoProgress(rows, slicers) {
 if (!rows || !rows.length) return null;
 var sl = slicers || {};
 var selectedMonth = sl._month && sl._month.size === 1 ? [...sl._month][0] : null;
 var selectedYear = sl._year && sl._year.size === 1 ? [...sl._year][0] : null;
 var curRows, prevRows;
 if (selectedMonth && selectedYear) {
  var curM = +selectedMonth, curY = +selectedYear;
  var prevM = curM === 1 ? 12 : curM - 1, prevY = curM === 1 ? curY - 1 : curY;
  curRows = rows.filter(function(r){ return r._year === String(curY) && r._month === String(curM); });
  prevRows = rows.filter(function(r){ return r._year === String(prevY) && r._month === String(prevM); });
 } else if (selectedYear) {
  curRows = rows.filter(function(r){ return r._year === selectedYear; });
  prevRows = rows.filter(function(r){ return r._year === String(+selectedYear - 1); });
 } else {
  var periods = [...new Set(rows.map(function(r){ return r._period; }).filter(Boolean))].sort();
  if (periods.length < 2) return null;
  var curP = periods[periods.length - 1], prevP = periods[periods.length - 2];
  curRows = rows.filter(function(r){ return r._period === curP; });
  prevRows = rows.filter(function(r){ return r._period === prevP; });
 }
 if (!prevRows.length || !curRows.length) return null;
 var prevGroup = group(prevRows, 'Defect Name').slice(0, 5);
 var curGroupMap = new Map(group(curRows, 'Defect Name'));
 return prevGroup.map(function(pair){
  var defect = pair[0], prevCount = pair[1];
  var curCount = curGroupMap.get(defect) || 0;
  var change = prevCount > 0 ? +((curCount - prevCount) / prevCount * 100).toFixed(1) : 0;
  return { defect: defect, prevCount: prevCount, curCount: curCount, change: change, improved: curCount < prevCount };
 });
}

/* ── defectVelocity: Defect Velocity/Acceleration ── */
function defectVelocity(rows) {
 if (!rows || !rows.length) return [];
 var periodCounts = group(rows, '_period').sort(function(a, b){ return a[0].localeCompare(b[0]); });
 if (!periodCounts.length) return [];
 var results = periodCounts.map(function(pair, i){
  var prev = i > 0 ? periodCounts[i - 1][1] : null;
  var velocity = prev !== null ? pair[1] - prev : 0;
  return { period: pair[0], count: pair[1], velocity: velocity, acceleration: 0 };
 });
 for (var i = 1; i < results.length; i++) results[i].acceleration = results[i].velocity - results[i - 1].velocity;
 return results;
}

/* ── qualityScorecard: Factory Quality Index ── */
function qualityScorecard(rows) {
 if (!rows || !rows.length) return { score: 0, grade: 'F', factors: { machineSpread: 0, defectFocus: 0, processStability: 0 }, summary: 'No data available.' };
 var machineGroups = group(rows, 'TBMMachine ID').filter(function(p){ return p[0]; });
 var numMachines = machineGroups.length, machineSpread = 0;
 if (numMachines > 1) {
  var total = rows.filter(function(r){ return r['TBMMachine ID']; }).length || 1;
  var probs = machineGroups.map(function(p){ return p[1] / total; });
  var entropy = -probs.reduce(function(s, p){ return s + (p > 0 ? p * Math.log2(p) : 0); }, 0);
  var maxEntropy = Math.log2(numMachines);
  machineSpread = maxEntropy > 0 ? Math.round(entropy / maxEntropy * 100) : 0;
 }
 var uniqueDefects = new Set(rows.map(function(r){ return r['Defect Name']; }).filter(Boolean)).size;
 var defectFocus = uniqueDefects > 0 ? Math.round((1 - Math.min(uniqueDefects / rows.length, 1)) * 100) : 0;
 var processStability = 50;
 var spcResult = spc(rows);
 if (spcResult) {
  var totalDays = spcResult.dayMap.size, anomalyDays = spcResult.anomalies.length;
  processStability = totalDays > 0 ? Math.round((1 - anomalyDays / totalDays) * 100) : 50;
 }
 var score = Math.max(0, Math.min(100, Math.round(machineSpread * 0.35 + defectFocus * 0.35 + processStability * 0.30)));
 function assignGrade(s) { if (s >= 80) return 'A'; if (s >= 60) return 'B'; if (s >= 40) return 'C'; if (s >= 20) return 'D'; return 'F'; }
 var grade = assignGrade(score);
 var summaries = { A: 'Excellent quality performance. Defects are well-distributed and process is stable.', B: 'Good quality performance with minor areas for improvement.', C: 'Moderate quality concerns. Review machine concentration and defect patterns.', D: 'Significant quality issues detected. Immediate attention recommended.', F: 'Critical quality problems. Process review urgently needed.' };
 return { score: score, grade: grade, factors: { machineSpread: machineSpread, defectFocus: defectFocus, processStability: processStability }, summary: summaries[grade] };
}

/* ── weeklySummary: Weekly Summary Auto-Generation ── */
function weeklySummary(rows, slicers) {
 if (!rows || !rows.length) return { summary: 'No data available for the selected period.', highlights: [], period: '' };
 var sl = slicers || {};
 var selectedYear = sl._year && sl._year.size ? [...sl._year].join(', ') : '';
 var selectedMonth = sl._month && sl._month.size ? [...sl._month].map(function(m){ return MONTHS[+m - 1] || m; }).join(', ') : '';
 var period = [selectedMonth, selectedYear].filter(Boolean).join(' ') || 'All Data';
 var highlights = [];
 var totalRecords = rows.length;
 var uniqueBarcodes = new Set(rows.map(function(r){ return r.Barcode; }).filter(Boolean)).size;
 var topDefects = group(rows, 'Defect Name');
 if (topDefects.length) {
  var pct = ((topDefects[0][1] / totalRecords) * 100).toFixed(1);
  highlights.push({ icon: '\u26A0\uFE0F', text: 'Top defect: ' + topDefects[0][0] + ' (' + topDefects[0][1] + ' occurrences, ' + pct + '% of total)' });
 }
 var topMachines = group(rows, 'TBMMachine ID');
 if (topMachines.length) highlights.push({ icon: '\uD83C\uDFED', text: 'Most affected machine: ' + topMachines[0][0] + ' (' + topMachines[0][1] + ' defects)' });
 var spcResult = spc(rows);
 if (spcResult && spcResult.anomalies.length) {
  highlights.push({ icon: '\uD83D\uDCCA', text: spcResult.anomalies.length + ' day(s) exceeded upper control limit (UCL: ' + spcResult.ucl + ')' });
 } else if (spcResult) {
  highlights.push({ icon: '\u2705', text: 'All days within SPC control limits (mean: ' + spcResult.mean + '/day)' });
 }
 var trend = trendBadges(rows, sl);
 if (trend) {
  var word = trend.totalChange > 0 ? 'increase' : trend.totalChange < 0 ? 'decrease' : 'no change';
  highlights.push({ icon: trend.totalChange <= 0 ? '\uD83D\uDCC9' : '\uD83D\uDCC8', text: Math.abs(trend.totalChange) + '% ' + word + ' in defects vs previous period' });
 }
 if (topDefects.length >= 3) {
  var top3Count = topDefects.slice(0, 3).reduce(function(s, p){ return s + p[1]; }, 0);
  var top3Pct = ((top3Count / totalRecords) * 100).toFixed(1);
  highlights.push({ icon: '\uD83C\uDFAF', text: 'Top 3 defects account for ' + top3Pct + '% of all records' });
 }
 var summaryParts = ['Period: ' + period + '.', 'Total defect records: ' + totalRecords + ' across ' + uniqueBarcodes + ' unique barcodes.'];
 if (topDefects.length) summaryParts.push('Leading defect type is "' + topDefects[0][0] + '" with ' + topDefects[0][1] + ' occurrences.');
 if (spcResult) summaryParts.push('Daily average: ' + spcResult.mean + ' defects (\u03C3=' + spcResult.stdDev + ').');
 return { summary: summaryParts.join(' '), highlights: highlights, period: period };
}

/* ── groupByMulti: Sankey Diagram data (two-field grouping) ── */
function groupByMulti(rows, field1, field2) {
 if (!rows || !rows.length || !field1 || !field2) return { nodes: [], links: [] };
 var nodeSet = new Set(), linkMap = new Map();
 rows.forEach(function(r){
  var s = r[field1], t = r[field2];
  if (!s || !t) return;
  var sourceLabel = field1 + ':' + s, targetLabel = field2 + ':' + t;
  nodeSet.add(sourceLabel);
  nodeSet.add(targetLabel);
  var key = sourceLabel + '\u0000' + targetLabel;
  linkMap.set(key, (linkMap.get(key) || 0) + 1);
 });
 var nodes = [...nodeSet].map(function(n){
  var idx = n.indexOf(':');
  return { id: n, name: n.slice(idx + 1), group: n.slice(0, idx) };
 });
 var links = [];
 linkMap.forEach(function(value, key){
  var parts = key.split('\u0000');
  links.push({ source: parts[0], target: parts[1], value: value });
 });
 links.sort(function(a, b){ return b.value - a.value; });
 return { nodes: nodes, links: links };
}

const api={FIELDS,MONTHS,text,date,time,shift,normalize,filter,group,kpis,months,comparison,csv,spc,rootCause,heatmap,getTireZoneStats,trendBadges,repeatOffenders,recurrence,machineHealth,paretoProgress,defectVelocity,qualityScorecard,weeklySummary,groupByMulti};root.CTEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
