/* MotoTrip original application code © 2026 Satish Kumar Gupta. Third-party rights unaffected. */
/* MotoTrip V4.6 — GPS with permission + typo-tolerant area-aware search (Photon). */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const start=form.elements.from, destination=form.elements.to, tripName=form.elements.name;
const mapEl=$('route-map'),tiles=$('map-tiles'),markers=$('map-markers'),overlay=$('route-map-overlay');
let view={lat:22.9,lon:79.1,z:5},pending=null,mode='add',editIndex=-1,drag=null,geocodeAt=0,geoRequest=0;
const PHOTON='https://photon.komoot.io';
let lastSearchAt=0;const searchCache=new Map();
const TILE=256,MIN_Z=3,MAX_Z=17;
const boundLat=v=>Math.max(-85.051128,Math.min(85.051128,v));
const boundLon=v=>((v+540)%360)-180;
const validCoord=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
const coord=s=>s&&validCoord(Number(s.lat),Number(s.lon))&&s.lat!==null&&s.lon!==null?{lat:Number(s.lat),lon:Number(s.lon)}:null;
function normalizeStops(){
 if(!Array.isArray(state.routeStops))state.routeStops=[];
 state.routeStops=state.routeStops.filter(s=>s&&typeof s.name==='string').map(s=>({name:s.name.trim().slice(0,180),lat:coord(s)?.lat??null,lon:coord(s)?.lon??null})).slice(0,40);
 if(!state.routeStops.length)state.routeStops=[{name:destination.value.trim()||'Manali',lat:null,lon:null}];
}
function setStatus(s){$('route-status').textContent=s;}
function commit(redraw=true){
 normalizeStops();const last=state.routeStops.at(-1);
 destination.value=last.name;
 form.elements.toLat.value=last.lat??'';form.elements.toLon.value=last.lon??'';
 state.draft=read();persist();update(false);
 if(redraw)refreshRoute();
}
function renameStop(i,text){
 if(!state.routeStops[i])return;
 const name=String(text).trim().slice(0,180);
 if(!name)return;
 if(state.routeStops[i].name!==name){state.routeStops[i].name=name;state.routeStops[i].lat=null;state.routeStops[i].lon=null;if(i===state.routeStops.length-1)state.gpsEndLabel='';}
 commit();
}
// Insert a waypoint BEFORE the final destination, which remains the final destination.
function addStop(text,location=null){
 const name=String(text||'').trim().slice(0,180);
 if(!name){setStatus('Enter a city or select a point on the map.');return false;}
 normalizeStops();if(state.routeStops.length>=40){setStatus('Maximum 40 destinations per trip.');return false;}
 state.routeStops.splice(Math.max(0,state.routeStops.length-1),0,{name,lat:location?.lat??null,lon:location?.lon??null});
 pending=null;mode='add';editIndex=-1;commit();setStatus('Stop added: '+name);return true;
}
function moveStop(i,dir,compact=false){
 const j=i+dir,limit=compact?state.routeStops.length:state.routeStops.length-1;
 if(j<0||j>=limit)return;
 [state.routeStops[i],state.routeStops[j]]=[state.routeStops[j],state.routeStops[i]];commit();
}
function deleteStop(i){
 if(state.routeStops.length===1){setStatus('Keep at least one final destination.');return;}
 state.routeStops.splice(i,1);commit();
}
function reorderStop(from,to,compact){
 const limit=compact?state.routeStops.length:state.routeStops.length-1;
 if(from===to||from<0||to<0||from>=limit||to>=limit)return;
 const [item]=state.routeStops.splice(from,1);state.routeStops.splice(to,0,item);commit();setStatus('Stop order updated.');
}
// Pointer Events work with both touchscreen browsers and a desktop mouse.
function attachDrag(handle,row,index,list,compact){
 let active=false,hit=-1,id=null;
 handle.onpointerdown=e=>{
  if(e.button!==0)return;
  active=true;id=e.pointerId;hit=index;
  handle.setPointerCapture?.(id);row.classList.add('dragging');e.preventDefault();
 };
 handle.onpointermove=e=>{
  if(!active||id!==e.pointerId)return;
  const rows=[...list.children].filter(el=>el.classList.contains('route-stop-row')||el.classList.contains('stop-mini-row'));
  const p=rows.findIndex(el=>{const r=el.getBoundingClientRect();return e.clientY>=r.top&&e.clientY<=r.bottom;});
  if(p>=0){hit=p;rows.forEach((el,n)=>el.classList.toggle('drop-target',n===p&&n!==index));}
 };
 handle.onpointerup=e=>{
  if(!active||id!==e.pointerId)return;
  active=false;handle.releasePointerCapture?.(id);row.classList.remove('dragging');
  [...list.children].forEach(el=>el.classList.remove('drop-target'));
  reorderStop(index,hit,compact);
 };
 handle.onpointercancel=()=>{active=false;row.classList.remove('dragging');[...list.children].forEach(el=>el.classList.remove('drop-target'));};
}
function stopRow(i,compact=false){
 const stop=state.routeStops[i],row=document.createElement('div');row.className=compact?'stop-mini-row':'route-stop-row';
 const grip=document.createElement('button');grip.type='button';grip.className='stop-drag-handle';grip.textContent='⠿';grip.title='Hold and drag to reorder';grip.setAttribute('aria-label','Hold and drag destination '+(i+1));
 const n=document.createElement('span');n.className=compact?'mini-no':'stop-index';n.textContent=compact?(i===state.routeStops.length-1?'END':String(i+1)):String(i+1);
 const field=document.createElement('input');field.type='text';field.maxLength=180;field.value=stop.name;field.autocomplete='off';field.setAttribute('aria-label','Destination '+(i+1));
 field.onchange=()=>{if(field.value.trim())renameStop(i,field.value);else field.value=state.routeStops[i].name;};
 const btns=document.createElement('div');btns.className='stop-actions';
 const make=(name,title,fn)=>{const el=document.createElement('button');el.type='button';el.className='stop-nav-btn';el.textContent=name;el.title=title;el.setAttribute('aria-label',title+' '+(i+1));el.onclick=fn;btns.append(el);return el;};
 const maxIndex=(compact?state.routeStops.length:state.routeStops.length-1)-1;
 make('↑','Move up',()=>moveStop(i,-1,compact)).disabled=i===0;
 make('↓','Move down',()=>moveStop(i,1,compact)).disabled=i===maxIndex;
 const remove=make('×','Remove destination',()=>deleteStop(i));remove.disabled=state.routeStops.length<2;
 row.append(grip,n,field,btns);setupPlaceSuggestions(field,'stop',i);
 attachDrag(grip,row,i,compact?$('inline-stop-list'):$('route-stop-list'),compact);return row;
}
function syncRouteInputs(){
 const rStart=$('route-start-input'),rEnd=$('route-end-input'),rTrip=$('route-trip-name');
 if(rTrip&&document.activeElement!==rTrip)rTrip.value=tripName.value;
 if(document.activeElement!==rStart)rStart.value=start.value;
 if(document.activeElement!==rEnd)rEnd.value=destination.value;
}
function renderLists(){
 const waypoints=state.routeStops.slice(0,-1);
 $('route-stop-list').replaceChildren(...waypoints.map((_,i)=>stopRow(i)));
 $('route-count').textContent=waypoints.length+' stop'+(waypoints.length===1?'':'s');
 // Planner keeps its permanent Route-tab link; stop count remains in Route.
 syncRouteInputs();
}
function googleURL(points){const names=points.map(p=>{if(typeof p==='string')return p;const c=coord(p);return c?c.lat.toFixed(6)+','+c.lon.toFixed(6):p.name;});let url='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(names[0])+'&destination='+encodeURIComponent(names.at(-1))+'&travelmode=driving';const way=names.slice(1,-1);if(way.length)url+='&waypoints='+way.map(encodeURIComponent).join('%7C');return url;}
function legs(){const points=[{name:start.value.trim()||'Delhi',lat:form.elements.fromLat.value?Number(form.elements.fromLat.value):null,lon:form.elements.fromLon.value?Number(form.elements.fromLon.value):null},...state.routeStops];const segments=[];for(let i=0;i<points.length-1;i+=4)segments.push(points.slice(i,Math.min(i+5,points.length)));return segments;}
window.motoGoogleDirections=(index=0)=>googleURL(legs()[index]||legs()[0]);
function renderGoogle(){
 const container=$('google-legs');container.replaceChildren();
 legs().forEach((items,i)=>{
  const row=document.createElement('div'),lab=document.createElement('span'),link=document.createElement('a');row.className='google-leg';
  lab.textContent=(legs().length>1?'Leg '+(i+1)+': ':'')+items[0].name+' → '+items.at(-1).name+(items.length>2?' · via '+(items.length-2)+' stop(s)':'');
  link.href=googleURL(items);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Google Maps ↗';row.append(lab,link);container.append(row);
 });
 $('map').href=window.motoGoogleDirections(0);
 $('map').textContent=legs().length>1?'🗺️ Maps · 1':'🗺️ Maps';
 $('map').setAttribute('aria-label',legs().length>1?'Open route leg 1 in Google Maps':'Open route in Google Maps');
}
function mapXY(lat,lon,z=view.z){
 const scale=TILE*2**z,phi=boundLat(lat)*Math.PI/180;
 return {x:(lon+180)/360*scale,y:(1-Math.asinh(Math.tan(phi))/Math.PI)/2*scale};
}
function mapLL(x,y,z=view.z){const scale=TILE*2**z;return {lon:boundLon(x/scale*360-180),lat:Math.atan(Math.sinh(Math.PI*(1-2*y/scale)))*180/Math.PI};}
function localXY(p){const w=mapEl.clientWidth,h=mapEl.clientHeight,c=mapXY(view.lat,view.lon),world=TILE*2**view.z,v=mapXY(p.lat,p.lon);let dx=v.x-c.x;if(dx>world/2)dx-=world;if(dx< -world/2)dx+=world;return {x:w/2+dx,y:h/2+v.y-c.y};}
function drawMap(){
 if($('route').hidden||!mapEl.clientWidth)return;
 const width=mapEl.clientWidth,height=mapEl.clientHeight,c=mapXY(view.lat,view.lon),max=2**view.z;
 const x0=Math.floor((c.x-width/2)/TILE),y0=Math.floor((c.y-height/2)/TILE);
 const x1=Math.ceil((c.x+width/2)/TILE),y1=Math.ceil((c.y+height/2)/TILE);
 const newTiles=document.createDocumentFragment(),cached=new Map([...tiles.children].map(el=>[el.dataset.key,el]));
 for(let x=x0;x<x1;x++)for(let y=y0;y<y1;y++){
  if(y<0||y>=max)continue;
  const key=view.z+':'+x+':'+y;const img=cached.get(key)||document.createElement('img');cached.delete(key);img.dataset.key=key;img.alt='';img.draggable=false;img.loading='lazy';if(!img.getAttribute('src'))img.src='https://tile.openstreetmap.org/'+view.z+'/'+((x%max+max)%max)+'/'+y+'.png';
  img.style.left=(x*TILE-c.x+width/2)+'px';img.style.top=(y*TILE-c.y+height/2)+'px';newTiles.append(img);
 }
 tiles.replaceChildren(newTiles);markers.replaceChildren();overlay.replaceChildren();overlay.setAttribute('viewBox','0 0 '+width+' '+height);
 const all=[{name:start.value,lat:form.elements.fromLat.value?Number(form.elements.fromLat.value):null,lon:form.elements.fromLon.value?Number(form.elements.fromLon.value):null},...state.routeStops];
 const svgNS='http://www.w3.org/2000/svg';
 for(let i=1;i<all.length;i++){const a=coord(all[i-1]),b=coord(all[i]);if(!a||!b)continue;const u=localXY(a),v=localXY(b);const seg=document.createElementNS(svgNS,'line');seg.setAttribute('x1',u.x);seg.setAttribute('y1',u.y);seg.setAttribute('x2',v.x);seg.setAttribute('y2',v.y);seg.setAttribute('stroke','#ff743a');seg.setAttribute('stroke-width','4');seg.setAttribute('stroke-dasharray','8 6');seg.setAttribute('stroke-linecap','round');overlay.append(seg);}
 for(let i=0;i<all.length;i++){const c=coord(all[i]);if(!c)continue;const p=localXY(c),pin=document.createElement('div');pin.className='map-pin '+(i===0?'start':i===all.length-1?'end':'');pin.textContent=i===0?'S':i;pin.title=all[i].name;pin.style.left=p.x+'px';pin.style.top=p.y+'px';markers.append(pin);}
 if(pending){const p=localXY(pending),pin=document.createElement('div');pin.className='map-pin pending';pin.textContent='+';pin.style.left=p.x+'px';pin.style.top=p.y+'px';markers.append(pin);}
}
function changeZoom(next){view.z=Math.max(MIN_Z,Math.min(MAX_Z,next));drawMap();}
function fitStops(){
 const all=[];const startCoords=coord({lat:form.elements.fromLat.value||null,lon:form.elements.fromLon.value||null});if(startCoords)all.push(startCoords);
 for(const s of state.routeStops){const c=coord(s);if(c)all.push(c);}
 if(pending)all.push(pending);
 if(!all.length){view={lat:22.9,lon:79.1,z:5};drawMap();setStatus('Choose a suggested place, or tap My location.');return;}
 if(all.length===1){view={...all[0],z:10};drawMap();return;}
 const lats=all.map(v=>v.lat),lons=all.map(v=>v.lon);view.lat=(Math.max(...lats)+Math.min(...lats))/2;view.lon=(Math.max(...lons)+Math.min(...lons))/2;
 const w=Math.max(180,mapEl.clientWidth-65),h=Math.max(180,mapEl.clientHeight-65);
 for(let z=13;z>=MIN_Z;z--){const a=mapXY(Math.max(...lats),Math.min(...lons),z),b=mapXY(Math.min(...lats),Math.max(...lons),z);if(Math.abs(a.x-b.x)<w&&Math.abs(a.y-b.y)<h){view.z=z;break;}}
 drawMap();
}
function panBy(dx,dy){const c=mapXY(view.lat,view.lon),v=mapLL(c.x-dx,c.y-dy);view.lat=v.lat;view.lon=v.lon;drawMap();}
async function reverseLookup(p){
 try{
  const url=PHOTON+'/reverse?lat='+encodeURIComponent(p.lat)+'&lon='+encodeURIComponent(p.lon)+'&limit=1';
  const response=await fetch(url,{headers:{Accept:'application/json'}});
  if(!response.ok)return null;
  const f=(await response.json()).features?.[0];
  return f?placeLabel(f.properties):null;
 }catch{return null;}
}
function parseCoords(q){
 const s=q.trim();
 const match=(s.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/)||s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)||s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)||s.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?)[,%2C]+(-?\d+(?:\.\d+)?)/i));
 if(!match)return null;const lat=Number(match[1]),lon=Number(match[2]);return validCoord(lat,lon)?{lat,lon}:null;
}
async function findPlace(){const field=$('route-search');if(!field.value.trim()){setStatus('Type a city or place to search.');return;}await showPlaceSuggestions(field,'add',-1,true);}

