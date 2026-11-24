/* MotoTrip V7.1 | Original app © 2026 Satish Kumar Gupta; third-party map data retains its own rights. */
const $=id=>document.getElementById(id), form=$('planner');
const gear=['Helmet','Riding jacket','Gloves','Riding boots','Raincoat','First aid kit','Driving licence','RC & insurance','Puncture kit','Power bank','Chain lubricant','Tool kit'];
const places = {
'Andaman and Nicobar Islands':'Port Blair,Diglipur,Havelock Island,Neil Island,Mayabunder', 'Andhra Pradesh':'Visakhapatnam,Vijayawada,Tirupati,Amaravati,Kurnool,Nellore,Anantapur,Araku Valley,Rajahmundry,Srikakulam', 'Arunachal Pradesh':'Itanagar,Tawang,Ziro,Bomdila,Pasighat,Roing,Dirang,Mechuka', 'Assam':'Guwahati,Dibrugarh,Silchar,Tezpur,Jorhat,Kaziranga,Majuli,Tinsukia', 'Bihar':'Patna,Gaya,Bodh Gaya,Rajgir,Nalanda,Bhagalpur,Muzaffarpur,Darbhanga,Purnia', 'Chandigarh':'Chandigarh', 'Chhattisgarh':'Raipur,Bilaspur,Durg,Bhilai,Jagdalpur,Ambikapur,Korba', 'Dadra and Nagar Haveli and Daman and Diu':'Silvassa,Daman,Diu', 'Delhi':'Delhi,New Delhi,Dwarka,Rohini,Connaught Place', 'Goa':'Panaji,Margao,Mapusa,Vasco da Gama,Calangute,Anjuna,Palolem', 'Gujarat':'Ahmedabad,Surat,Vadodara,Rajkot,Bhuj,Dwarka,Somnath,Junagadh,Gandhinagar,Rann of Kutch,Saputara', 'Haryana':'Gurugram,Faridabad,Panipat,Ambala,Karnal,Hisar,Rohtak,Kurukshetra,Panchkula', 'Himachal Pradesh':'Manali,Shimla,Dharamshala,McLeod Ganj,Dalhousie,Chamba,Manimahesh,Bharmour,Kasol,Kullu,Kaza,Spiti,Keylong,Jispa,Kalpa,Sangla,Chitkul,Bir,Mandi,Solan,Narkanda,Chail,Sissu', 'Jammu and Kashmir':'Srinagar,Jammu,Gulmarg,Pahalgam,Sonamarg,Patnitop,Katra,Anantnag,Bandipora', 'Jharkhand':'Ranchi,Jamshedpur,Dhanbad,Deoghar,Bokaro,Netarhat,Hazaribagh', 'Karnataka':'Bengaluru,Mysuru,Mangaluru,Udupi,Hampi,Coorg,Chikmagalur,Gokarna,Belgaum,Hubballi,Badami', 'Kerala':'Kochi,Thiruvananthapuram,Munnar,Alappuzha,Wayanad,Kozhikode,Varkala,Thekkady,Kannur,Thrissur', 'Ladakh':'Leh,Kargil,Nubra Valley,Pangong Lake,Tso Moriri,Hanle,Diskit,Padum,Dras,Khardung La', 'Lakshadweep':'Kavaratti,Agatti,Minicoy,Andrott', 'Madhya Pradesh':'Bhopal,Indore,Ujjain,Gwalior,Jabalpur,Khajuraho,Pachmarhi,Orchha,Satna,Sagar', 'Maharashtra':'Mumbai,Pune,Nashik,Nagpur,Thane,Shirdi,Lonavala,Mahabaleshwar,Alibaug,Ratnagiri,Kolhapur,Chhatrapati Sambhajinagar,Satara,Solapur,Matheran', 'Manipur':'Imphal,Ukhrul,Churachandpur,Moirang,Moreh', 'Meghalaya':'Shillong,Cherrapunji,Dawki,Mawlynnong,Tura,Jowai', 'Mizoram':'Aizawl,Lunglei,Champhai,Serchhip', 'Nagaland':'Kohima,Dimapur,Mokokchung,Mon,Dzukou Valley', 'Odisha':'Bhubaneswar,Puri,Cuttack,Konark,Rourkela,Sambalpur,Balasore,Chilika', 'Puducherry':'Puducherry,Karaikal,Mahe,Yanam', 'Punjab':'Amritsar,Ludhiana,Jalandhar,Patiala,Bathinda,Pathankot,Hoshiarpur,Mohali', 'Rajasthan':'Jaipur,Jodhpur,Udaipur,Jaisalmer,Bikaner,Ajmer,Pushkar,Mount Abu,Kota,Chittorgarh,Alwar,Bundi', 'Sikkim':'Gangtok,Pelling,Lachung,Lachen,Yumthang,Namchi,Ravangla,Tsongmo Lake', 'Tamil Nadu':'Chennai,Coimbatore,Madurai,Ooty,Kodaikanal,Rameswaram,Kanyakumari,Salem,Thanjavur,Tiruchirappalli,Yercaud', 'Telangana':'Hyderabad,Warangal,Karimnagar,Nizamabad,Khammam,Adilabad', 'Tripura':'Agartala,Udaipur,Dharmanagar,Unakoti', 'Uttar Pradesh':'Lucknow,Agra,Mathura,Vrindavan,Varanasi,Ayodhya,Prayagraj,Kanpur,Noida,Ghaziabad,Meerut,Bareilly,Gorakhpur,Jhansi', 'Uttarakhand':'Dehradun,Rishikesh,Haridwar,Mussoorie,Nainital,Almora,Auli,Joshimath,Kedarnath,Badrinath,Gangotri,Yamunotri,Chopta,Munsiyari,Chakrata,Pithoragarh,Tehri', 'West Bengal':'Kolkata,Darjeeling,Siliguri,Kalimpong,Digha,Durgapur,Asansol,Malda,Mirik,Sundarbans'};
function allGear(){return [...gear,...(Array.isArray(state.customGear)?state.customGear:[])];}
const accountScope=(()=>{try{return localStorage.getItem('mototrip-account-scope')||'guest';}catch(_){return 'guest';}})();
const key=accountScope.startsWith('uid-')?'mototrip-v1-'+accountScope:'mototrip-v1'; let state={trips:[],packed:[],draft:null,bikeName:"",theme:"light"};
function notice(t){$('notice').textContent=t;}
try{const raw=localStorage.getItem(key);if(raw)state={...state,...JSON.parse(raw)};}catch(e){notice('Storage could not be read.');}
// Bike names are legacy metadata only; estimates use mileage, not a bike label.
function bikeName(){return "";}
function profile(){const b=state.bikeProfile||{};return {cc:Number(b.cc)>0?Number(b.cc):250,tank:Number(b.tank)>0?Number(b.tank):13.5,mileage:Number(b.mileage)>0?Number(b.mileage):30};}
function renderBike(){ $("bike-title").textContent="TRAVELING OBSESSION";}
function renderTheme(){const light=state.theme==='light';document.documentElement.dataset.theme=light?'light':'dark';const b=$('theme-toggle');const label=light?'Switch to dark mode':'Switch to light mode';b.textContent=light?'☾':'☀';b.setAttribute('aria-label',label);b.title=label;}
$('theme-toggle').onclick=()=>{state.theme=state.theme==='light'?'dark':'light';persist();renderTheme();};
// One visible report/trip per name (case- and whitespace-insensitive).
// Legacy duplicate records remain in the user's original backup data; never silently delete them.
function tripKey(name){return String(name||'').trim().replace(/\s+/g,' ').toLocaleLowerCase();}
function uniqueTrips(){
 const seen=new Set();return (Array.isArray(state.trips)?state.trips:[]).filter(t=>{
  const k=tripKey(t?.data?.name);if(!k||seen.has(k))return false;
  seen.add(k);return true;
 });
}
function dashboard(){const saved=uniqueTrips(),panel=$('saved-trip-dashboard');if(panel)panel.hidden=!saved.length;
 const totals=saved.reduce((a,t)=>{const c=calc(t.data);a.km+=c.km;a.total+=c.total;return a;},{km:0,total:0});$('dash-trips').textContent=saved.length;$('dash-km').textContent=totals.km.toLocaleString('en-IN')+' km';$('dash-budget').textContent=money(totals.total);}

