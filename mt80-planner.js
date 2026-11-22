/* MotoTrip V8.0: compact Planner overview. No new storage key for core trip/expense data. */
(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const originalForm=document.getElementById('planner');
  if(!originalForm || typeof update!=='function' || typeof read!=='function') return;
  const field=name=>originalForm.elements.namedItem(name);
  const quick={distance:el('mt80-distance'),mileage:el('mt80-mileage'),price:el('mt80-price')};
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
  function render(){
    if(rendering)return;
    rendering=true;
    try{
      const d=read(), hasValid=originalForm.checkValidity();
      const c=hasValid?calc(d):{km:0,total:0,fuel:0,stay:0,food:0,toll:0,other:0};
      const km=hasValid&&Number.isFinite(c.km)?c.km:Math.max(0,Number(d.distance)||0)*(d.round?2:1);
      // Both the quick fields and the detailed fields show exactly the same values.
      if(document.activeElement!==quick.distance)quick.distance.value=formatNum(km);
      for(const name of ['mileage','price'])if(document.activeElement!==quick[name])quick[name].value=field(name).value;
      el('mt80-route').textContent=(String(d.from||'Starting point').trim()||'Starting point')+' → '+(String(d.to||'Destination').trim()||'Destination');
      el('mt80-card-budget').textContent=pretty(c.total);
      el('mt80-card-riders').textContent=riderCount()+' Rider'+(riderCount()===1?'':'s');
      el('mt80-riders').textContent=riderCount();
      el('mt80-per-person').textContent='≈ '+pretty(c.total/riderCount())+' / Rider';
      for(const [kind,name] of [['fuel','fuel'],['stay','stay'],['food','food'],['toll','toll']])el('mt80-'+kind).textContent=pretty(c[name]);
      el('mt80-cost-note').textContent=Number(c.other)>0?'Other expenses ('+pretty(c.other)+') are included in the total. Edit above or below — both stay in sync.':'Edit above or below — both estimates stay in sync.';
      const start=field('departDate')?.value||'',end=field('endDate')?.value||'';
      if(document.activeElement!==el('mt80-start-date'))el('mt80-start-date').value=start;
      if(document.activeElement!==el('mt80-end-date'))el('mt80-end-date').value=end;
      let dates='Add trip dates';
      if(start&&end)dates=start>end?'Check trip dates':start===end?prettyDate(start):prettyDate(start)+' – '+prettyDate(end);
      else if(start)dates='From '+prettyDate(start);
      else if(end)dates='Until '+prettyDate(end);
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
        field('distance').value=formatNum(total/(field('round').checked?2:1));
        field('distance').dispatchEvent(new Event('input',{bubbles:true}));
      }else{
        if(value===''||!Number.isFinite(Number(value))||Number(value)<0)return;
        field(name).value=value;
        field(name).dispatchEvent(new Event('input',{bubbles:true}));
      }
    });
    input.addEventListener('change',()=>{if(input.value==='')render();});
  }
  for(const [id,increment] of [['mt80-minus',-1],['mt80-plus',1]])el(id).addEventListener('click',()=>{
    const next=Math.min(99,Math.max(1,riderCount()+increment));
    state.plannerRiderCount=next;
    persist();
    render();
  });
  for(const [id,name] of [['mt80-start-date','departDate'],['mt80-end-date','endDate']])el(id).addEventListener('change',()=>{
    field(name).value=el(id).value;
    field(name).dispatchEvent(new Event('input',{bubbles:true}));
  });
  // When saved trips are loaded, both sections update through the existing update().
  render();
})();