// Place search uses Photon, which is intended for autocomplete. It is NOT backed by
// the public Nominatim autocomplete (which Nominatim's usage policy forbids).
function placeLabel(p){
 const fields=[p.name||p.street||p.city||p.locality||p.county||'Selected location',p.city,p.county,p.state,p.country];
 return [...new Set(fields.map(x=>String(x||'').trim()).filter(Boolean))].join(', ').slice(0,180);
}
function placeDetails(p){return [...new Set([p.city,p.county,p.state,p.country].map(x=>String(x||'').trim()).filter(Boolean))].join(' · ');}
function candidate(f){
 const coords=f?.geometry?.coordinates,p=f?.properties||{};
 if(!Array.isArray(coords)||!validCoord(Number(coords[1]),Number(coords[0])))return null;
 return {label:placeLabel(p),detail:placeDetails(p),lat:Number(coords[1]),lon:Number(coords[0]),state:String(p.state||''),county:String(p.county||'')};
}
async function findSuggestions(q){
 const key=q.toLowerCase().trim();if(searchCache.has(key))return searchCache.get(key);
 const now=Date.now();if(now-lastSearchAt<350)await new Promise(res=>setTimeout(res,350-(now-lastSearchAt)));
 lastSearchAt=Date.now();
 const url=PHOTON+'/api/?q='+encodeURIComponent(q)+'&limit=6&lang=en&lat=22.9&lon=79.1';
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6500);
 try{
  const r=await fetch(url,{headers:{Accept:'application/json'},signal:controller.signal});
  if(!r.ok)throw Error('Location search temporarily unavailable');
  const result=(await r.json()).features?.map(candidate).filter(Boolean)||[];
  if(searchCache.size>80)searchCache.clear();searchCache.set(key,result);return result;
 }finally{clearTimeout(timeout);}
}
let activePopup=null,activeInput=null;
function closePlacePopup(){if(activeInput)activeInput.setAttribute('aria-expanded','false');if(activePopup){activePopup.remove();activePopup=null;}activeInput=null;}
function setSelectedPlace(kind,place,index=-1){
 const name=place.label,lat=place.lat,lon=place.lon;
 if(kind==='start'||kind==='planner-start'){
  start.value=name;$('route-start-input').value=name;
  state.gpsStartLabel=place.isGps===true?name:'';
  form.elements.fromLat.value=lat;form.elements.fromLon.value=lon;
  form.elements.fromState.value=place.state||'';form.elements.fromDistrict.value=place.county||'';
  state.draft=read();persist();update(false);renderGoogle();drawMap();
 }else if(kind==='end'||kind==='planner-end'){
  normalizeStops();state.routeStops[state.routeStops.length-1]={name,lat,lon};
  state.gpsEndLabel=place.isGps===true?name:'';
  form.elements.toState.value=place.state||'';form.elements.toDistrict.value=place.county||'';commit();
 }else if(kind==='stop'){
  if(!state.routeStops[index])return;
  state.routeStops[index]={name,lat,lon};commit();
 }else if(kind==='add'){
  $('route-search').value=name;pending={lat,lon};drawMap();
  setStatus('Selected '+name+'. Tap + Add stop to add it to your route.');
 }
 if($('map-preview-details').open)requestAnimationFrame(fitStops);
 if(kind!=='add')setStatus('Selected: '+name+'. You can edit this anytime.');
}
function placePopupAt(input,popup){
 const r=input.getBoundingClientRect(),width=Math.min(Math.max(r.width,260),window.innerWidth-20);
 popup.style.width=width+'px';popup.style.left=Math.max(10,Math.min(window.innerWidth-width-10,r.left))+'px';
 const space=window.innerHeight-r.bottom;
 if(space<220&&r.top>235){popup.style.top='auto';popup.style.bottom=(window.innerHeight-r.top+4)+'px';}
 else{popup.style.bottom='auto';popup.style.top=(r.bottom+4)+'px';}
}
async function showPlaceSuggestions(input,kind,index=-1,forced=false){
 const value=input.value.trim(),requestKey=value;
 if(value.length<3){if(!forced)closePlacePopup();return;}
 if(!input.isConnected)return;
 closePlacePopup();
 const popup=document.createElement('div');popup.className='place-suggestions';popup.setAttribute('role','listbox');
 popup.setAttribute('aria-label','Choose location and state');
 activePopup=popup;activeInput=input;input.setAttribute('aria-expanded','true');document.body.append(popup);placePopupAt(input,popup);
 const loading=document.createElement('div');loading.className='place-suggestion-message';loading.textContent='Finding places…';popup.append(loading);
 let options;
 try{options=await findSuggestions(value);}catch{options=null;}
 if(activePopup!==popup||input.value.trim()!==requestKey||!input.isConnected){if(activePopup===popup)closePlacePopup();return;}
 popup.replaceChildren();
 if(options===null||options.length===0){const message=document.createElement('div');message.className='place-suggestion-message';message.textContent=options===null?'Search unavailable. You can still enter the full city and state manually.':'No match found. Try city + state (e.g. Bilaspur, Chhattisgarh).';popup.append(message);return;}
 for(const o of options){
  const b=document.createElement('button');b.type='button';b.className='place-suggestion';b.setAttribute('role','option');b.tabIndex=0;
  const name=document.createElement('strong');name.textContent=o.label.split(', ')[0];
  const region=document.createElement('small');region.textContent=o.detail||o.label;
  b.append(name,region);b.addEventListener('pointerdown',e=>e.preventDefault());
  b.onclick=()=>{closePlacePopup();setSelectedPlace(kind,o,index);};popup.append(b);
 }
}
function setupPlaceSuggestions(input,kind,index=-1){
 if(input.dataset.smartPlace)return;input.dataset.smartPlace='1';
 input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
 let timer;
 function queue(immediate=false){
  clearTimeout(timer);closePlacePopup();
  if(input.value.trim().length>=3)timer=setTimeout(()=>showPlaceSuggestions(input,kind,index),immediate?0:400);
 }
 // Also show matches when a user taps an already-filled Delhi/Manali field.
 input.addEventListener('focus',()=>queue(true));
 input.addEventListener('input',()=>queue(false));
 input.addEventListener('blur',()=>{setTimeout(()=>{if(document.activeElement!==input&&!activePopup?.contains(document.activeElement))closePlacePopup();},220);});
 input.addEventListener('keydown',e=>{
  if(e.key==='Escape')closePlacePopup();
  if(e.key==='ArrowDown'&&activePopup&&activeInput===input){const first=activePopup.querySelector('button.place-suggestion');if(first){e.preventDefault();first.focus();}}
 });
}
document.addEventListener('pointerdown',e=>{if(activePopup&&!activePopup.contains(e.target)&&!e.target.closest?.('input'))closePlacePopup();});
window.addEventListener('resize',()=>closePlacePopup());
function clearLocation(which){
 geoRequest+=1; // Prevent a pending GPS lookup restoring a cleared place.
 $('pick-start').disabled=false;$('pick-end').disabled=false;
 closePlacePopup();
 if(which==='start'){
  start.value='';$('route-start-input').value='';
  state.gpsStartLabel='';
  form.elements.fromLat.value='';form.elements.fromLon.value='';
  form.elements.fromState.value='';form.elements.fromDistrict.value='';
  state.draft=read();persist();renderGoogle();drawMap();
 }else{
  normalizeStops();state.routeStops[state.routeStops.length-1]={name:'',lat:null,lon:null};
  destination.value='';$('route-end-input').value='';
  state.gpsEndLabel='';
  form.elements.toLat.value='';form.elements.toLon.value='';
  form.elements.toState.value='';form.elements.toDistrict.value='';
  state.draft=read();persist();renderGoogle();drawMap();
 }
 update(false); // Refresh Planner trip card immediately after Clear.
 if($('map-preview-details').open)requestAnimationFrame(fitStops);
 setStatus('Location cleared. Search again or tap My location.');
}
async function useMyLocation(which){
 closePlacePopup();
 if(!navigator.geolocation){setStatus('Location not available in this browser. You can still search by city and state.');return;}
 if(!window.isSecureContext){setStatus('GPS needs HTTPS. Open the live MotoTrip website (not a downloaded file).');return;}
 const button=which==='start'?$('pick-start'):which==='end'?$('pick-end'):$('route-pin-mode');
 button.disabled=true;const requestId=++geoRequest;setStatus('Waiting for your phone’s location permission…');
 navigator.geolocation.getCurrentPosition(async pos=>{
  if(requestId!==geoRequest)return;
  button.disabled=false;
  const p={lat:pos.coords.latitude,lon:pos.coords.longitude};
  if(!validCoord(p.lat,p.lon)){setStatus('Location was invalid. Try searching for the place instead.');return;}
  const raw=p.lat.toFixed(6)+', '+p.lon.toFixed(6);
  const label=await reverseLookup(p)||'My location ('+raw+')';
  if(requestId!==geoRequest)return; // User may have tapped Clear during reverse lookup.
  const point={label,lat:p.lat,lon:p.lon,state:'',county:'',isGps:true};
  if(which==='add'){
   if(!addStop(label,p)){setStatus('Could not add location; maximum stops may be reached.');return;}
  }else setSelectedPlace(which,point);
  view={...p,z:11};if($('map-preview-details').open)fitStops();
  setStatus('✓ My location selected ('+Math.round(pos.coords.accuracy)+' m reported GPS accuracy). Tap ✕ Clear to remove it, or edit the field.');
 },err=>{
  if(requestId!==geoRequest)return;
  button.disabled=false;
  const label=err.code===1?'Location permission denied. Enable location in phone settings or type your city.':err.code===3?'GPS timed out. Try outdoors or search by city.':'Could not find GPS location. Search for a city instead.';
  setStatus(label);
 },{enableHighAccuracy:true,timeout:14000,maximumAge:30000});
}