$("edit-bike").onclick=()=>{$("bike-message").textContent="";refreshMileageCalculator();$("bike-editor").hidden=false;$("mileage-distance").focus();};
$("cancel-bike").onclick=()=>{$("bike-editor").hidden=true;};
// Mileage calculator applies its result directly to the Planner; legacy bike metadata stays unchanged.
let computedMileage=null;
function refreshMileageCalculator(){
 const distanceInput=$("mileage-distance"), expenseInput=$("mileage-expense");
 const d=Number(distanceInput.value), spend=Number(expenseInput.value);
 // This is the same fuel rate shown in the Planner; don't treat rupees as litres.
 const priceInput=form.elements.namedItem('price');
 const visibleRate=$('mileage-petrol-price');
 // The mileage card and Planner share one fuel price, including restored trip drafts.
 if(visibleRate && document.activeElement!==visibleRate && visibleRate.value!==priceInput.value)visibleRate.value=priceInput.value;
 const price=Number(priceInput.value);
 const validRate=priceInput.value.trim()!==''&&Number.isFinite(price)&&price>0;
 const validValues=distanceInput.value.trim()!==''&&expenseInput.value.trim()!==''&&Number.isFinite(d)&&Number.isFinite(spend)&&d>0&&spend>0;
 const litres=validRate&&validValues?spend/price:null;
 computedMileage=litres!==null&&Number.isFinite(litres)&&litres>0?d/litres:null;
 const usable=computedMileage!==null&&Number.isFinite(computedMileage)&&computedMileage>=0.1&&computedMileage<=300;
 const rateText=$("mileage-rate-note");
 rateText.textContent=validRate?`↗ Synced with Planner · Est. fuel used: ${litres===null?'—':litres.toFixed(2)} L`:'↗ Synced with Planner · Enter a petrol price above ₹0/L.';
 $("mileage-result").textContent=usable?computedMileage.toFixed(2)+" km/L":"— km/L";
 $("apply-mileage").disabled=!usable;
 $("mileage-hint").textContent=!validRate?'Enter a petrol price above ₹0/L.':!validValues?'Fill distance, fuel spend and petrol price to see mileage.':!usable?'Result must be between 0.1 and 300 km/L. Check distance, total expense and fuel price.':'✓ Ready! Use mileage to update the Planner.';
}
for(const id of ["mileage-distance","mileage-expense"])$(id).addEventListener("input",refreshMileageCalculator);
// Keep the price editable in both places; no separate duplicate field in saved data.
const mileageRateInput=$('mileage-petrol-price');
if(mileageRateInput)mileageRateInput.addEventListener('input',()=>{
 const next=mileageRateInput.value;
 if(next!=='' && (!Number.isFinite(Number(next)) || Number(next)<0))return;
 const plannerPrice=form.elements.namedItem('price');
 plannerPrice.value=next;
 plannerPrice.dispatchEvent(new Event('input',{bubbles:true}));
 refreshMileageCalculator();
});
form.elements.namedItem('price').addEventListener('input',refreshMileageCalculator);
$("apply-mileage").onclick=()=>{
 if(computedMileage===null||!Number.isFinite(computedMileage)||computedMileage<0.1||computedMileage>300)return;
 const mileage=Number(computedMileage.toFixed(2));
 const oldProfile=state.bikeProfile;
 state.bikeProfile={...profile(),mileage};
 // Keep the existing top calculator, estimate and saved draft synchronized.
 form.elements.mileage.value=String(mileage);
 form.elements.mileage.dispatchEvent(new Event('input',{bubbles:true}));
 renderBike();
 $("bike-message").textContent="Mileage updated in Planner: "+mileage+" km/L.";
};

