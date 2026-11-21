/* MotoTrip original application code © 2026 Satish Kumar Gupta. Third-party rights unaffected. */
/* MotoTrip V4.7 — reversible paid/unpaid settlement status with persistent payment history. */
const expenseTypes=['Hotel','Food','Petrol','Toll','Parking','Tea / Snacks','Breakfast','Lunch','Dinner','Fuel','Other'];
function group(){
 if(!state.split||!Array.isArray(state.split.members)||!Array.isArray(state.split.expenses))
  state.split={name:'',members:[],expenses:[]};
 const g=state.split;
 if(!Array.isArray(g.transfers))g.transfers=[];
 // Single source of truth: the Planner's trip name. Keep all existing riders,
 // expenses and payments; only refresh the group's display name.
 const plannerName=form.elements.name.value.trim().slice(0,100);
 if(!window.motoTripSharedRide?.active && (g.name!==plannerName||g.autoTripName!==plannerName)){
  g.name=plannerName;g.autoTripName=plannerName;
 }
 return g;
}
const cash=p=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(p/100);
function calculateSplit(g){
 const rows=g.members.map(name=>({name,paid:0,share:0,net:0}));
 for(const e of g.expenses){
  const payer=rows.find(r=>r.name===e.payer),people=rows.filter(r=>Array.isArray(e.people)&&e.people.includes(r.name));
  if(!payer||!people.length||!Number.isSafeInteger(e.amount)||e.amount<=0)continue;
  payer.paid+=e.amount;
  const q=Math.floor(e.amount/people.length),rem=e.amount%people.length;
  people.forEach((r,i)=>r.share+=q+(i<rem?1:0));
 }
 rows.forEach(r=>r.net=r.paid-r.share);
 for(const p of g.transfers||[]){
  // Older MotoTrip payment records have no status and count as paid.
  // Reversed records stay in history but no longer change outstanding balances.
  if(p.status==='unpaid')continue;
  const a=rows.find(r=>r.name===p.from),b=rows.find(r=>r.name===p.to);
  if(a&&b&&a!==b&&Number.isSafeInteger(p.amount)&&p.amount>0){a.net+=p.amount;b.net-=p.amount;}
 }
 const debt=rows.filter(r=>r.net<0).map(r=>({name:r.name,n:-r.net}));
 const credit=rows.filter(r=>r.net>0).map(r=>({name:r.name,n:r.net}));
 const payments=[];
 let i=0,j=0;
 while(i<debt.length&&j<credit.length){
  const n=Math.min(debt[i].n,credit[j].n);
  payments.push({from:debt[i].name,to:credit[j].name,n});
  debt[i].n-=n;credit[j].n-=n;
  if(!debt[i].n)i++;if(!credit[j].n)j++;
 }
 return {rows,payments,total:rows.reduce((n,r)=>n+r.paid,0)};
}
function saveSplit(){persist();renderSplit();if(window.motoTripSharedRide?.active)window.motoTripSharedRide.capture();}
function recordPayment(from,to,amount){
 const g=group();
 if(from===to||!g.members.includes(from)||!g.members.includes(to)||!Number.isSafeInteger(amount)||amount<=0)return false;
 g.transfers.push({id:crypto.randomUUID(),from,to,amount,date:new Date().toISOString(),status:'paid'});saveSplit();return true;
}
// Toggle one payment, not the expense itself; the accounting is fully recalculated.
// No history is discarded, so a mistaken Undo can also be corrected.
function togglePaymentStatus(index){
 const g=group(),payment=g.transfers[index];if(!payment)return;
 const isPaid=payment.status!=='unpaid';
 const action=isPaid?'Mark UNPAID':'Mark PAID again';
 if(!confirm(action+' for '+payment.from+' → '+payment.to+' ('+cash(payment.amount)+')?'+
  (isPaid?' This will restore the outstanding balance.':' This will settle that amount again.')))return;
 payment.status=isPaid?'unpaid':'paid';
 payment.statusChangedAt=new Date().toISOString();
 saveSplit();
}
function paymentStatusText(payment){return payment.status==='unpaid'?'Unpaid':'Paid';}
function renderPaymentCorrections(g){
 const root=$('payment-undo-list');if(!root)return;
 root.replaceChildren();
 if(!g.transfers.length)return;
 const count=g.transfers.filter(p=>p.status!=='unpaid').length;
 const title=node('div','','payment-correction-head');
 title.append(node('strong','Payment status'),node('small',count+' paid · '+(g.transfers.length-count)+' unpaid'));
 root.append(title);
 const desc=node('p','Wrongly marked paid? Use Undo below. No expense will be deleted.','payment-correction-hint');
 root.append(desc);
 function makeRow(index){
  const p=g.transfers[index];
  const row=node('div','','payment-correction-row'+(p.status==='unpaid'?' is-unpaid':''));
  const info=node('div','','payment-correction-info');
  info.append(node('strong',p.from+' → '+p.to+' · '+cash(p.amount)),
   node('small',(p.status==='unpaid'?'↶ Unpaid':'✓ Paid')+(p.date?' · '+new Date(p.date).toLocaleDateString('en-IN') : '')));
  const btn=node('button',p.status==='unpaid'?'Mark paid again':'↶ Undo / Unpaid','payment-undo-btn');
  btn.type='button';
  btn.setAttribute('aria-label',(p.status==='unpaid'?'Mark paid again':'Undo paid')+' '+p.from+' to '+p.to+' '+cash(p.amount));
  btn.onclick=()=>togglePaymentStatus(index);
  row.append(info,btn);return row;
 }
 root.append(makeRow(g.transfers.length-1));
 if(g.transfers.length>1){
  const more=node('details','','payment-more');
  const summary=node('summary','View older payments ('+(g.transfers.length-1)+')');
  more.append(summary);
  const list=node('div','','payment-more-list');
  for(let i=g.transfers.length-2;i>=0;i--)list.append(makeRow(i));
  more.append(list);root.append(more);
 }
}
function removeRider(name){
 const g=group(),linkedExpenses=g.expenses.filter(e=>e.payer===name||Array.isArray(e.people)&&e.people.includes(name)).length;
 const linkedPayments=g.transfers.filter(p=>p.from===name||p.to===name).length;
 if(linkedExpenses||linkedPayments){
  alert(name+' is linked to '+linkedExpenses+' expense(s) and '+linkedPayments+' payment(s). To protect your calculations, remove those entries in Expense history / Payment history before removing this rider.');
  return;
 }
 if(!confirm('Remove rider "'+name+'" from this group?'))return;
 g.members=g.members.filter(n=>n!==name);saveSplit();
}
function deleteExpense(index){
 const g=group(),e=g.expenses[index];if(!e)return;
 if(!confirm('Delete '+e.name+' ('+cash(e.amount)+')? This will recalculate every rider balance.'))return;
 g.expenses.splice(index,1);saveSplit();
}
// UI-only state: expense data stays in the existing localStorage group format.
// Start collapsed to avoid a long expense list on small iPhone/Android screens.
let recentExpensesOpen=false;
let recentExpenseQuery='';
function recentExpenses(g){
 const root=$('recent-expenses');
 const old=root.querySelector('details.recent-disclosure');
 if(old)recentExpensesOpen=old.open;
 root.replaceChildren();
 if(!g.expenses.length)return;

 const panel=node('details','','recent-disclosure');
 panel.open=recentExpensesOpen;
 const head=node('summary','','recent-disclosure-header');
 const identity=node('span','','recent-disclosure-identity');
 identity.append(node('strong','Recent expenses'),node('small',g.expenses.length+' '+(g.expenses.length===1?'entry':'entries')+' · '+cash(g.expenses.reduce((t,e)=>t+(Number.isSafeInteger(e.amount)?e.amount:0),0))));
 const action=node('span',recentExpensesOpen?'Hide':'View','recent-disclosure-action');
 head.append(identity,action);
 const latest=g.expenses[g.expenses.length-1];
 const latestText=node('span','Latest: '+latest.name+' · '+cash(latest.amount)+' · '+latest.payer,'recent-disclosure-latest');
 identity.append(latestText);
 panel.append(head);

 const inner=node('div','','recent-disclosure-body');
 const hint=node('p','Tap Remove to undo a wrong entry. Rider balances update automatically.','recent-disclosure-hint');
 inner.append(hint);
 const list=node('div','','recent-disclosure-list');
 list.setAttribute('role','list');
 // Scroll inside the card instead of letting a long expense log push the page down.
 function drawRows(query=''){
  list.replaceChildren();
  let shown=0;
  for(let i=g.expenses.length-1;i>=0;i--){
   const e=g.expenses[i];
   if(query&&!((e.name||'')+' '+(e.payer||'')).toLocaleLowerCase().includes(query))continue;
   const r=node('div','','recent-expense-row');r.setAttribute('role','listitem');
   const info=node('div','','recent-expense-info');
   info.append(node('strong',e.name+' · '+cash(e.amount)),node('small','Paid by '+e.payer));
   const b=node('button','Remove','recent-remove');b.type='button';
   b.setAttribute('aria-label','Remove '+e.name+' expense '+cash(e.amount));b.onclick=()=>deleteExpense(i);
   r.append(info,b);list.append(r);shown++;
  }
  if(!shown)list.append(node('p','No matching expenses.','recent-empty'));
 }
 if(g.expenses.length>6){
  const search=document.createElement('input');search.id='recent-expense-search';
  search.className='recent-expense-search';search.type='search';search.autocomplete='off';
  search.placeholder='Search expense or rider';search.setAttribute('aria-label','Search recent expenses');
  search.value=recentExpenseQuery;
  search.addEventListener('input',()=>{
   recentExpenseQuery=search.value.toLocaleLowerCase().trim();drawRows(recentExpenseQuery);
  });
  inner.append(search);
 }else{recentExpenseQuery='';}
 drawRows(recentExpenseQuery);
 inner.append(list);
 panel.append(inner);
 panel.addEventListener('toggle',()=>{
  recentExpensesOpen=panel.open;
  action.textContent=panel.open?'Hide':'View';
 });
 root.append(panel);
}