const routeTrip=$('route-trip-name');
if(routeTrip){
 routeTrip.addEventListener('input',e=>{
  tripName.value=e.target.value;
  tripName.dispatchEvent(new Event('input',{bubbles:true}));
  state.draft=read();persist();update(false);
 });
 tripName.addEventListener('input',()=>{
  if(document.activeElement!==routeTrip)routeTrip.value=tripName.value;
 });
}
setupPlaceSuggestions($('route-start-input'),'start');
setupPlaceSuggestions($('route-end-input'),'end');
setupPlaceSuggestions($('route-search'),'add');
setupPlaceSuggestions(start,'planner-start');
setupPlaceSuggestions(destination,'planner-end');
function refreshRoute(){normalizeStops();renderLists();renderGoogle();drawMap();}
window.refreshRoute=refreshRoute;
window.onRouteTabOpen=()=>{refreshRoute();if($('map-preview-details').open)requestAnimationFrame(()=>fitStops());};
$('map-preview-details').addEventListener('toggle',e=>{if(e.target.open)requestAnimationFrame(()=>fitStops());});
$('route-add').onclick=()=>{const value=$('route-search').value.trim(),co=pending||parseCoords(value);if(addStop(value,co))$('route-search').value='';};
$('route-find').onclick=findPlace;
$('route-search').oninput=e=>{$('route-google-search').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(e.target.value.trim()||'India');pending=null;};
$('route-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('route-add').click();}};
$('route-pin-mode').onclick=()=>useMyLocation('add');
$('pick-start').onclick=()=>useMyLocation('start');
$('pick-end').onclick=()=>useMyLocation('end');
$('clear-route-start').onclick=()=>clearLocation('start');
$('clear-route-end').onclick=()=>clearLocation('end');
$('route-back-planner').onclick=()=>{tab('plan');document.querySelector('.dest-fieldset').scrollIntoView({block:'nearest',behavior:'smooth'});};
$('route-zoom-in').onclick=()=>changeZoom(view.z+1);$('route-zoom-out').onclick=()=>changeZoom(view.z-1);$('route-fit').onclick=fitStops;
$('route-start-input').addEventListener('input',e=>{start.value=e.target.value;state.gpsStartLabel='';form.elements.fromLat.value='';form.elements.fromLon.value='';form.elements.fromState.value='';form.elements.fromDistrict.value='';state.draft=read();persist();update(false);renderGoogle();drawMap();});
$('route-end-input').addEventListener('input',e=>{
 normalizeStops();const last=state.routeStops.at(-1);last.name=e.target.value;last.lat=null;last.lon=null;state.gpsEndLabel='';
 destination.value=e.target.value;form.elements.toLat.value='';form.elements.toLon.value='';form.elements.toState.value='';form.elements.toDistrict.value='';state.draft=read();persist();update(false);renderGoogle();drawMap();
});
$('route-end-input').addEventListener('change',e=>{if(!e.target.value.trim()){e.target.value=destination.value;return;}state.routeStops.at(-1).name=e.target.value.trim();commit();});
start.addEventListener('input',()=>{state.gpsStartLabel='';form.elements.fromLat.value='';form.elements.fromLon.value='';$('route-start-input').value=start.value;renderGoogle();drawMap();});
destination.addEventListener('input',()=>{state.gpsEndLabel='';normalizeStops();const s=state.routeStops.at(-1);if(s.name!==destination.value){s.name=destination.value;s.lat=null;s.lon=null;form.elements.toLat.value='';form.elements.toLon.value='';}syncRouteInputs();renderLists();renderGoogle();drawMap();});
mapEl.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};mapEl.setPointerCapture(e.pointerId);});
mapEl.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>8)drag.moved=true;if(drag.moved)panBy(dx,dy);drag.lastX=e.clientX;drag.lastY=e.clientY;});
mapEl.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;drag=null;});
mapEl.addEventListener('pointercancel',()=>drag=null);
mapEl.addEventListener('wheel',e=>{e.preventDefault();changeZoom(view.z+(e.deltaY<0?1:-1));},{passive:false});
window.addEventListener('resize',()=>{if(!$('route').hidden)drawMap();});
// Initial V3.8 data preserved; only the new routeStops field is introduced.
refreshRoute();update(false);
})();