function persist(){try{localStorage.setItem(key,JSON.stringify(state));return true;}catch(e){notice('Storage unavailable. Export a backup before closing.');return false;}}
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
function read(){const d=Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,v]));const roundField=form.elements.namedItem('round'),fuelField=form.elements.namedItem('includeFuel');d.round=roundField&&roundField.type==='hidden'?String(roundField.value)!=='false':!!roundField?.checked;d.includeFuel=fuelField&&fuelField.type==='hidden'?String(fuelField.value)!=='false':(fuelField?!!fuelField.checked:true);d.stops=Array.isArray(state.routeStops)?state.routeStops.map(s=>({name:String(s.name||'').slice(0,180),lat:Number.isFinite(Number(s.lat))&&s.lat!==null?Number(s.lat):null,lon:Number.isFinite(Number(s.lon))&&s.lon!==null?Number(s.lon):null})).filter(s=>s.name):[{name:d.to,lat:null,lon:null}];return d;}
function fill(d){form.elements.nights.value=d?.nights??0;for(const k of ["departDate","departTime","endDate","endTime"])form.elements[k].value="";form.elements.toll.value="0";for(const k of ['from','to'])for(const suffix of ['Lat','Lon','District']){const e=form.elements[k+suffix];if(e)e.value="";}for(const [k,v] of Object.entries(d||{})){const el=form.elements.namedItem(k);if(el){if(el.type==='checkbox')el.checked=!!v;else el.value=v;}}if(form.elements.includeFuel&&form.elements.includeFuel.type==='hidden')form.elements.includeFuel.value=d?.includeFuel===false?'false':'true';if(form.elements.round&&form.elements.round.type==='hidden')form.elements.round.value=d?.round===false?'false':'true';if(window.restoreGeo)window.restoreGeo(d||{});const incoming=Array.isArray(d?.stops)?d.stops:[];state.routeStops=incoming.length?incoming.filter(s=>s&&typeof s.name==='string'&&s.name.trim()).map(s=>({name:s.name.trim().slice(0,180),lat:typeof s.lat==='number'&&Number.isFinite(s.lat)?s.lat:null,lon:typeof s.lon==='number'&&Number.isFinite(s.lon)?s.lon:null})).slice(0,40):[{name:form.elements.to.value.trim()||(d?.to === '' ? '' : 'Manali'),lat:null,lon:null}];if(!state.routeStops.length)state.routeStops=[{name:form.elements.to.value.trim()||(d?.to === '' ? '' : 'Manali'),lat:null,lon:null}];form.elements.to.value=state.routeStops[state.routeStops.length-1].name;if(window.refreshRoute)window.refreshRoute();}
// Show each estimate independently, even when another form field is incomplete.
// Full validity checks are still performed by the form when saving a trip.
function calc(d){
 const amount=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:0;};
 const oneWay=amount(d.distance), mileage=amount(d.mileage), price=amount(d.price);
 const km=oneWay*(d.round?2:1), litres=mileage>0?km/mileage:0;
 const includeFuel=d.includeFuel!==false&&d.includeFuel!=='false';
 const fuel=includeFuel?litres*price:0;
 const nights=d.nights==null?Math.max(0,amount(d.days)-1):amount(d.nights);
 const stay=nights*amount(d.hotel), food=amount(d.days)*amount(d.food);
 const other=amount(d.extra),toll=amount(d.toll);
 return {km,litres,fuel,stay,food,other,toll,total:fuel+stay+food+other+toll,includeFuel};
}
function node(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function timing(d){if(!d.departDate||!d.departTime||!d.endDate||!d.endTime)return null;const a=new Date(d.departDate+"T"+d.departTime),b=new Date(d.endDate+"T"+d.endTime);return (b-a)/60000;}
function timingLabel(d){const m=timing(d);return m===null?"":m<0?"End must be after departure":`${Math.floor(m/1440)} days ${Math.floor(m%1440/60)} hours ${Math.floor(m%60)} min`;}
function update(save=true){
 const d=read();
 if(save){state.draft=d;persist();}
 $('map').href=window.motoGoogleDirections?window.motoGoogleDirections(0):'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(d.from)+'&destination='+encodeURIComponent(d.to)+'&travelmode=driving';
 $('stats').replaceChildren();$('breakdown').replaceChildren();
 // Estimate values are independent: missing hotel nights/food days must not hide fuel.
 // Form validation is enforced when the user presses Save trip, not while previewing.
 const c=calc(d);


 $('total').textContent=money(c.total);
 for(const [label,value] of [['Distance',c.km+' km'],['Fuel',c.litres.toFixed(1)+' L'],['Petrol',money(c.fuel)]]){
  const el=node('div','','stat');el.append(node('strong',value),node('small',label));$('stats').append(el);
 }
 for(const [label,value] of [['Petrol',c.fuel],['Hotel',c.stay],['Food',c.food],['Toll',c.toll],['Other',c.other]]){
  const el=node('div','','line');el.append(node('span',label),node('strong',money(value)));$('breakdown').append(el);
 }
 const totalRow=node('div','','line breakdown-total');
 totalRow.append(node('strong','Total Estimated Budget'),node('strong',money(c.total)));
 $('breakdown').append(totalRow);
}
// V9.16: Route and Gear remain available in the app, but are opt-in from Trips.
// Settings live alongside the account-scoped local trip data; disabling a tab never erases it.
function isOptionalTabOn(id){return !!(state.optionalTabs&&state.optionalTabs[id]===true);}
function renderOptionalTabs(){
 const nav=$('main-nav');
 for(const id of ['route','gear']){
  const enabled=isOptionalTabOn(id);
  const button=nav.querySelector('button[data-tab="'+id+'"]');
  if(button){button.hidden=!enabled;button.setAttribute('aria-hidden',String(!enabled));}
  const input=$('mt916-toggle-'+id);
  if(input){input.checked=enabled;input.setAttribute('aria-checked',String(enabled));}
  const status=$('mt916-'+id+'-status');
  if(status)status.textContent=enabled?'On':'Off';
 }
 nav.style.setProperty('--mt-nav-count',String(nav.querySelectorAll('button[data-tab]:not([hidden])').length));
}
for(const id of ['route','gear']){
 const input=$('mt916-toggle-'+id);
 if(!input)continue;
 input.addEventListener('change',()=>{
  state.optionalTabs={route:isOptionalTabOn('route'),gear:isOptionalTabOn('gear'),[id]:input.checked};
  persist();
  renderOptionalTabs();
 });
}
function tab(id){
 if((id==='route'||id==='gear')&&!isOptionalTabOn(id))id='trips';
 for(const s of document.querySelectorAll('section'))s.hidden=s.id!==id;
 for(const b of document.querySelectorAll('nav button'))b.classList.toggle('active',b.dataset.tab===id);
 if(id==='route'&&window.onRouteTabOpen)window.onRouteTabOpen();
}
function renderGear(){$('checklist').replaceChildren();for(const g of allGear()){const label=node('label','','check'),input=document.createElement('input');input.type='checkbox';input.checked=state.packed.includes(g);input.onchange=()=>{state.packed=input.checked?[...state.packed,g]:state.packed.filter(x=>x!==g);persist();renderGear();};label.append(input,document.createTextNode(g));if(!gear.includes(g)){const remove=node("button","Remove");remove.type="button";remove.onclick=e=>{e.preventDefault();state.customGear=allGear().filter(x=>!gear.includes(x)&&x!==g);state.packed=state.packed.filter(x=>x!==g);persist();renderGear();};label.append(remove);}$('checklist').append(label);}$('progress').max=allGear().length;$('progress').value=state.packed.length;$('count').textContent=state.packed.length+' / '+allGear().length+' packed';}
$('custom-gear').onsubmit=e=>{e.preventDefault();const g=$('gear-name').value.trim();if(!g||allGear().some(x=>x.toLowerCase()===g.toLowerCase()))return;state.customGear=[...(state.customGear||[]),g];persist();$('gear-name').value='';renderGear();};
function renderTrips(){
 dashboard();$('history').replaceChildren();
 const saved=uniqueTrips();
 if(!saved.length)$('history').append(node('p','No saved trips yet.'));
 for(const t of saved){
  const c=calc(t.data),el=node('article','','trip'),open=node('button','Edit trip'),del=node('button','Delete');
  open.onclick=()=>{fill(t.data);update();if(window.syncSplitTripName)window.syncSplitTripName();if(window.refreshRoute)window.refreshRoute();tab('plan');};
  del.onclick=()=>{
   if(!confirm('Delete saved trip "'+t.data.name+'"? This removes this trip and older duplicate copies of the same name.'))return;
   state.trips=state.trips.filter(x=>tripKey(x.data?.name)!==tripKey(t.data.name));
   persist();renderTrips();
  };
  el.append(node('h2',t.data.name),node('p',(t.data.from||'')+' → '+(t.data.to||'')),node('p',c.km+' km · '+money(c.total)));
  const details=node('details','');details.append(node('summary','Trip details'));
  const info=[['Journey',t.data.round?'Return':'One way'],
   ['Departure', [t.data.departDate,t.data.departTime].filter(Boolean).join(' ')||'Not set'],
   ['End', [t.data.endDate,t.data.endTime].filter(Boolean).join(' ')||'Not set'],
   ['Distance',c.km+' km'],['Mileage',t.data.mileage+' km/L'],
   ['Petrol price',money(Number(t.data.price))+'/L'],['Fuel',money(c.fuel)],
   ['Hotel',money(c.stay)],['Food',money(c.food)],['Toll',money(c.toll)],['Other',money(c.other)],
   ['Total estimated budget',money(c.total)]];
  for(const [label,value] of info){const row=node('div','','line');row.append(node('span',label),node('strong',String(value)));details.append(row);}
  el.append(details,open,del);$('history').append(el);
 }
}
// Save new trips; update the SAME saved trip if its name already exists.
// Does not clear Bill Split or delete previous data. No new copy for repeat saves.
function saveOrUpdateTrip({updateOnly=false,stayOnTab=false}={}){
 const d=read(),name=String(d.name||'').trim(),normalized=tripKey(name);
 if(!form.checkValidity()||!normalized){
  notice('Complete required trip details in Planner, then save your trip.');
  const status=$('split-save-status');if(status)status.textContent='Complete trip details in Planner before saving.';
  if(stayOnTab){tab('plan');setTimeout(()=>{try{form.reportValidity();}catch(_){}},0);}
  return false;
 }
 const match=state.trips.findIndex(t=>tripKey(t.data?.name)===normalized);
 if(updateOnly&&match<0){
  notice('No saved trip with this name yet. Use Save Trip first.');
  const status=$('split-save-status');if(status)status.textContent='No saved trip yet — tap Save Trip first.';
  return false;
 }
 const now=new Date().toISOString(),old=match>=0?state.trips[match]:null;
 const currentGroup=state.split;
 const sameGroup=currentGroup&&tripKey(currentGroup.name)===normalized;
 const splitSnapshot=sameGroup?JSON.parse(JSON.stringify({name:currentGroup.name||name,members:currentGroup.members||[],expenses:currentGroup.expenses||[],transfers:currentGroup.transfers||[]})):old?.splitSnapshot;
 const entry={...(old||{}),id:old?.id||Date.now().toString(),data:d,createdAt:old?.createdAt||now,updatedAt:now};
 delete entry.bikeName; // Do not carry legacy bike-name metadata into saved trips.
 if(splitSnapshot)entry.splitSnapshot=splitSnapshot;
 if(match>=0)state.trips.splice(match,1);
 state.trips.unshift(entry);
 if(!persist())return false;
 renderTrips();
 const selected=$('report-trip-select');if(selected)selected.value=entry.id;
 const message=old?'Trip updated: '+name+'. Saved report will show the latest details.':'Trip saved: '+name+'.';
 notice(message);const status=$('split-save-status');if(status)status.textContent=message;
 if(!stayOnTab)tab('trips');
 return true;
}
function updateSaveButtons(){
 const name=tripKey(form.elements.name.value),found=uniqueTrips().some(t=>tripKey(t.data?.name)===name);
 const plannerButton=$('planner-save-trip');if(plannerButton)plannerButton.textContent=found?'Update Trip':'Save Trip';
 const splitUpdate=$('split-update-trip');if(splitUpdate)splitUpdate.disabled=!found;
}
form.addEventListener('input',e=>{if(e.target.tagName!=='SELECT')update();updateSaveButtons();});form.onsubmit=e=>{e.preventDefault();saveOrUpdateTrip();};$('split-save-trip').addEventListener('click',()=>saveOrUpdateTrip({stayOnTab:true}));$('split-update-trip').addEventListener('click',()=>saveOrUpdateTrip({updateOnly:true,stayOnTab:true}));document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));$('reset').onclick=()=>{state.packed=[];persist();renderGear();};$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='mototrip-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};$('clear-local-data').onclick=()=>{if(!confirm('Permanently delete saved trips, rider expenses, payments, bike profile and settings on this device? This cannot be undone unless you exported a backup.'))return;try{localStorage.removeItem(key);location.reload();}catch(e){notice('Could not delete saved data. Clear this site\'s storage in your browser settings.');}};$('import').onchange=async e=>{try{const file=e.target.files?.[0];if(!file||file.size>12*1024*1024)throw Error('Backup too large');const s=file.name.toLowerCase().endsWith('.xlsx')?await window.motoTripReadXlsx(file):JSON.parse(await file.text());const valid=d=>d&&['name','from','to'].every(k=>typeof d[k]==='string')&&['distance','days','mileage'].every(k=>Number.isFinite(Number(d[k]))&&Number(d[k])>0)&&['price','hotel','food','extra'].every(k=>Number.isFinite(Number(d[k]))&&Number(d[k])>=0)&&(d.toll==null||(Number.isFinite(Number(d.toll))&&Number(d.toll)>=0))&&(d.nights==null||(Number.isInteger(Number(d.nights))&&Number(d.nights)>=0))&&typeof d.round==='boolean'&&(d.includeFuel==null||typeof d.includeFuel==='boolean');if(!Array.isArray(s.trips)||!s.trips.every(t=>t&&typeof t.id==='string'&&valid(t.data))||!Array.isArray(s.packed)||!s.packed.every(g=>gear.includes(g)||(Array.isArray(s.customGear)&&s.customGear.includes(g)))||(s.draft&&!valid(s.draft)&&!(Number(s.draft.distance)===0&&Number(s.draft.days)===0&&Number(s.draft.nights)===0)))throw Error();if(s.split!=null){const g=s.split;if(typeof g!=='object'||!Array.isArray(g.members)||g.members.length>150||!g.members.every(n=>typeof n==='string'&&n.length<=80)||!Array.isArray(g.expenses)||g.expenses.length>15000||!g.expenses.every(e=>e&&typeof e.name==='string'&&e.name.length<=100&&typeof e.payer==='string'&&Number.isSafeInteger(e.amount)&&e.amount>0&&Array.isArray(e.people)&&e.people.every(n=>typeof n==='string'))||!Array.isArray(g.transfers||[])||(g.transfers||[]).length>15000||!(g.transfers||[]).every(x=>x&&typeof x.from==='string'&&typeof x.to==='string'&&Number.isSafeInteger(x.amount)&&x.amount>0))throw Error('Invalid expense data');}if(s.routeStops!=null&&(!Array.isArray(s.routeStops)||s.routeStops.length>40||!s.routeStops.every(x=>x&&typeof x.name==='string'&&x.name.length<=180)))throw Error('Invalid route data');if(confirm('Replace current data with backup?')){state={...s,bikeName:typeof s.bikeName==="string"?s.bikeName:""};persist();renderOptionalTabs();renderTheme();renderBike();fill(state.draft);update(false);renderGear();renderTrips();if(window.renderSplit)window.renderSplit();if(window.refreshRoute)window.refreshRoute();}}catch(err){notice('Could not restore. Choose a MotoTrip Excel/JSON backup (not a CSV or PDF).');}};
renderOptionalTabs();renderTheme();renderBike();fill(state.draft);update(false);renderGear();renderTrips();tab('plan');/* App update registration now lives in app-update.js (V5.0). */

