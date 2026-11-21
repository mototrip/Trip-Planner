/* MotoTrip V3.9 — multi-stop planner. No external JS dependencies. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const start=form.elements.from, destination=form.elements.to;
const mapEl=$('route-map'),tiles=$('map-tiles'),markers=$('map-markers'),overlay=$('route-map-overlay');
let view={lat:22.9,lon:79.1,z:5},pending=null,mode='add',editIndex=-1,drag=null,geocodeAt=0,geoRequest=0;
const TILE=256,MIN_Z=3,MAX_Z=17;
const boundLat=v=>Math.max(-85.051128,Math.min(85.051128,v));
const boundLon=v=>((v+540)%360)-180;
const validCoord=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
const coord=s=>s&&validCoord(Number(s.lat),Number(s.lon))&&s.lat!==null&&s.lon!==null?{lat:Number(s.lat),lon:Number(s.lon)}:null;
function normalizeStops(){
 if(!Array.isArray(state.routeStops))state.routeStops=[];
 state.routeStops=state.routeStops.filter(s=>s&&typeof s.name==='string'&&s.name.trim()).map(s=>({name:s.name.trim().slice(0,180),lat:coord(s)?.lat??null,lon:coord(s)?.lon??null})).slice(0,40);
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
 const name=text.trim().slice(0,180);
 if(!name)return;
 if(state.routeStops[i].name!==name){state.routeStops[i].name=name;state.routeStops[i].lat=null;state.routeStops[i].lon=null;}
 commit(false);drawMap();renderGoogle();
}
function addStop(text,location=null){
 const name=String(text||'').trim().slice(0,180);
 if(!name){setStatus('Enter a destination name or pick a point on the map.');return false;}
 normalizeStops();if(state.routeStops.length>=40){setStatus('Maximum 40 destinations per trip.');return false;}
 state.routeStops.push({name,lat:location?.lat??null,lon:location?.lon??null});
 pending=null;mode='add';editIndex=-1;commit();setStatus(name+' added as the final destination.');return true;
}
function moveStop(i,dir){const j=i+dir;if(j<0||j>=state.routeStops.length)return;[state.routeStops[i],state.routeStops[j]]=[state.routeStops[j],state.routeStops[i]];commit();}
function deleteStop(i){if(state.routeStops.length===1){setStatus('Keep at least one destination.');return;}state.routeStops.splice(i,1);commit();}
function stopRow(i,compact=false){
 const stop=state.routeStops[i],row=document.createElement('div');row.className=compact?'stop-mini-row':'route-stop-row';
 const n=document.createElement('span');n.className=compact?'mini-no':'stop-index';n.textContent=i+1;
 const field=document.createElement('input');field.type='text';field.maxLength=180;field.value=stop.name;field.setAttribute('aria-label','Destination '+(i+1));field.onchange=()=>{if(field.value.trim())renameStop(i,field.value);else field.value=state.routeStops[i].name;refreshRoute();};
 const btns=document.createElement('div');btns.className='stop-actions';
 const b=(name,title,action)=>{const el=document.createElement('button');el.type='button';el.textContent=name;el.title=title;el.setAttribute('aria-label',title+' destination '+(i+1));el.onclick=action;btns.append(el);return el;};
 if(!compact){b('↑','Move up',()=>moveStop(i,-1)).disabled=i===0;b('↓','Move down',()=>moveStop(i,1)).disabled=i===state.routeStops.length-1;b('📍','Pick location on map',()=>{mode='edit';editIndex=i;tab('route');setStatus('Tap the map to update destination '+(i+1)+' ('+stop.name+').');});}
 b('×','Remove',()=>deleteStop(i)).disabled=state.routeStops.length<2;
 row.append(n,field,btns);return row;
}
function renderLists(){
 $('route-stop-list').replaceChildren(...state.routeStops.map((_,i)=>stopRow(i)));
 $('inline-stop-list').replaceChildren(...state.routeStops.map((_,i)=>stopRow(i,true)));
 $('route-count').textContent=state.routeStops.length+' destination'+(state.routeStops.length===1?'':'s');$('selected-stop-summary').textContent=state.routeStops.length+' destination'+(state.routeStops.length===1?'':'s')+' selected';
 $('route-start-label').textContent=start.value.trim()||'Choose starting point';
}
function googleURL(points){const names=points.map(p=>typeof p==='string'?p:p.name);let url='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(names[0])+'&destination='+encodeURIComponent(names.at(-1))+'&travelmode=driving';const way=names.slice(1,-1);if(way.length)url+='&waypoints='+way.map(encodeURIComponent).join('%7C');return url;}
function legs(){const points=[{name:start.value.trim()||'Delhi'},...state.routeStops];const segments=[];for(let i=0;i<points.length-1;i+=4)segments.push(points.slice(i,Math.min(i+5,points.length)));return segments;}
window.motoGoogleDirections=(index=0)=>googleURL(legs()[index]||legs()[0]);
function renderGoogle(){
 const container=$('google-legs');container.replaceChildren();
 legs().forEach((items,i)=>{
  const row=document.createElement('div'),lab=document.createElement('span'),link=document.createElement('a');row.className='google-leg';
  lab.textContent=(legs().length>1?'Leg '+(i+1)+': ':'')+items[0].name+' → '+items.at(-1).name+(items.length>2?' · via '+(items.length-2)+' stop(s)':'');
  link.href=googleURL(items);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Google Maps ↗';row.append(lab,link);container.append(row);
 });
 $('map').href=window.motoGoogleDirections(0);
 $('map').textContent=legs().length>1?'Open Google Maps · first route leg ↗':'Open full route in Google Maps ↗';
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
 if(!all.length){view={lat:22.9,lon:79.1,z:5};drawMap();setStatus('Search a place or tap the map to choose location pins.');return;}
 if(all.length===1){view={...all[0],z:10};drawMap();return;}
 const lats=all.map(v=>v.lat),lons=all.map(v=>v.lon);view.lat=(Math.max(...lats)+Math.min(...lats))/2;view.lon=(Math.max(...lons)+Math.min(...lons))/2;
 const w=Math.max(180,mapEl.clientWidth-65),h=Math.max(180,mapEl.clientHeight-65);
 for(let z=13;z>=MIN_Z;z--){const a=mapXY(Math.max(...lats),Math.min(...lons),z),b=mapXY(Math.min(...lats),Math.max(...lons),z);if(Math.abs(a.x-b.x)<w&&Math.abs(a.y-b.y)<h){view.z=z;break;}}
 drawMap();
}
function panBy(dx,dy){const c=mapXY(view.lat,view.lon),v=mapLL(c.x-dx,c.y-dy);view.lat=v.lat;view.lon=v.lon;drawMap();}
function setMode(newMode,index=-1){mode=newMode;editIndex=index;setStatus(newMode==='start'?'Tap the map to set starting point.':newMode==='edit'?'Tap the map to change destination '+(index+1)+'.':'Tap the map, then press Add destination.');}
async function reverseLookup(p){
 const token=++geoRequest;const now=Date.now();if(now-geocodeAt<1100)return null;geocodeAt=now;
 try{const r=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+p.lat.toFixed(6)+'&lon='+p.lon.toFixed(6)+'&zoom=14',{headers:{Accept:'application/json'}});if(!r.ok||token!==geoRequest)return null;const d=await r.json();return String(d.name||d.display_name||'').split(',').slice(0,3).join(', ').slice(0,180)||null;}catch{return null;}
}
async function selected(p){
 if(!validCoord(p.lat,p.lon))return;
 const token=++geoRequest; // invalidate any prior lookup
 const label=p.lat.toFixed(5)+', '+p.lon.toFixed(5);
 if(mode==='start'){
  start.value=label;form.elements.fromLat.value=p.lat;form.elements.fromLon.value=p.lon;mode='add';commit();setStatus('Starting point selected. Looking up place name…');
  const name=await reverseLookup(p);if(!name||token>geoRequest)return;
  if(start.value===label){start.value=name;commit();setStatus('Starting point: '+name);}
 }else if(mode==='edit'&&state.routeStops[editIndex]){
  const i=editIndex;state.routeStops[i]={name:label,lat:p.lat,lon:p.lon};mode='add';editIndex=-1;commit();setStatus('Destination updated. Looking up place name…');
  const name=await reverseLookup(p);if(!name||!state.routeStops[i]||state.routeStops[i].name!==label)return;
  state.routeStops[i].name=name;commit();setStatus('Destination '+(i+1)+': '+name);
 }else{
  pending=p;$('route-search').value=label;drawMap();setStatus('Pin selected: '+label+'. Press Add destination to save this stop.');
  const name=await reverseLookup(p);if(!name||!pending||pending.lat!==p.lat||pending.lon!==p.lon)return;
  if($('route-search').value===label)$('route-search').value=name;
  setStatus('Selected: '+name+'. Press Add destination to save.');
 }
}
function parseCoords(q){
 const s=q.trim();
 const match=(s.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/)||s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)||s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)||s.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?)[,%2C]+(-?\d+(?:\.\d+)?)/i));
 if(!match)return null;const lat=Number(match[1]),lon=Number(match[2]);return validCoord(lat,lon)?{lat,lon}:null;
}
async function findPlace(){
 const raw=$('route-search').value.trim();if(!raw){setStatus('Type a place to search.');return;}
 const coords=parseCoords(raw);
 if(coords){pending=coords;view={...coords,z:12};$('route-search').value=coords.lat.toFixed(5)+', '+coords.lon.toFixed(5);drawMap();setStatus('Location found. Press Add destination to save.');return;}
 if(/^https?:\/\//i.test(raw)){setStatus('Short Google Maps links cannot be read here. Paste the place name or a full Maps URL with @latitude,longitude.');return;}
 if(Date.now()-geocodeAt<1100){setStatus('Please wait a second before the next map search.');return;}geocodeAt=Date.now();setStatus('Searching for '+raw+'…');$('route-find').disabled=true;
 try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(raw),{headers:{Accept:'application/json'}});if(!r.ok)throw Error('Geocoding request failed');const result=(await r.json())[0];if(!result)throw Error('No matching place found');const p={lat:Number(result.lat),lon:Number(result.lon)};pending=p;view={...p,z:Math.min(12,Math.max(6,Number(result.type==='city'?10:12)))};drawMap();setStatus('Found: '+String(result.display_name).split(',').slice(0,3).join(', ')+'. Press Add destination to save.');}catch(e){pending=null;setStatus('Map lookup unavailable or no result. You can still add the typed place name.');}finally{$('route-find').disabled=false;}
}
function refreshRoute(){normalizeStops();renderLists();renderGoogle();drawMap();}
window.refreshRoute=refreshRoute;
window.onRouteTabOpen=()=>{refreshRoute();requestAnimationFrame(()=>{fitStops();});};
$('edit-destinations').onclick=()=>{const panel=$('inline-stops'),open=panel.hidden;panel.hidden=!open;$('edit-destinations').setAttribute('aria-expanded',String(open));$('edit-destinations').textContent=open?'Close Stops':'Edit Stops';if(open)renderLists();};
$('inline-open-map').onclick=()=>tab('route');
$('inline-add-stop').onclick=()=>{if(addStop($('inline-stop-name').value))$('inline-stop-name').value='';};
$('inline-stop-name').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('inline-add-stop').click();}};
$('route-add').onclick=()=>{const value=$('route-search').value.trim(),co=pending||parseCoords(value);if(addStop(value,co))$('route-search').value='';};
$('route-find').onclick=findPlace;
$('route-search').oninput=e=>{$('route-google-search').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(e.target.value.trim()||'India');pending=null;};$('route-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();findPlace();}};
$('route-pin-mode').onclick=()=>setMode('add');
$('pick-start').onclick=()=>setMode('start');
$('route-back-planner').onclick=()=>{tab('plan');document.querySelector('.dest-fieldset').scrollIntoView({block:'nearest',behavior:'smooth'});};
$('route-zoom-in').onclick=()=>changeZoom(view.z+1);$('route-zoom-out').onclick=()=>changeZoom(view.z-1);$('route-fit').onclick=fitStops;
start.addEventListener('input',()=>{form.elements.fromLat.value='';form.elements.fromLon.value='';$('route-start-label').textContent=start.value;renderGoogle();drawMap();});
destination.addEventListener('input',()=>{normalizeStops();const s=state.routeStops.at(-1);if(s.name!==destination.value){s.name=destination.value;s.lat=null;s.lon=null;form.elements.toLat.value='';form.elements.toLon.value='';}renderLists();renderGoogle();drawMap();});
mapEl.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};mapEl.setPointerCapture(e.pointerId);});
mapEl.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>8)drag.moved=true;if(drag.moved)panBy(dx,dy);drag.lastX=e.clientX;drag.lastY=e.clientY;});
mapEl.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(moved)return;const r=mapEl.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,c=mapXY(view.lat,view.lon);selected(mapLL(c.x+dx,c.y+dy));});
mapEl.addEventListener('pointercancel',()=>drag=null);
mapEl.addEventListener('wheel',e=>{e.preventDefault();changeZoom(view.z+(e.deltaY<0?1:-1));},{passive:false});
window.addEventListener('resize',()=>{if(!$('route').hidden)drawMap();});
// Initial V3.8 data preserved; only the new routeStops field is introduced.
refreshRoute();update(false);
})();
