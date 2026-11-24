/* MotoTrip V9.29: encrypt optional sensitive Rider Profile fields at rest.
 * The AES-GCM device key is non-extractable and held in browser IndexedDB;
 * only ciphertext is stored in localStorage. This protects against accidental
 * plain localStorage disclosures, NOT a compromised device or same-origin XSS.
 * If secure storage is unavailable, keep legacy data unchanged and report failure.
 */
(()=>{
 'use strict';
 const PROFILE_PREFIX='mototrip-rider-profile-v1-';
 const SECURE_SUFFIX='-private-v2';
 const FIELDS=['iceName','icePhone','blood','gender'];
 let deviceKeyPromise;
 const bytesTo64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
 const base64ToBytes=s=>Uint8Array.from(atob(s),ch=>ch.charCodeAt(0));
 function openDatabase(){
  return new Promise((resolve,reject)=>{
   if(!window.indexedDB || !window.crypto?.subtle || !window.isSecureContext){reject(Error('Encrypted storage requires HTTPS and a compatible browser.'));return;}
   let request;
   try{request=indexedDB.open('mototrip-private-vault',1);}catch(e){reject(e);return;}
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('keys'))request.result.createObjectStore('keys');};
   request.onerror=()=>reject(request.error||Error('Unable to open encrypted device storage.'));
   request.onsuccess=()=>resolve(request.result);
  });
 }
 async function deviceKey(){
  if(deviceKeyPromise)return deviceKeyPromise;
  deviceKeyPromise=(async()=>{
   const db=await openDatabase();
   try{
    let key=await new Promise((resolve,reject)=>{
     const tx=db.transaction('keys','readonly');const req=tx.objectStore('keys').get('v1');
     req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    if(!key){
     // WebCrypto key material never enters localStorage and cannot be exported.
     const generated=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
     key=await new Promise((resolve,reject)=>{
      const tx=db.transaction('keys','readwrite');const store=tx.objectStore('keys');
      const get=store.get('v1');
      get.onsuccess=()=>{
       if(get.result){key=get.result;return;}
       store.put(generated,'v1');key=generated;
      };
      tx.oncomplete=()=>resolve(key);tx.onerror=()=>reject(tx.error);
     });
    }
    return key;
   }finally{db.close();}
  })().catch(e=>{deviceKeyPromise=null;throw e;});
  return deviceKeyPromise;
 }
 const profileKey=scope=>PROFILE_PREFIX+scope;
 const secretKey=scope=>profileKey(scope)+SECURE_SUFFIX;
 const hasPrivate=o=>FIELDS.some(k=>typeof o?.[k]==='string' && o[k].length);
 function safePublic(obj){
  return {name:typeof obj?.name==='string'?obj.name.slice(0,80):'',vehicle:typeof obj?.vehicle==='string'?obj.vehicle.slice(0,32):''};
 }
 function privatePart(obj){const p={};for(const k of FIELDS)p[k]=typeof obj?.[k]==='string'?obj[k]:'';return p;}
 async function encrypt(obj){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const payload=new TextEncoder().encode(JSON.stringify(privatePart(obj)));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await deviceKey(),payload);
  return JSON.stringify({version:2,iv:bytesTo64(iv),data:bytesTo64(new Uint8Array(encrypted))});
 }
 async function decrypt(raw){
  const p=JSON.parse(raw);
  if(p.version!==2 || typeof p.iv!=='string'||typeof p.data!=='string')throw Error('Unknown secure profile format.');
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(p.iv)},await deviceKey(),base64ToBytes(p.data));
  return privatePart(JSON.parse(new TextDecoder().decode(plain)));
 }
 async function load(scope){
  const raw=localStorage.getItem(profileKey(scope));
  const obj=raw?JSON.parse(raw):{};
  // Automatically migrate older plaintext emergency information without losing it.
  // Commit ciphertext first; only then remove the readable copy.
  if(hasPrivate(obj)){
   const stored=await encrypt(obj);
   localStorage.setItem(secretKey(scope),stored);
   localStorage.setItem(profileKey(scope),JSON.stringify(safePublic(obj)));
   return privatePart(obj);
  }
  const stored=localStorage.getItem(secretKey(scope));
  return stored?await decrypt(stored):privatePart({});
 }
 async function save(scope,obj){
  // A name-only Guest profile needs no cryptographic facilities to be saved.
  // Never persist optional medical/emergency data in plaintext as a fallback.
  if(!hasPrivate(obj)){
   localStorage.setItem(profileKey(scope),JSON.stringify(safePublic(obj)));
   localStorage.removeItem(secretKey(scope));
   return privatePart({});
  }
  // Write the encrypted part first, so no sensitive data is persisted unencrypted.
  const secured=await encrypt(obj);
  localStorage.setItem(secretKey(scope),secured);
  localStorage.setItem(profileKey(scope),JSON.stringify(safePublic(obj)));
  return privatePart(obj);
 }
 function remove(scope){localStorage.removeItem(secretKey(scope));localStorage.removeItem(profileKey(scope));}
 function copy(fromScope,toScope){
  const blob=localStorage.getItem(secretKey(fromScope));
  if(blob && !localStorage.getItem(secretKey(toScope)))localStorage.setItem(secretKey(toScope),blob);
 }
 window.MotoTripProfileVault=Object.freeze({load,save,remove,copy});
})();