// V2.9: read-only budget comparison for the current planner and active expense group.
function renderBudget(){
 const root=$('budget-actual'); if(!root)return; root.replaceChildren();
 const c=calc(read()), g=typeof group==='function'?group():null;
 const actual=[0,0,0,0,0], estimated=[c.stay,c.food,c.fuel,c.toll,c.other], names=['Hotel','Food','Fuel','Toll','Other'];
 if(g)for(const e of g.expenses){if(!Number.isSafeInteger(e.amount)||e.amount<=0||!g.members.includes(e.payer)||!Array.isArray(e.people)||!e.people.some(p=>g.members.includes(p)))continue;const n=String(e.name).toLowerCase();const i=/toll|fastag/.test(n)?3:/hotel|stay|room|hostel|homestay|lodg|accommodation/.test(n)?0:/food|meal|breakfast|lunch|dinner|snack|restaurant|cafe|tea|coffee/.test(n)?1:/fuel|petrol|diesel|gasoline/.test(n)?2:4;actual[i]+=e.amount/100;}
 const total=actual.reduce((a,b)=>a+b,0),diff=c.total-total, fmt=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n), sign=n=>(n<0?'−':n>0?'+':'')+fmt(Math.abs(n));
 const cards=node('div','','budget-cards');for(const [label,value,cls] of [['Estimated',fmt(c.total),''],['Actual',fmt(total),''],[diff<0?'Over budget':'Remaining',fmt(Math.abs(diff)),diff<0?'budget-red':'budget-green']]){const a=node('div','','stat');a.append(node('small',label),node('strong',value,cls));cards.append(a);}root.append(cards);
 const t=node('table','','budget-table'),h=node('tr');for(const x of ['Category','Estimate','Actual','Difference'])h.append(node('th',x));t.append(h);for(const [i,n] of [...names,'Total'].entries()){const a=i===names.length?c.total:estimated[i],b=i===names.length?total:actual[i],d=a-b,r=node('tr');r.append(node('td',n),node('td',fmt(a)),node('td',fmt(b)),node('td',sign(d),d<0?'budget-red':'budget-green'));t.append(r);}root.append(t);
 const pct=c.total>0?total/c.total*100:null;root.append(node('p','Budget used: '+(pct===null?'—':pct.toFixed(1)+'%')));const bar=document.createElement('progress');bar.max=100;bar.value=pct===null?(total>0?100:0):Math.min(100,pct);root.append(bar,node('p',g&&g.name?'Actual: '+g.name+' · active expense group':'Actual: active expense group · unrecognized expense names count as Other','muted'));
}
const originalUpdate=update;update=function(...args){originalUpdate(...args);renderBudget();};

