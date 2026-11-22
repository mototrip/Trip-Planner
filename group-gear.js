/* MotoTrip V7.6: per-rider collaborative packing board.
 * Copyright (c) 2026 Satish Kumar Gupta.
 * Each joined member writes only their own packing document. The shared list of
 * custom gear is separate so concurrent checked items cannot overwrite each other.
 */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const root=$('mt76-group-packing'), table=$('mt76-board-table'), status=$('mt76-board-status');
 if(!root||!window.motoTripSharedRide)return;
 const defaults=['Helmet','Riding jacket','Gloves','Riding boots','Raincoat','First aid kit',
  'Driving licence','RC & insurance','Puncture kit','Power bank','Chain lubricant','Tool kit'];
 const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 let ctx=null,rideId='',uid='',myName='',custom=[],packing=new Map(),unsubs=[],sequence=0;
 let boardReady=false,packingReady=false,boardFromCache=false,packingFromCache=false,pending=false,cloudError='';
 const ownRecord=()=>packing.get(uid)||{packed:[]};
 const clean=s=>String(s||'').trim().slice(0,80);
 const allItems=()=>[...defaults,...custom.filter(x=>!defaults.some(y=>y.toLowerCase()===x.toLowerCase()))];
 const online=()=>navigator.onLine!==false;
 function alertStatus(text,isError=false){status.textContent=text;status.classList.toggle('error',isError);$('mt76-retry-sync').hidden=!isError;}
 function displayError(error){
  cloudError=String(error?.message||error||'Could not synchronize group checklist.');
  if(error?.code==='permission-denied'||/insufficient permissions/i.test(cloudError))
   cloudError='Group checklist needs the updated Firestore Rules. Ask the owner to publish V7.6 FIREBASE_RULES.txt.';
  alertStatus(cloudError,true);
 }
 function showPersonal(on){
  for(const id of ['gear-checklist','custom-gear','gear-more']){
   const node=$(id);if(node)node.hidden=!on;
  }
  root.hidden=on;
 }
 function stop(){
  ++sequence;for(const unsub of unsubs.splice(0))try{unsub();}catch(_){/* unsubscribe */}
  ctx=null;rideId='';uid='';myName='';custom=[];packing.clear();boardReady=false;packingReady=false;
  pending=false;cloudError='';showPersonal(true);
  if(typeof renderGear==='function')renderGear();
 }
 function members(){
  const group=typeof state!=='undefined'&&state.split?state.split:{};
  const ledger=Array.isArray(group.members)?group.members.map(clean).filter(Boolean):[];
  const chosen=clean(myName||window.motoTripRiderProfileName?.()||'Me');
  const names=[chosen,...ledger.filter(n=>n.toLowerCase()!==chosen.toLowerCase())];
  return [...new Set(names)].slice(0,100);
 }
 function packingForName(name){
  if(name.toLowerCase()===myName.toLowerCase())return ownRecord();
  for(const [id,rec] of packing.entries())if(id!==uid&&clean(rec.name).toLowerCase()===name.toLowerCase())return rec;
  return {packed:[]};
 }
 function render(){
  if(!ctx||root.hidden)return;
  const names=members(),items=allItems(),mine=new Set(ownRecord().packed||[]);
  table.replaceChildren();
  const thead=create('thead'),head=create('tr');head.append(create('th','', 'Item'));
  for(const [i,name] of names.entries()){
   const th=create('th',i===0?'mt76-me':'',i===0?'Me':name);
   th.title=i===0?'Only you can edit your packing':'Packing status of '+name;
   head.append(th);
  }
  thead.append(head);table.append(thead);
  const tbody=create('tbody');
  for(const item of items){
   const tr=create('tr'),nameCell=create('td'),content=create('div','mt76-item-content');
   const itemName=create('span','',item);content.append(itemName);
   if(!defaults.includes(item)){
    const del=create('button','mt76-delete-item','×');del.type='button';del.title='Remove this group item';
    del.setAttribute('aria-label','Remove group item '+item);
    del.onclick=()=>removeItem(item);
    content.append(del);
   }
   nameCell.append(content);tr.append(nameCell);
   for(const [i,name] of names.entries()){
    const td=create('td',i===0?'mt76-own':'');
    if(i===0){
     const checkbox=create('input','mt76-own-checkbox');checkbox.type='checkbox';checkbox.checked=mine.has(item);
     checkbox.disabled=pending||Boolean(cloudError)||!boardReady||!packingReady;
     checkbox.setAttribute('aria-label',(checkbox.checked?'Unpack ':'Pack ')+item+' for Me');
     checkbox.onchange=()=>toggleOwn(item,checkbox.checked);
     td.append(checkbox);
    }else{
     const packed=new Set(packingForName(name).packed||[]).has(item);
     const indicator=create('span',packed?'mt76-packed':'mt76-not-packed',packed?'✓':'—');
     indicator.setAttribute('aria-label',name+(packed?' packed ':' not packed ')+item);
     td.append(indicator);
    }
    tr.append(td);
   }
   tbody.append(tr);
  }
  table.append(tbody);
  const ownCount=items.filter(it=>mine.has(it)).length;
  $('progress').max=items.length;$('progress').value=ownCount;
  $('count').textContent=ownCount+' / '+items.length+' packed (Me)';
  $('mt76-my-count').textContent='My checklist: '+ownCount+'/'+items.length+' packed';
  $('mt76-reset-own').disabled=pending||Boolean(cloudError)||!packingReady;
  $('mt76-add-gear').querySelector('button').disabled=pending||Boolean(cloudError)||!boardReady;
  if(cloudError){alertStatus(cloudError,true);return;}
  $('mt76-retry-sync').hidden=true;
  if(!boardReady||!packingReady)alertStatus('Loading members and packing checklist…');
  else if(boardFromCache||packingFromCache||!online())alertStatus('Offline or reconnecting. Last saved packing is shown; live sync is pending.');
  else alertStatus('✓ Live sync · Everyone can view. Each rider edits their own column.');
 }
 async function syncRide(){
  const next=window.motoTripSharedRide.safetyContext?.();
  if(!next){stop();return;}
  if(rideId===next.rideId&&uid===next.uid){render();return;}
  stop();ctx=next;rideId=next.rideId;uid=next.uid;
  showPersonal(false);alertStatus('Loading group packing…');
  const seq=sequence,dbM=ctx.dbM;
  try{
   // Confirm this identity is really a member; use the ledger name, not an edited local profile.
   const member=dbM.doc(ctx.db,'sharedRides',rideId,'members',uid);
   const mySnapshot=await dbM.getDocFromServer(member);
   if(seq!==sequence||!ctx)return;
   if(!mySnapshot.exists())throw Error('This account is not a member of the Shared Ride. Rejoin to use group packing.');
   myName=clean(mySnapshot.data().name);
   if(!myName)throw Error('Your rider name is missing from this group.');
   const board=dbM.doc(ctx.db,'sharedRides',rideId,'packingBoard','main');
   const all=dbM.collection(ctx.db,'sharedRides',rideId,'packing');
   unsubs.push(dbM.onSnapshot(board,snap=>{
    if(seq!==sequence)return;
    boardReady=true;boardFromCache=snap.metadata.fromCache;
    custom=Array.isArray(snap.data()?.customItems)?snap.data().customItems.filter(x=>typeof x==='string'&&x.trim()).map(clean).slice(0,100):[];
    render();
   },err=>{if(seq===sequence){displayError(err);render();}}));
   unsubs.push(dbM.onSnapshot(all,snap=>{
    if(seq!==sequence)return;
    packingReady=true;packingFromCache=snap.metadata.fromCache;
    packing=new Map();
    for(const doc of snap.docs){const data=doc.data();if(!data||typeof data.name!=='string'||!Array.isArray(data.packed))continue;
     packing.set(doc.id,{name:clean(data.name),packed:data.packed.filter(x=>typeof x==='string')});}
    render();
   },err=>{if(seq===sequence){displayError(err);render();}}));
  }catch(e){if(seq===sequence){displayError(e);render();}}
 }
 async function writeMine(item,checked){
  const dbM=ctx.dbM;
  const ref=dbM.doc(ctx.db,'sharedRides',rideId,'packing',uid);
  const operation=checked?dbM.arrayUnion(item):dbM.arrayRemove(item);
  await dbM.setDoc(ref,{uid,name:myName,packed:operation,updatedAt:new Date().toISOString()},{merge:true});
 }
 async function toggleOwn(item,checked){
  if(!ctx||pending||!boardReady||!packingReady)return;
  if(!online()){alertStatus('You are offline. Reconnect to update the group.',true);render();return;}
  pending=true;render();
  try{await writeMine(item,checked);}
  catch(e){displayError(e);}
  finally{pending=false;render();}
 }
 async function changeCustom(item,remove){
  if(!ctx||pending||!boardReady)return;
  if(!online()){alertStatus('Connect to the internet to edit the group checklist.',true);return;}
  pending=true;render();
  try{
   const dbM=ctx.dbM,ref=dbM.doc(ctx.db,'sharedRides',rideId,'packingBoard','main');
   await dbM.setDoc(ref,{customItems:remove?dbM.arrayRemove(item):dbM.arrayUnion(item),updatedAt:new Date().toISOString()},{merge:true});
  }catch(e){displayError(e);}
  finally{pending=false;render();}
 }
 async function removeItem(item){
  if(!ctx||pending)return;
  if(!confirm('Remove "'+item+'" from the whole Shared Ride checklist for everyone?'))return;
  await changeCustom(item,true);
 }
 $('mt76-add-gear').addEventListener('submit',async e=>{
  e.preventDefault();if(!ctx||pending)return;
  const input=$('mt76-gear-input'),name=clean(input.value);
  if(!name)return;
  if(allItems().some(it=>it.toLowerCase()===name.toLowerCase())){alertStatus('This item already exists in the group checklist.',true);return;}
  if(custom.length>=100){alertStatus('The group has reached its custom item limit.',true);return;}
  await changeCustom(name,false);
  if(!cloudError)input.value='';
 });
 $('mt76-reset-own').addEventListener('click',async()=>{
  if(!ctx||pending||!packingReady||!confirm('Uncheck every item in YOUR column? Other riders will not be changed.'))return;
  if(!online()){alertStatus('Reconnect to clear your packing status.',true);return;}
  pending=true;render();
  try{
   await ctx.dbM.setDoc(ctx.dbM.doc(ctx.db,'sharedRides',rideId,'packing',uid),
    {uid,name:myName,packed:[],updatedAt:new Date().toISOString()},{merge:true});
  }catch(e){displayError(e);}
  finally{pending=false;render();}
 });
 $('mt76-retry-sync').addEventListener('click',()=>{stop();syncRide();});
 window.motoTripGroupGear={
  async removeMine(){if(!ctx)return;
   await ctx.dbM.deleteDoc(ctx.dbM.doc(ctx.db,'sharedRides',rideId,'packing',uid));},
  refresh:render
 };
 window.addEventListener('mototrip-ride-change',syncRide);
 window.addEventListener('mototrip-group-data',()=>{if(ctx)render();});
 window.addEventListener('online',()=>{if(ctx)render();});
 syncRide();
})();
