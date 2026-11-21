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
 }
 // Applies to the page once and to every later expense/settlement render.
 window.MotoTripUI={afterSplitRender,selectionStatus};
 try { if(typeof group==='function')afterSplitRender(group()); } catch (_) {}
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