// V7.1: choose which SAVED trip's real details to export.
// The active planner draft is not a saved trip and is never silently substituted.
const reportSelect=$('report-trip-select');
let reportPickerInitialized=false;
function refreshReportPicker(){
 if(!reportSelect)return;
 const previous=reportSelect.value;
 reportSelect.replaceChildren();
 const saved=uniqueTrips();
 for(const [i,t] of saved.entries()){
   const option=document.createElement('option');option.value=t.id;
   const d=t.data||{};
   option.textContent=(i+1)+'. '+String(d.name||'Unnamed trip')+' · '+String(d.from||'?')+' → '+String(d.to||'?');
   reportSelect.append(option);
 }
 const all=document.createElement('option');all.value='__all__';all.textContent='All saved trips ('+saved.length+')';reportSelect.append(all);
 if(reportPickerInitialized&&[...reportSelect.options].some(o=>o.value===previous))reportSelect.value=previous;
 else reportSelect.value=saved[0]?.id||'__all__';
 reportPickerInitialized=true;
 const hint=$('mt71-report-hint');
 if(hint) hint.textContent=saved.length
   ? saved.length+' saved trip'+(saved.length===1?'':'s')+'. Choose one to download its report.'
   : 'No saved trips in this account/device yet. Save a trip in Planner first.';
 for(const id of ['export-xlsx','export-csv','export-pdf']){
   const button=$(id);if(button)button.disabled=!saved.length;
 }
}
function reportData(){
 const id=reportSelect?.value||'__all__';
 if(id==='__all__')return {...state,trips:uniqueTrips(),__reportAll:true};
 const trip=state.trips.find(t=>t.id===id);
 if(!trip)throw Error('Selected saved trip not found. Choose it again.');
 // A shared expense group's records belong only when its title matches that trip.
 // Otherwise prevent unrelated group spending from appearing in a selected trip report.
 const matched=tripKey(state.split?.name)===tripKey(trip.data?.name);
 const snapshot=trip.splitSnapshot||{name:'',members:[],expenses:[],transfers:[]};
 return {...state,trips:[trip],split:matched?state.split:snapshot,__reportAll:false};
}
const oldRenderTrips=renderTrips;
renderTrips=function(...args){const value=oldRenderTrips(...args);refreshReportPicker();updateSaveButtons();return value;};
refreshReportPicker();updateSaveButtons();

// V4.8: on-device report exports (no data sent to a server).
for(const [id,fn] of [["export-xlsx","motoTripExportXlsx"],["export-csv","motoTripExportCsv"],["export-pdf","motoTripExportPdf"]]){const el=$(id);if(el)el.addEventListener("click",()=>{try{if(!state.trips.length){notice("Save a trip first, then download the report.");return;}const task=window[fn](reportData());if(task&&task.catch)task.catch(e=>{console.error(e);notice("Export failed: "+e.message);});}catch(e){console.error(e);notice("Export failed: "+e.message);}});}
