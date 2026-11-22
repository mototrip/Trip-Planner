/* MotoTrip V7.9 | Screenshot-reference Home layer. Preserves V7.8 data and actions. */
(() => {
 'use strict';
 const get=id=>document.getElementById(id);
 const nav=get('main-nav'), home=get('home');
 if(!nav||!home||typeof tab!=='function'||typeof state==='undefined'||typeof form==='undefined')return;
 const fmt=(n)=>'₹'+Math.round(Number.isFinite(n)?n:0).toLocaleString('en-IN');
 const f=(name)=>form.elements.namedItem(name);
 const setText=(id,text)=>{const e=get(id);if(e)e.textContent=text;};
 const isNumber=n=>Number.isFinite(Number(n))&&Number(n)>=0;
 const values={distance:get('mt79-distance'),mileage:get('mt79-mileage'),price:get('mt79-price')};
 const hasDraft=Boolean(state.draft);
 // Demo defaults exactly reproduce the reference screenshot; don't overwrite any previously saved draft.
 if(!hasDraft){
   const demo={name:'Delhi to Manali',from:'Delhi',to:'Manali',distance:1260,days:5,nights:4,
      mileage:30,price:102,hotel:300,food:120,toll:226,extra:0,
      departDate:'2026-11-22',endDate:'2026-11-26',round:false};
   for(const [k,v] of Object.entries(demo)){
     const e=f(k);if(!e)continue;if(e.type==='checkbox')e.checked=!!v;else e.value=v;
   }
   try{update(false);}catch(_){/* original planner remains available */}
 }
 if(!Number.isInteger(state.homeRiders)||state.homeRiders<1||state.homeRiders>100){
   state.homeRiders=Array.isArray(state.split?.members)&&state.split.members.length?state.split.members.length:4;
 }
 function riderCount(){const members=Array.isArray(state.split?.members)?state.split.members.length:0;return Math.max(1,!state.homeRidersEdited&&members?members:Number(state.homeRiders)||4);}
 function renderHome(){
   let d,c;
   try{d=read();c=calc(d);}catch(_){return;}
   const originalDistance=Number(f('distance')?.value)||0;
   const shownDistance=Number(d.distance)*(d.round?2:1);
   const origin=(d.from||'Delhi').trim(),dest=(d.to||'Manali').trim();
   setText('mt79-trip-title',(origin||'Delhi')+' → '+(dest||'Manali'));
   const dates=[d.departDate,d.endDate].filter(Boolean);
   if(dates.length){
     try{
       const dateText=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
       const shortText=new Intl.DateTimeFormat('en-GB',{day:'numeric',timeZone:'UTC'});
       const parse=s=>new Date(s+'T12:00:00Z');
       setText('mt79-trip-dates',dates.length===2&&d.departDate?.slice(0,7)===d.endDate?.slice(0,7)
         ?shortText.format(parse(d.departDate))+' – '+dateText.format(parse(d.endDate)).replace(/(\w{3}) (\d{4})$/,'$1, $2')
         :dates.map(s=>dateText.format(parse(s))).join(' – '));
     }catch(_){setText('mt79-trip-dates',dates.join(' – '));}
   }else setText('mt79-trip-dates','Dates not set');
   setText('mt79-riders',riderCount());setText('mt79-card-riders',riderCount()+' Rider'+(riderCount()===1?'':'s'));
   const total=Number.isFinite(c.total)?c.total:0;
   setText('mt79-total',fmt(total));setText('mt79-per-rider','≈ '+fmt(total/riderCount())+' / Rider');
   setText('mt79-fuel',fmt(c.fuel));setText('mt79-stay',fmt(c.stay));setText('mt79-food',fmt(c.food));setText('mt79-toll',fmt(c.toll));
   if(document.activeElement!==values.distance)values.distance.value=originalDistance;
   if(document.activeElement!==values.mileage)values.mileage.value=d.mileage||30;
   if(document.activeElement!==values.price)values.price.value=d.price||0;
 }
 function go(id){
   if(id==='home'){
     renderHome();tab('home');
     nav.querySelector('button[data-tab="plan"]')?.classList.add('active');
   }else{
     tab(id);
   }
   document.querySelectorAll('.mt79-bottom button[data-mt79]').forEach(button=>{
      const target=button.dataset.mt79;
      button.classList.toggle('mt79-bottom-active',id==='home'?target==='home':target==='group'&&id==='split'||target==='safety'&&id==='safety');
   });
   window.scrollTo({top:0,behavior:'instant'});
 }
 const existingTab=tab;
 // Maintain all original tab callbacks while keeping the screenshot Home as default landing page.
 tab=function(id){
   existingTab(id);
   if(id==='home')nav.querySelector('button[data-tab="plan"]')?.classList.add('active');
   const current=id==='home'?'home':id==='split'?'group':id;
   document.querySelectorAll('.mt79-bottom button[data-mt79]').forEach(button=>button.classList.toggle('mt79-bottom-active',button.dataset.mt79===current));
 };
 nav.addEventListener('click',()=>requestAnimationFrame(()=>{renderHome();window.scrollTo({top:0,behavior:'instant'});}));
 for(const [name,input] of Object.entries(values))input.addEventListener('change',()=>{
   const value=Number(input.value);
   const legal=(name==='mileage'?value>0:value>=0)&&Number.isFinite(value);
   if(!legal){renderHome();return;}
   if(f(name)){f(name).value=String(value);f(name).dispatchEvent(new Event('input',{bubbles:true}));}
   renderHome();
 });
 for(const [name,input] of Object.entries(values))input.addEventListener('input',()=>{
   const value=Number(input.value);if(!Number.isFinite(value)||(name==='mileage'?value<=0:value<0))return;
   if(f(name)){f(name).value=String(value);f(name).dispatchEvent(new Event('input',{bubbles:true}));}
   renderHome();
 });
 get('mt79-minus').addEventListener('click',()=>{state.homeRiders=Math.max(1,riderCount()-1);state.homeRidersEdited=true;persist();renderHome();});
 get('mt79-plus').addEventListener('click',()=>{state.homeRiders=Math.min(100,riderCount()+1);state.homeRidersEdited=true;persist();renderHome();});
 get('mt79-trip-open').addEventListener('click',()=>go('plan'));
 get('mt79-trip-open').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go('plan');}});
 get('mt79-edit-all').addEventListener('click',()=>go('plan'));
 get('mt79-menu').addEventListener('click',()=>{get('mt79-menu-panel').hidden=!get('mt79-menu-panel').hidden;});
 get('mt79-shortcut-profile').addEventListener('click',()=>{get('mt79-menu-panel').hidden=true;get('mt-account-open')?.click();});
 get('mt79-shortcut-planner').addEventListener('click',()=>{get('mt79-menu-panel').hidden=true;go('plan');});
 get('mt79-notifications').addEventListener('click',()=>{
    const note=get('notice');if(note)note.textContent='Notifications will appear here when your ride has updates.';
    go('split');
 });
 document.querySelectorAll('.mt79-bottom button').forEach(b=>b.addEventListener('click',()=>{
   const option=b.dataset.mt79;
   if(option==='home')go('home');
   else if(option==='group')go('split');
   else if(option==='new')go('plan');
   else if(option==='safety'){
     go('split');const panel=get('mt-safety-panel');
     if(panel&&!panel.hidden){panel.open=true;panel.scrollIntoView({block:'start',behavior:'smooth'});}
     else get('shared-ride-card')?.scrollIntoView({block:'start',behavior:'smooth'});
   } else if(option==='profile')get('mt-account-open')?.click();
 }));
 form.addEventListener('input',()=>requestAnimationFrame(renderHome));
 form.addEventListener('change',()=>requestAnimationFrame(renderHome));
 window.addEventListener('mototrip-profile-updated',renderHome);
 const watch=new MutationObserver(()=>{if(!home.hidden)renderHome();});
 if(get('total'))watch.observe(get('total'),{childList:true});
 renderHome();go('home');
})();
