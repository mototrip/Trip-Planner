/* MotoTrip V9.18 — simple printable trip and bill report (local only). */
(()=>{'use strict';
 const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n)||0);
 $('print').addEventListener('click',()=>window.print());
 let state={};
 try{
  const scope=localStorage.getItem('mototrip-account-scope')||'guest',preview=JSON.parse(localStorage.getItem('mototrip-report-preview-v71')||'null');
  if(preview?.scope===scope&&Number.isFinite(preview.createdAt)&&Date.now()-preview.createdAt<15*60*1000&&Array.isArray(preview.state?.trips))state=preview.state;
  else{const key=scope.startsWith('uid-')?'mototrip-v1-'+scope:'mototrip-v1';state=JSON.parse(localStorage.getItem(key)||'{}');}
 }catch(e){console.error('MotoTrip report data unavailable',e);}
 const seenTripNames=new Set(),trips=(Array.isArray(state.trips)?state.trips:[]).filter(t=>{const k=String(t?.data?.name||'').trim().replace(/\s+/g,' ').toLocaleLowerCase();if(!k||seenTripNames.has(k))return false;seenTripNames.add(k);return true;}),g=state.split||{},expenses=Array.isArray(g.expenses)?g.expenses:[],members=Array.isArray(g.members)?g.members:[],transfers=Array.isArray(g.transfers)?g.transfers:[];
 const amount=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:0;};
 const cashCents=n=>fmt(amount(n)/100);
 const tripBudget=d=>{
  const km=amount(d.distance)*(d.round?2:1),fuel=d.includeFuel===false?0:(amount(d.mileage)>0?km/amount(d.mileage)*amount(d.price):0),hotel=amount(d.nights??Math.max(0,amount(d.days)-1))*amount(d.hotel),food=amount(d.days)*amount(d.food),toll=amount(d.toll),other=amount(d.extra);
  return {km,fuel,hotel,food,toll,other,total:fuel+hotel+food+toll+other};
 };
 const create=(tag,txt,cls)=>{const el=document.createElement(tag);if(txt!=null)el.textContent=txt;if(cls)el.className=cls;return el;};
 const table=(id,heads,rows)=>{
  const root=$(id);root.replaceChildren();if(!rows.length){root.append(create('p','No entries yet.','empty'));return;}
  const t=create('table'),head=t.createTHead(),r=head.insertRow();heads.forEach(v=>r.append(create('th',v)));
  const body=t.createTBody();for(const row of rows){const tr=body.insertRow();row.forEach(v=>tr.append(create('td',String(v??''))));}root.append(t);
 };
 $('report-subtitle').textContent=(trips.length===1?trips[0]?.data?.name:g.name||'Saved trips')+' · '+new Date().toLocaleDateString('en-IN');
 const summary=$('summary-cards');
 const total=expenses.reduce((n,e)=>n+amount(e.amount),0),planned=trips.reduce((n,t)=>n+tripBudget(t.data||{}).total,0);
 for(const [label,value] of [['Trips',String(trips.length)],['Planned',fmt(planned)],['Group spent',cashCents(total)],['Riders',String(members.length)]]){
  const card=create('div',null,'summary-stat');card.append(create('small',label),create('strong',value));summary.append(card);
 }
 const tripDetails=$('trip-cards');
 for(const t of trips){const d=t.data||{},v=tripBudget(d),card=create('article',null,'trip-overview');
  const heading=create('div',null,'trip-header'),title=create('div');title.append(create('h3',d.name||'Unnamed trip'),create('p',[d.from,d.to].filter(Boolean).join(' → ')));
  heading.append(title,create('strong',fmt(v.total),'trip-total'));card.append(heading);
  const meta=create('p',[`${v.km.toLocaleString('en-IN')} km`,d.round?'Return trip':'One-way',[d.departDate,d.endDate].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),'trip-meta');card.append(meta);
  const budget=create('div',null,'budget-mini-grid');
  for(const [name,val] of [['Fuel',v.fuel],['Hotel',v.hotel],['Food',v.food],['Toll',v.toll],['Other',v.other]]){
   const cell=create('div',null,'budget-mini');cell.append(create('small',name),create('strong',fmt(val)));budget.append(cell);
  }
  card.append(budget);tripDetails.append(card);
 }
 if(!trips.length)tripDetails.append(create('p','No saved trips yet.','empty'));
 const expensesSection=$('expenses-section');expensesSection.hidden=!expenses.length;
 table('expenses-table',['Expense','Paid by','Amount','Shared by'],expenses.map(e=>[e.name||'',e.payer||'',cashCents(e.amount),Array.isArray(e.people)?e.people.join(', '):'']));
 const rows=members.map(name=>({name,paid:0,share:0,net:0}));
 for(const e of expenses){const payer=rows.find(r=>r.name===e.payer),people=rows.filter(r=>Array.isArray(e.people)&&e.people.includes(r.name));if(!payer||!people.length)continue;const a=Math.round(amount(e.amount));payer.paid+=a;const q=Math.floor(a/people.length),rem=a%people.length;people.forEach((r,i)=>r.share+=q+(i<rem?1:0));}
 rows.forEach(r=>r.net=r.paid-r.share);
 for(const p of transfers){if(p.status==='unpaid')continue;const a=rows.find(r=>r.name===p.from),b=rows.find(r=>r.name===p.to);if(a&&b){a.net+=amount(p.amount);b.net-=amount(p.amount);}}
 $('riders-section').hidden=!rows.length;
 table('riders-table',['Rider','Paid','Share','Balance'],rows.map(r=>[r.name,cashCents(r.paid),cashCents(r.share),(r.net>0?'+':r.net<0?'−':'')+cashCents(Math.abs(r.net))]));
 $('payments-section').hidden=!transfers.length;
 table('payments-table',['From','To','Amount','Status'],transfers.map(p=>[p.from||'',p.to||'',cashCents(p.amount),p.status==='unpaid'?'Unpaid':'Paid']));
})()