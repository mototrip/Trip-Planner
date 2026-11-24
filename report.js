/* MotoTrip V9.26 — printable report with full expense, settlement & budget analysis.
 * Report is generated entirely on the user's device. Never insert user strings as HTML. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const money=v=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0);
 const positive=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:0;};
 const cents=v=>money(positive(v)/100);
 const signMoney=v=>(v<0?'−':v>0?'+':'')+money(Math.abs(v));
 const create=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=String(text);if(cls)el.className=cls;return el;};
 const tripKey=n=>String(n||'').trim().replace(/\s+/g,' ').toLocaleLowerCase();
 const formatDate=(value,withTime=false)=>{
  if(!value)return '—';const date=new Date(value);if(!Number.isFinite(date.getTime()))return String(value).slice(0,22);
  return date.toLocaleString('en-IN',withTime?{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'short',year:'numeric'});
 };
 const table=(id,heads,rows,{empty='No records yet.',className=''}={})=>{
  const root=$(id);root.replaceChildren();
  if(!rows.length){root.append(create('p',empty,'empty'));return;}
  const t=create('table',null,className),head=t.createTHead(),tr=head.insertRow();
  heads.forEach(h=>tr.append(create('th',h)));
  const body=t.createTBody();
  rows.forEach(row=>{const r=body.insertRow();row.forEach(cell=>{
   const td=r.insertCell();
   if(cell&&typeof cell==='object'&&!Array.isArray(cell)){
    if(cell.className)td.className=cell.className;
    if(cell.lines){cell.lines.forEach((line,i)=>td.append(create(i?'small':'strong',line,i?'cell-secondary':'')));}
    else td.textContent=String(cell.text??'');
   }else td.textContent=String(cell??'');
  });});root.append(t);
 };
 // Snapshot prepared by exports.js. For older saved reports, use account-local saved data.
 let state={};
 try{
  const scope=localStorage.getItem('mototrip-account-scope')||'guest';
  const preview=JSON.parse(localStorage.getItem('mototrip-report-preview-v71')||'null');
  if(preview?.scope===scope&&Number.isFinite(preview.createdAt)&&Date.now()-preview.createdAt<15*60*1000&&Array.isArray(preview.state?.trips))state=preview.state;
  else{const key=scope.startsWith('uid-')?'mototrip-v1-'+scope:'mototrip-v1';state=JSON.parse(localStorage.getItem(key)||'{}');}
 }catch(e){console.error('MotoTrip report data unavailable',e);}
 const seen=new Set();
 const trips=(Array.isArray(state.trips)?state.trips:[]).filter(t=>{
  const k=tripKey(t?.data?.name);if(!k||seen.has(k))return false;seen.add(k);return true;
 });
 const group=state.split&&typeof state.split==='object'?state.split:{};
 const expenses=Array.isArray(group.expenses)?group.expenses:[];
 const members=Array.isArray(group.members)?group.members:[];
 const transfers=Array.isArray(group.transfers)?group.transfers:[];
 const isSingle=trips.length===1;
 const title=isSingle?trips[0]?.data?.name:trips.length?'All saved trips':group.name||'Saved trips';
 $('report-subtitle').textContent=title+' · '+new Date().toLocaleDateString('en-IN');
 $('report-scope').textContent=isSingle?'Selected saved trip · Group expenses and payments':
  'All saved trips · Group records are from the current expense group only';
 $('print').addEventListener('click',()=>window.print());

 const tripBudget=d=>{
  const km=positive(d.distance)*(d.round===true||d.round==='true'?2:1);
  const includeFuel=d.includeFuel!==false&&d.includeFuel!=='false';
  const fuel=includeFuel&&positive(d.mileage)>0?km/positive(d.mileage)*positive(d.price):0;
  const hotel=positive(d.nights??Math.max(0,positive(d.days)-1))*positive(d.hotel);
  const food=positive(d.days)*positive(d.food),toll=positive(d.toll),other=positive(d.extra);
  return {km,fuel,hotel,food,toll,other,total:fuel+hotel+food+toll+other};
 };
 const totals={km:0,fuel:0,hotel:0,food:0,toll:0,other:0,total:0};
 for(const trip of trips){const d=trip.data||{},v=tripBudget(d);
  Object.keys(totals).forEach(k=>totals[k]+=v[k]);
  const card=create('article',null,'trip-overview');
  const heading=create('div',null,'trip-header'),info=create('div');
  info.append(create('h3',d.name||'Unnamed trip'),create('p',[d.from,d.to].filter(Boolean).join(' → ')));
  heading.append(info,create('strong',money(v.total),'trip-total'));card.append(heading);
  card.append(create('p',[v.km.toLocaleString('en-IN')+' km',d.round===true||d.round==='true'?'Return trip':'One-way',
   [d.departDate,d.endDate].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),'trip-meta'));
  const grid=create('div',null,'budget-mini-grid');
  for(const [label,value] of [['Fuel',v.fuel],['Hotel',v.hotel],['Food',v.food],['Toll',v.toll],['Other',v.other]]){
   const item=create('div',null,'budget-mini');item.append(create('small',label),create('strong',money(value)));grid.append(item);
  }
  card.append(grid);$('trip-cards').append(card);
 }
 if(!trips.length)$('trip-cards').append(create('p','No saved trip found. Save your trip in Planner first.','empty'));

 // Exact category matching and validation from app.js renderBudget(); legacy invalid
 // records remain visible in FULL history but do not inflate paid/share balances.
 function category(name){
  const n=String(name||'').toLowerCase();
  return /toll|fastag/.test(n)?3:/hotel|stay|room|hostel|homestay|lodg|accommodation/.test(n)?0:
    /food|meal|breakfast|lunch|dinner|snack|restaurant|cafe|tea|coffee/.test(n)?1:
    /fuel|petrol|diesel|gasoline/.test(n)?2:4;
 }
 function validExpense(e){return Number.isSafeInteger(e.amount)&&e.amount>0&&members.includes(e.payer)&&
  Array.isArray(e.people)&&e.people.some(n=>members.includes(n));}
 const valid=expenses.filter(validExpense);
 const actual=[0,0,0,0,0],estimate=[totals.hotel,totals.food,totals.fuel,totals.toll,totals.other];
 for(const e of valid)actual[category(e.name)]+=e.amount/100;
 const spent=actual.reduce((a,b)=>a+b,0),remaining=totals.total-spent;
 for(const [label,value,cls] of [['Saved trips',String(trips.length),''],['Estimated',money(totals.total),''],['Actual spending',money(spent),''],['Riders',String(members.length),'']]){
  const item=create('div',null,'summary-stat');item.append(create('small',label),create('strong',value,cls));$('summary-cards').append(item);
 }

 // Budget vs actual, same names, amounts and category order as the Planner.
 const budgetCards=$('comparison-cards');
 for(const [label,value,cls] of [['Estimated',money(totals.total),''],['Actual',money(spent),''],[remaining<0?'Over budget':'Remaining',money(Math.abs(remaining)),remaining<0?'negative':'positive']]){
  const item=create('div',null,'comparison-stat');item.append(create('small',label),create('strong',value,cls));budgetCards.append(item);
 }
 const comparisonRows=['Hotel','Food','Fuel','Toll','Other'].map((label,i)=>[
  label,money(estimate[i]),money(actual[i]),{text:signMoney(estimate[i]-actual[i]),className:estimate[i]-actual[i]<0?'negative':'positive'}]);
 comparisonRows.push(['Total',money(totals.total),money(spent),{text:signMoney(remaining),className:remaining<0?'negative':'positive'}]);
 table('comparison-table',['Category','Estimate','Actual','Difference'],comparisonRows,{className:'comparison-table'});
 const pct=totals.total>0?spent/totals.total*100:null;
 $('budget-used').textContent='Budget used: '+(pct===null?'—':pct.toFixed(1)+'%');
 const bar=$('budget-progress');bar.max=100;bar.value=pct===null?(spent>0?100:0):Math.min(100,pct);
 if(!isSingle)$('budget-note').textContent='Estimate includes all saved trips; actual spending reflects only the current expense group.';
 else $('budget-note').textContent='Estimated costs come from the saved trip. Actuals come from its expense records.';

 // Contributions: same cents rounding (quotient & remainder) as Bill Split.
 const rows=members.map(name=>({name,paid:0,share:0,net:0}));
 for(const e of valid){
  const payer=rows.find(r=>r.name===e.payer),people=rows.filter(r=>e.people.includes(r.name));
  if(!payer||!people.length)continue;
  payer.paid+=e.amount;const q=Math.floor(e.amount/people.length),rem=e.amount%people.length;
  people.forEach((r,i)=>r.share+=q+(i<rem?1:0));
 }
 rows.forEach(r=>r.net=r.paid-r.share);
 for(const p of transfers){
  if(p.status==='unpaid')continue;
  const from=rows.find(r=>r.name===p.from),to=rows.find(r=>r.name===p.to);
  if(from&&to&&from!==to&&Number.isSafeInteger(p.amount)&&p.amount>0){from.net+=p.amount;to.net-=p.amount;}
 }
 table('contributions-table',['Rider','Paid','Share','Balance'],rows.map(r=>[
  r.name,cents(r.paid),cents(r.share),
  {text:(r.net>0?'+':r.net<0?'−':'')+cents(Math.abs(r.net))+' · '+(r.net>0?'Receive':r.net<0?'Pay':'Settled'),className:r.net>0?'positive':r.net<0?'negative':'neutral'}
 ]),{empty:'Add riders in Bill Split to see contributions.',className:'contributions-table'});
 $('contributions-note').textContent='Balances reflect recorded payments. Positive = receive; negative = pay.';

 // Current amount each rider must pay: greedy settlement identical to split.js.
 const debt=rows.filter(r=>r.net<0).map(r=>({name:r.name,n:-r.net}));
 const credit=rows.filter(r=>r.net>0).map(r=>({name:r.name,n:r.net}));
 const settlements=[];let i=0,j=0;
 while(i<debt.length&&j<credit.length){const n=Math.min(debt[i].n,credit[j].n);
  settlements.push([debt[i].name,credit[j].name,cents(n),'Pending']);
  debt[i].n-=n;credit[j].n-=n;if(!debt[i].n)i++;if(!credit[j].n)j++;
 }
 table('settlements-table',['From','Pay to','Amount','Status'],settlements,
  {empty:members.length?'All settled — no outstanding payments.':'Add riders to calculate settlement.',className:'settlements-table'});
 $('settlements-note').textContent='Suggested outstanding transfers after payments marked Paid; not a record of money already transferred.';

 // Full expense history is intentionally NEVER collapsed or truncated in PDF.
 const history=expenses.map((e,i)=>{
  const included=validExpense(e);
  const people=rows.filter(r=>Array.isArray(e.people)&&e.people.includes(r.name));
  const per=people.length?Math.floor(positive(e.amount)/people.length):0,rem=people.length?positive(e.amount)%people.length:0;
  const shares=included?people.map((r,j)=>`${r.name}: ${cents(per+(j<rem?1:0))}`).join(' · '):'Excluded from balances (missing rider or payer)';
  return [String(i+1),{lines:[e.name||'Unnamed expense',formatDate(e.date,true)]},e.payer||'—',cents(e.amount),
   Array.isArray(e.people)?e.people.join(', ')||'—':'—',{text:shares,className:included?'':'negative'}];
 });
 table('expense-history-table',['#','Expense / date','Paid by','Amount','Split between','Per-rider shares'],history,
  {empty:'No expenses recorded yet.',className:'expense-history-table'});
 $('expense-count').textContent=expenses.length+' '+(expenses.length===1?'expense':'expenses')+' recorded · '+money(spent)+' valid spending';

 // Payment history: include both PAID and UNPAID statuses and timestamps.
 table('payments-table',['Date','From','To','Amount','Status'],transfers.map(p=>[
  formatDate(p.date,true),p.from||'—',p.to||'—',cents(p.amount),
  {text:p.status==='unpaid'?'Unpaid / reversed':'Paid',className:p.status==='unpaid'?'negative':'positive'}
 ]),{empty:'No payments recorded yet.',className:'payments-table'});
 $('payment-count').textContent=transfers.length+' '+(transfers.length===1?'record':'records');
})();
