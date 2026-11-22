/* MotoTrip V9.11: restore original trip card without GPS street address overlap. */
(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const originalForm=document.getElementById('planner');
  if(!originalForm || typeof update!=='function' || typeof read!=='function') return;
  const field=name=>originalForm.elements.namedItem(name);
  const quick={distance:el('mt80-distance'),mileage:el('mt80-mileage'),price:el('mt80-price')};
  const quickRound=el('mt82-round'), quickFuel=el('mt82-include-fuel');
  const pretty=n => Number.isFinite(n) ? new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n) : '₹0';
  const formatNum=n => Number.isFinite(n) ? String(Number(n.toFixed(2))) : '0';
  let rendering=false;
  const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function prettyDate(iso){if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||''))return '';const [y,m,d]=iso.split('-').map(Number);return m>=1&&m<=12&&d>=1&&d<=31?d+' '+month[m-1]+' '+y:'';}
  function riderCount(){
    let n=Number(state.plannerRiderCount);
    if(!Number.isSafeInteger(n)||n<1) n=Math.max(1,Math.min(99,Number(state.split?.members?.length)||2));
    return Math.min(99,n);
  }
  function getBoolField(name, fallback=true){
    const f=field(name);
    if(!f) return fallback;
    if(f.type==='hidden') return String(f.value)!=='false';
    return !!f.checked;
  }
  function setBoolField(name, value){
    const f=field(name);
    if(!f) return;
    if(f.type==='hidden') f.value=value?'true':'false';
    else f.checked=!!value;
    f.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function render(){
    if(rendering)return;
    rendering=true;
    try{
      const d=read(), c=calc(d);
      // Hotel nights and food days are optional for the live estimate.
      const km=c.km;
      if(document.activeElement!==quick.distance)quick.distance.value=formatNum(km);
      for(const name of ['mileage','price']) if(document.activeElement!==quick[name]) quick[name].value=field(name).value;
      // The route's exact start/destination stay in Route tab.  A trip NAME, not
      // a geocoded GPS street address, is shown in this old-style Planner card.
      const tripName=String(d.name||'').trim().replace(/\s+/g,' ').slice(0,100);
      const tripTitle=el('mt80-route');
      tripTitle.textContent=tripName||'My Trip';
      tripTitle.title=tripName||'My Trip';
      const budgetEl=el('mt80-card-budget');
      const budgetText=pretty(c.total);
      budgetEl.textContent=budgetText;
      budgetEl.title=budgetText;
      // Keep even six/seven-figure amounts fully visible on narrow phones.
      budgetEl.style.fontSize=budgetText.length>=13?'12px':budgetText.length>=10?'clamp(12px,3.6vw,16px)':budgetText.length>=7?'clamp(15px,4.4vw,20px)':'';
      el('mt80-card-riders').textContent=riderCount()+' Rider'+(riderCount()===1?'':'s');
      el('mt80-riders').textContent=riderCount();
      el('mt80-per-person').textContent='≈ '+pretty(c.total/riderCount())+' / Rider';
      for(const [kind,name] of [['fuel','fuel'],['stay','stay'],['food','food'],['toll','toll'],['other','other']]) el('mt80-'+kind).textContent=pretty(c[name]);
      el('mt80-cost-note').textContent=Number(c.other)>0?'Other expenses ('+pretty(c.other)+') are included in the total.':'Estimate cards stay in sync.';
      if(quickRound) quickRound.checked=!!d.round;
      if(quickFuel) quickFuel.checked=d.includeFuel!==false && d.includeFuel!=='false';
      const start=field('departDate')?.value||'', end=field('endDate')?.value||'';
      if(document.activeElement!==el('mt80-start-date')) el('mt80-start-date').value=start;
      if(document.activeElement!==el('mt80-end-date')) el('mt80-end-date').value=end;
      let dates='Add trip dates';
      if(start&&end) dates=start>end?'Check trip dates':start===end?prettyDate(start):prettyDate(start)+' – '+prettyDate(end);
      else if(start) dates='From '+prettyDate(start);
      else if(end) dates='Until '+prettyDate(end);
      el('mt80-date-summary').textContent=dates;
    } finally {rendering=false;}
  }
  const previousUpdate=update;
  update=function(...args){const result=previousUpdate(...args);render();return result;};
  for(const [name,input] of Object.entries(quick)){
    input.addEventListener('input',()=>{
      const value=input.value;
      if(name==='distance'){
        const total=Number(value);
        if(value===''||!Number.isFinite(total)||total<0)return;
        field('distance').value=formatNum(total/(getBoolField('round',true)?2:1));
        field('distance').dispatchEvent(new Event('input',{bubbles:true}));
      }else{
        if(value===''||!Number.isFinite(Number(value))||Number(value)<0)return;
        field(name).value=value;
        field(name).dispatchEvent(new Event('input',{bubbles:true}));
      }
    });
    input.addEventListener('change',()=>{if(input.value==='')render();});
  }
  for(const [id,increment] of [['mt80-minus',-1],['mt80-plus',1]]) el(id).addEventListener('click',()=>{
    const next=Math.min(99,Math.max(1,riderCount()+increment));
    state.plannerRiderCount=next;
    persist();
    render();
  });
  for(const [id,name] of [['mt80-start-date','departDate'],['mt80-end-date','endDate']]) el(id).addEventListener('change',()=>{
    field(name).value=el(id).value;
    field(name).dispatchEvent(new Event('input',{bubbles:true}));
  });
  if(quickRound) quickRound.addEventListener('change',()=>{
    const total=Number(quick.distance.value)||0;
    const wasRound=getBoolField('round',true);
    const oneWay=total/(wasRound?2:1);
    setBoolField('round',quickRound.checked);
    field('distance').value=formatNum(oneWay);
    field('distance').dispatchEvent(new Event('input',{bubbles:true}));
  });
  if(quickFuel) quickFuel.addEventListener('change',()=>setBoolField('includeFuel',quickFuel.checked));
  render();
})();
