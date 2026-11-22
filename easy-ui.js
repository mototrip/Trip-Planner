/* MotoTrip V7.0 — UI-only progressive disclosure. Does not modify account, trips or group data. */
(() => {
  'use strict';
  const KEY='mototrip-ui-view-v7';
  const el=id=>document.getElementById(id);
  const root=document.documentElement;
  const toggle=el('mt70-mode-toggle');
  const status=el('mt70-mode-text');
  const budget=document.querySelector('#plan .comparison-panel');
  let full=false;
  let budgetChoice=null;
  try { full=localStorage.getItem(KEY)==='full'; budgetChoice=localStorage.getItem('mototrip-budget-panel-v7'); } catch (_) {}
  const apply=()=>{
    root.classList.toggle('mt-full',full);
    if(toggle){
      toggle.textContent=full?'✨ Easy View':'⚙️ Full View';
      toggle.setAttribute('aria-pressed',String(full));
      toggle.setAttribute('aria-label',full?'Switch to easy view':'Switch to full app view');
    }
    if(status){
      status.replaceChildren();
      status.append(document.createTextNode(full?'⚙️ Full View':'✨ Easy View'));
      const small=document.createElement('small');
      small.textContent=full?' · All app details':' · Only what you need';
      status.append(small);
    }
    // Keep the budget table accessible as a native disclosure, and let the
    // detailed view default to showing it. Never hide a field used by a form.
    if(budget) budget.open=budgetChoice===null?full:budgetChoice==='open';
  };
  if(toggle)toggle.addEventListener('click',()=>{
    full=!full;
    try{localStorage.setItem(KEY,full?'full':'easy');}catch(_){}
    apply();
  });
  if(budget){
    const summary=budget.querySelector('summary');
    if(summary)summary.addEventListener('click',()=>{
      // Save only an explicit user choice, never a programmatic view toggle.
      setTimeout(()=>{
        budgetChoice=budget.open?'open':'closed';
        try{localStorage.setItem('mototrip-budget-panel-v7',budgetChoice);}catch(_){}
      },0);
    });
  }
  const quick=el('mt70-quickstart');
  if(quick)quick.addEventListener('click',event=>{
    const button=event.target.closest('button[data-quick]');
    if(!button)return;
    const target=button.dataset.quick;
    if(target==='plan'){
      el('planner')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    const nav=document.querySelector('#main-nav button[data-tab="'+target+'"]');
    nav?.click();
  });
  apply();
})();