function renderSplit(){
 const g=group(),previousPayer=$('payer').value,
 prevChecks=new Map([...$('beneficiaries').querySelectorAll('input[type=checkbox]')].map(x=>[x.value,x.checked]));
 $('group-name').value=g.name||'';
 $('rider-count').textContent=g.members.length+' added';
 for(const id of ['members','payer','beneficiaries','expense-list','balances','settlements','split-summary','payment-from','payment-to','payment-list'])$(id).replaceChildren();
 if(!g.members.length)$('members').append(node('p','No riders yet. Add a rider above.','no-riders'));
 for(const name of g.members){
  const chip=node('span','','rider-chip'),label=node('span',name),remove=node('button','×','remove-rider');
  remove.type='button';remove.setAttribute('aria-label','Remove rider '+name);remove.title='Remove rider '+name;remove.onclick=()=>removeRider(name);
  chip.append(label,remove);$('members').append(chip);
  for(const id of ['payer','payment-from','payment-to']){
   const o=node('option',name);o.value=name;$(id).append(o);
  }
  const l=node('label','','check'),c=document.createElement('input');
  c.type='checkbox';c.value=name;c.checked=prevChecks.has(name)?prevChecks.get(name):true;
  l.append(c,document.createTextNode(name));$('beneficiaries').append(l);
 }
 if(g.members.includes(previousPayer))$('payer').value=previousPayer;
 if(g.members.length>1)$('payment-to').selectedIndex=1;
 function history(id,items,describe,kind){
  if(!items.length)$(id).append(node('p','No entries yet.'));
  items.forEach((e,i)=>{
   const a=node('article','','trip');a.append(node('strong',describe(e)),node('p',e.date?new Date(e.date).toLocaleString():'Date not recorded'));
   if(kind==='payment'){
    const toggle=node('button',e.status==='unpaid'?'Mark paid again':'Undo / Unpaid','payment-history-toggle');
    toggle.type='button';toggle.onclick=()=>togglePaymentStatus(i);a.append(toggle);
   }
   const b=node('button','Delete');b.type='button';b.onclick=()=>kind==='expense'?deleteExpense(i):deletePayment(i);
   a.append(b);$(id).append(a);
  });
 }
 history('expense-list',g.expenses,e=>e.name+' · '+cash(e.amount)+' · Paid by '+e.payer+' · Split: '+(Array.isArray(e.people)?e.people.join(', '):''),'expense');
 history('payment-list',g.transfers,e=>e.from+' → '+e.to+' · '+cash(e.amount)+' · '+paymentStatusText(e),'payment');
 recentExpenses(g);
 const result=calculateSplit(g);
 for(const [label,value] of [['Total spending',cash(result.total)],['Average per person',cash(g.members.length?Math.round(result.total/g.members.length):0)]]){
  const a=node('div','','split-stat');a.append(node('small',label),node('strong',value));$('split-summary').append(a);
 }
 const table=node('table','','split-table'),head=node('thead'),hr=node('tr');
 for(const s of ['Member','Paid','Share','Balance'])hr.append(node('th',s));
 head.append(hr);table.append(head);
 const body=node('tbody');
 for(const r of result.rows){
  const tr=node('tr');tr.append(node('td',r.name),node('td',cash(r.paid)),node('td',cash(r.share)));
  const td=node('td','','balance '+(r.net>0?'receive':r.net<0?'owe':'even'));
  td.append(node('strong',(r.net>0?'+':r.net<0?'−':'')+cash(Math.abs(r.net))),node('small',r.net>0?'Receive':r.net<0?'Pay':'Settled'));
  tr.append(td);body.append(tr);
 }
 table.append(body);$('balances').append(table);
 for(const p of result.payments){
  const a=node('div','','settlement-row');a.append(node('span',p.from+' → '+p.to),node('strong',cash(p.n)));
  const b=node('button','Mark paid');b.type='button';b.onclick=()=>{if(confirm('Record '+cash(p.n)+' paid by '+p.from+' to '+p.to+'?'))recordPayment(p.from,p.to,p.n);};
  a.append(b);$('settlements').append(a);
 }
 if(!result.payments.length)$('settlements').append(node('p','No outstanding balances.'));
 renderPaymentCorrections(g);
 $('expense-form').querySelector('button.primary').disabled=!g.members.length;
 $('payment-form').querySelector('button.primary').disabled=g.members.length<2;
 renderBudget();
}
function deletePayment(i){
 const g=group(),e=g.transfers[i];if(!e)return;
 if(!confirm('Delete payment '+cash(e.amount)+' from '+e.from+' to '+e.to+'?'))return;
 g.transfers.splice(i,1);saveSplit();
}
window.renderSplit=renderSplit;
function plannerTripName(){return form.elements.name.value.trim().slice(0,100);}
function syncGroupName(){
 const g=group();
 $('group-name').value=g.name;
 persist();
 renderBudget();
}
window.syncSplitTripName=syncGroupName;
// Update instantly with each change in Planner, including clearing or editing.
form.elements.name.addEventListener('input',syncGroupName);
form.elements.name.addEventListener('change',syncGroupName);
$('member-form').onsubmit=e=>{
 e.preventDefault();const n=$('member-name').value.trim(),g=group();
 if(!n||g.members.some(x=>x.toLocaleLowerCase()===n.toLocaleLowerCase())){
  alert('Please enter a unique rider name.');return;
 }
 g.members.push(n);$('member-name').value='';saveSplit();
};
$('expense-form').onsubmit=e=>{
 e.preventDefault();const g=group(),people=[...$('beneficiaries').querySelectorAll('input:checked')].map(x=>x.value);
 const amount=Math.round(Number($('expense-amount').value)*100),name=$('expense-name').value.trim(),payer=$('payer').value;
 if(!people.length||!name||!g.members.includes(payer)||!Number.isSafeInteger(amount)||amount<=0){
  alert('Enter an amount, choose who paid, and select at least one rider.');return;
 }
 g.expenses.push({id:crypto.randomUUID(),name,payer,amount,people,date:new Date().toISOString()});
 $('expense-name').value='';$('expense-amount').value='';$('expense-suggestions').hidden=true;
 saveSplit();
};
$('payment-form').onsubmit=e=>{
 e.preventDefault();
 if(!recordPayment($('payment-from').value,$('payment-to').value,Math.round(Number($('payment-amount').value)*100)))
  alert('Choose different riders and a valid amount.');
 else $('payment-amount').value='';
};
$('new-group').onclick=()=>{
 if(confirm('Delete all group riders, expenses and payments? Saved trips will remain. Export a backup first if needed.')){
  const name=plannerTripName();
  state.split={name,autoTripName:name,members:[],expenses:[],transfers:[]};saveSplit();
 }
};
// One-tap category chips and live filtered suggestions also work on iPhone Safari.
function chooseExpenseName(name){
 $('expense-name').value=name;$('expense-suggestions').hidden=true;
 $('expense-amount').focus();
}
for(const btn of document.querySelectorAll('.category-chip'))btn.onclick=()=>chooseExpenseName(btn.dataset.expense);
function showExpenseSuggestions(){
 const input=$('expense-name'),v=input.value.trim().toLocaleLowerCase(),panel=$('expense-suggestions');panel.replaceChildren();
 if(!v){panel.hidden=true;return;}
 const matches=expenseTypes.filter(s=>s.toLocaleLowerCase().includes(v)).slice(0,6);
 for(const item of matches){
  const b=node('button',item,'expense-suggestion');b.type='button';b.setAttribute('role','option');
  b.onclick=()=>chooseExpenseName(item);panel.append(b);
 }
 panel.hidden=!matches.length;
}
$('expense-name').addEventListener('input',showExpenseSuggestions);
$('expense-name').addEventListener('focus',showExpenseSuggestions);
document.addEventListener('pointerdown',e=>{
 if(!e.target.closest('#expense-suggestions')&&!e.target.closest('#expense-name'))$('expense-suggestions').hidden=true;
});
$('expense-name').addEventListener('keydown',e=>{
 if(e.key==='Escape')$('expense-suggestions').hidden=true;
 else if(e.key==='ArrowDown'&&!$('expense-suggestions').hidden){
  e.preventDefault();const b=$('expense-suggestions').querySelector('button');if(b)b.focus();
 }
});
$('expense-suggestions').addEventListener('keydown',e=>{
 if(e.key==='Escape'){$('expense-suggestions').hidden=true;$('expense-name').focus();}
});
syncGroupName();
renderSplit();
