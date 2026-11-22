/* Printable report, entirely local: no external scripts or data requests. */
(()=>{'use strict';const $=id=>document.getElementById(id);$('print').onclick=()=>window.print();let s={};
try{
 const scope=localStorage.getItem('mototrip-account-scope')||'guest';
 const preview=JSON.parse(localStorage.getItem('mototrip-report-preview-v71')||'null');
 if(preview && preview.scope===scope && Number.isFinite(preview.createdAt) && Date.now()-preview.createdAt<15*60*1000 && Array.isArray(preview.state?.trips)){
   s=preview.state;
 }else{
   const key=scope.startsWith('uid-')?'mototrip-v1-'+scope:'mototrip-v1';
   s=JSON.parse(localStorage.getItem(key)||'{}');
 }
}catch(e){console.error('Could not read selected report data',e);} const g=s.split||{},trips=Array.isArray(s.trips)?s.trips:[],expenses=Array.isArray(g.expenses)?g.expenses:[],transfers=Array.isArray(g.transfers)?g.transfers:[],members=Array.isArray(g.members)?g.members:[];const fmt=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(n||0);$('report-subtitle').textContent=(g.name||s.draft?.name||'Trip report')+' · '+new Date().toLocaleDateString('en-IN');const total=expenses.reduce((n,e)=>n+(Number(e.amount)||0),0);$('overview').textContent=`${trips.length} trips  ·  ${members.length} riders  ·  ${expenses.length} expenses  ·  ${fmt(total/100)} total spending`;
function table(id,headers,rows){const area=$(id),t=document.createElement('table'),thead=t.createTHead(),h=thead.insertRow();for(const x of headers){const th=document.createElement('th');th.textContent=x;h.append(th);}const b=t.createTBody();for(const row of rows){const tr=b.insertRow();for(const v of row){const td=tr.insertCell();td.textContent=String(v??'');}}area.append(t);if(!rows.length){const msg=document.createElement('p');msg.className='muted';msg.textContent='No entries yet.';area.append(msg);}}
const val=n=>Number.isFinite(Number(n))?Number(n):0;
table('trips-table',['Name','From','To','Distance','Estimated budget'],trips.map(t=>{const d=t.data||{},km=val(d.distance)*(d.round?2:1),fuel=val(d.mileage)>0?km/val(d.mileage)*val(d.price):0,cost=fuel+val(d.nights)*val(d.hotel)+val(d.days)*val(d.food)+val(d.toll)+val(d.extra);return[d.name,d.from,d.to,km+' km',fmt(cost)];}));
// All saved cost fields are presented below, not only a blank report template.
const detailArea=$('trip-detail-table');
const detailHeaders=['Trip','Vehicle','Journey','Mileage','Petrol/L','Fuel','Hotel','Food','Toll','Other','Total','Departure','End'];
const detailRows=trips.map(t=>{const d=t.data||{},km=val(d.distance)*(d.round?2:1),fuel=val(d.mileage)>0?km/val(d.mileage)*val(d.price):0,hotel=val(d.nights??Math.max(0,val(d.days)-1))*val(d.hotel),food=val(d.days)*val(d.food),toll=val(d.toll),other=val(d.extra);return [d.name||'',t.bikeName||'',d.round?'Return':'One way',val(d.mileage)+' km/L',fmt(val(d.price)),fmt(fuel),fmt(hotel),fmt(food),fmt(toll),fmt(other),fmt(fuel+hotel+food+toll+other),[d.departDate,d.departTime].filter(Boolean).join(' '),[d.endDate,d.endTime].filter(Boolean).join(' ')];});
if(detailArea)table('trip-detail-table',detailHeaders,detailRows);
table('expenses-table',['Expense','Paid by','Share with','Amount'],expenses.map(e=>[e.name,e.payer,(e.people||[]).join(', '),fmt(val(e.amount)/100)]));
const balances=members.map(m=>({name:m,paid:0,share:0,net:0}));for(const e of expenses){const payer=balances.find(x=>x.name===e.payer),people=balances.filter(x=>(e.people||[]).includes(x.name));if(!payer||!people.length)continue;payer.paid+=val(e.amount);const q=Math.floor(val(e.amount)/people.length),r=val(e.amount)%people.length;people.forEach((p,i)=>p.share+=q+(i<r?1:0));}balances.forEach(x=>x.net=x.paid-x.share);for(const p of transfers){if(p.status==='unpaid')continue;const a=balances.find(x=>x.name===p.from),b=balances.find(x=>x.name===p.to);if(a&&b){a.net+=val(p.amount);b.net-=val(p.amount);}}
table('riders-table',['Rider','Paid','Share','Balance'],balances.map(x=>[x.name,fmt(x.paid/100),fmt(x.share/100),(x.net>=0?'+':'−')+fmt(Math.abs(x.net)/100)]));
table('payments-table',['From','To','Amount','Status','Date'],transfers.map(p=>[p.from,p.to,fmt(val(p.amount)/100),p.status==='unpaid'?'Unpaid':'Paid',p.date?new Date(p.date).toLocaleDateString('en-IN'):'']));})();
