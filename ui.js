/* MotoTrip V5.6 | presentation-only enhancements, no changes to trip/bill data. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let previousPayments=null;
 function selectionStatus(){
   const container=$('beneficiaries'),hint=$('selected-riders-hint');
   if(!container||!hint)return;
   const all=container.querySelectorAll('input[type=checkbox]').length;
   const selected=container.querySelectorAll('input[type=checkbox]:checked').length;
   hint.textContent=all===0?'Add riders first':selected===all?'All '+all+' riders selected':selected+' of '+all+' selected';
 }
 if($('beneficiaries'))$('beneficiaries').addEventListener('change',selectionStatus);
 function afterSplitRender(g){
   selectionStatus();
   const status=$('payment-status-panel');
   if(status){
     const count=Array.isArray(g.transfers)?g.transfers.length:0;
     status.hidden=count===0;
     if(previousPayments!==null && count>previousPayments)status.open=true;
     previousPayments=count;
   }
   const launcher=$('shared-ride-launcher');
   if(launcher && window.motoTripSharedRide?.active)launcher.open=true;
 }
 // Applies to the page once and to every later expense/settlement render.
 window.MotoTripUI={afterSplitRender,selectionStatus};
 try { if(typeof group==='function')afterSplitRender(group()); } catch (_) {}
 // V6.0: one-tap Route help and half-width Create / Join actions.
 const routeJump=$('planner-route-jump');
 if(routeJump)routeJump.addEventListener('click',()=>{
   const target=document.querySelector('nav button[data-tab="route"]');
   if(target)target.click();
 });
 const joinTrigger=$('join-ride-trigger'),joinPanel=$('join-ride-panel');
 if(joinTrigger&&joinPanel)joinTrigger.addEventListener('click',()=>{
   const launcher=$('shared-ride-launcher');
   if(launcher)launcher.open=true;
   joinPanel.hidden=!joinPanel.hidden;
   joinTrigger.setAttribute('aria-expanded',String(!joinPanel.hidden));
   if(!joinPanel.hidden){const field=$('shared-code');if(field)field.focus({preventScroll:true});joinPanel.scrollIntoView({block:'nearest',behavior:'smooth'});}
 });
 // V9.20: trip dates in Bill Split show the same text as the Planner card.
 const dateSource=$('mt80-date-summary'),splitDates=$('split-summary-dates');
 if(dateSource&&splitDates){
   const refreshDate=()=>{splitDates.textContent=dateSource.textContent.trim()||'Add trip dates';};
   new MutationObserver(refreshDate).observe(dateSource,{childList:true,characterData:true,subtree:true});
   refreshDate();
 }
 const dateJump=$('split-summary-dates-button');
 if(dateJump)dateJump.addEventListener('click',()=>{
   const plannerTab=document.querySelector('#main-nav button[data-tab="plan"]');
   if(plannerTab)plannerTab.click();
   const target=$('mt80-date-toggle');
   if(target){target.scrollIntoView({block:'center',behavior:'smooth'});target.click();}
 });
 // A bottom nav tap should always land at the top of the new section.
 const nav=$('main-nav');
 if(nav)nav.addEventListener('click',event=>{
   if(!event.target.closest('button[data-tab]'))return;
   requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'}));
 });
 // Small usability: selecting a quick expense closes the choices, focuses amount.
 document.querySelectorAll('.category-chip').forEach(button=>{
   button.addEventListener('click',()=>{});
 });
})();
