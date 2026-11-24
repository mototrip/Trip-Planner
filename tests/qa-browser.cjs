'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  for (const {width,height,label} of [
   {width:390,height:844,label:'Android narrow'},
   {width:1440,height:900,label:'Desktop'}
  ]) {
   const context=await browser.newContext({
    viewport:{width,height},acceptDownloads:true,serviceWorkers:'block'
   });
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   // Keep QA independent of production Firebase accounts and services.
   await page.route('**/firebase-config.js*',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:'window.MOTOTRIP_FIREBASE_CONFIG={};'
   }));
   await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>!document.documentElement.classList.contains('mt923-booting'),null,{timeout:20000});
   assert.equal(await page.locator('#mt923-boot-cover').isVisible(),false,'Boot overlay still visible');
   assert.equal(await page.locator('#mt-account-overlay').isVisible(),true,'Account onboarding is absent');
   await page.locator('#mt-welcome-guest').click();
   await page.locator('#mt-profile-panel').waitFor({state:'visible',timeout:10000});
   await page.locator('#mt-profile-name').fill('QA Test Rider');
   await page.locator('#mt-profile-save').click();
   await page.waitForFunction(()=>!document.documentElement.classList.contains('mt-entry-locked'),null,{timeout:10000});
   assert.equal(await page.locator('#mt-account-overlay').isVisible(),false,'Profile gate stayed locked');

   for (const tab of ['split','trips','plan']) {
    await page.locator('nav button[data-tab="'+tab+'"]').click();
    assert.equal(await page.locator('#'+tab).isVisible(),true,'Tab not visible: '+tab);
   }

   // Use the user's real Planner save action; do not create fake records.
   // The canonical planner form contains a hidden legacy trip-name field.
   // Modern quick inputs are used below; set the legacy name through the same
   // input/change events the user-facing route name adapter triggers.
   await page.evaluate(() => {
     const name = document.querySelector('#planner [name="name"]');
     name.value = 'QA Mountain Ride';
     name.dispatchEvent(new Event('input', { bubbles: true }));
     name.dispatchEvent(new Event('change', { bubbles: true }));
   });
   await page.locator('#planner [name="days"]').fill('2');
   await page.locator('#mt80-distance').fill('480');
   await page.locator('#mt80-mileage').fill('30');
   await page.locator('#mt80-price').fill('100');
   await page.locator('#planner-save-trip').click();
   const stored=await page.evaluate(()=>{
    const scope=localStorage.getItem('mototrip-account-scope')||'guest';
    const ls=Object.keys(localStorage).filter(k=>k.startsWith('mototrip-v1'));
    const s=ls.map(k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}})
      .find(x=>x&&Array.isArray(x.trips));
    return {trip:s?.trips?.[0]?.data?.name,tripCount:s?.trips?.length,scope};
   });
   assert.equal(stored.trip,'QA Mountain Ride','Planner did not persist saved trip');
   assert.ok(stored.tripCount>=1);

   // Exercise real Bill Split user actions and verify settlement + undo.
   await page.locator('nav button[data-tab="split"]').click();
   for (const rider of ['Rider A','Rider B']) {
     await page.locator('#member-name').fill(rider);
     await page.locator('#member-form button.primary').click();
   }
   await page.locator('#payer').selectOption('Rider A');
   await page.locator('#expense-name').fill('Fuel');
   await page.locator('#expense-amount').fill('301.01');
   await page.locator('#expense-form button.primary').click();
   const expense = await page.evaluate(() => {
     const g=group(),result=calculateSplit(g);
     return {members:g.members.length,expenses:g.expenses.length,
       cents:g.expenses[0]?.amount,total:result.total,
       paid:result.rows.find(r=>r.name==='Rider A')?.paid,
       share:result.rows.reduce((a,r)=>a+r.share,0),
       outstanding:result.payments.reduce((a,p)=>a+p.n,0)};
   });
   assert.deepEqual(expense,{members:2,expenses:1,cents:30101,
     total:30101,paid:30101,share:30101,outstanding:15050});
   page.once('dialog',d=>d.accept());
   await page.locator('#settlements button').first().click();
   assert.equal(await page.evaluate(()=>calculateSplit(group()).payments.length),0,
     'Marked payment did not settle the balance');
   // Payment history is intentionally collapsed on mobile and desktop.
   await page.locator('#payment-list').evaluate(el=>{el.closest('details').open=true;});
   page.once('dialog',d=>d.accept());
   await page.locator('#payment-list .payment-history-toggle').first().click();
   assert.equal(await page.evaluate(()=>calculateSplit(group()).payments.length),1,
     'Undo payment did not restore the settlement');
   console.log('PASS',label,'rider creation, exact expense split, settlement and undo');

   // Bill Split precise paise: conservation, smallest-remainder fairness,
   // settlement/undo handling across randomized groups.
   const math=await page.evaluate(()=>{
     const sample={name:'QA',members:['A','B','C'],expenses:[
       {name:'Fuel',payer:'A',amount:10001,people:['A','B','C']},
       {name:'Stay',payer:'B',amount:4500,people:['B','C']}
     ],transfers:[]};
     const x=calculateSplit(sample);
     const conserved=x.rows.reduce((a,r)=>a+r.net,0)===0;
     const fair=x.rows.reduce((a,r)=>a+r.share,0)===14501;
     const pay=x.payments.reduce((a,p)=>a+p.n,0);
     const owed=x.rows.reduce((a,r)=>a+(r.net<0?-r.net:0),0);
     let total=100,ok=true;
     for(let n=1;n<=total;n++){
       const members=Array.from({length:(n%6)+2},(_,i)=>'R'+i);
       const expenses=Array.from({length:(n%11)+1},(_,i)=>{
         const group=members.filter((_,j)=>(j+i+n)%3!==0);
         return {name:'Expense',payer:members[(i+n)%members.length],amount:(i+1)*103+n,
           people:group.length?group:[members[0]]};
       });
       const v=calculateSplit({members,expenses,transfers:[]});
       const sum=v.rows.reduce((a,r)=>a+r.net,0);
       if(sum!==0||v.rows.reduce((a,r)=>a+r.share,0)!==v.total)ok=false;
     }
     return {conserved,fair,pay,owed,randomized:ok};
   });
   assert.equal(math.conserved,true);assert.equal(math.fair,true);
   assert.equal(math.pay,math.owed);assert.equal(math.randomized,true);
   console.log('PASS',label,'startup, Guest, Planner save, tabs, split math');

   if(label==='Android narrow'){
    // Backup controls live in Trips, not inside the Bill Split tab.
    await page.locator('nav button[data-tab="trips"]').click();
    assert.equal(await page.locator('#export').isVisible(),true,
      'Backup export action is not visible on Trips');
    // Verify JSON backup can be downloaded and restored without data loss.
    const downloadPromise=page.waitForEvent('download',{timeout:15000});
    await page.locator('#export').click();
    const download=await downloadPromise;
    const {readFile,unlink}=require('node:fs/promises');
    const output=await download.path();
    const json=JSON.parse(await readFile(output,'utf8'));
    assert.equal(json.trips[0].data.name,'QA Mountain Ride');
    await page.evaluate(()=>{const el=document.querySelector('#planner [name="name"]');el.value='Other Draft';el.dispatchEvent(new Event('input',{bubbles:true}));});
    page.once('dialog',d=>d.accept());
    await page.locator('#import').setInputFiles({
     name:'qa-backup.json',mimeType:'application/json',
     buffer:Buffer.from(JSON.stringify(json))
    });
    await page.waitForFunction(()=>document.querySelector('#planner [name="name"]').value==='QA Mountain Ride',null,{timeout:10000});
    console.log('PASS',label,'JSON export and confirmed restore');
   }

   // Reproduce the screenshot: Photon unavailable must NOT leave a floating
   // message over the city input. Run with a deliberate HTTP 503 response.
   await page.route('https://photon.komoot.io/**',route=>route.fulfill({
     status:503,contentType:'application/json',body:'{"error":"QA simulated outage"}'
   }));
   await page.evaluate(()=>tab('route'));
   const city=page.locator('#route-start-input');
   await city.fill('QA Search Failure City');
   await page.locator('.place-suggestion-message')
     .filter({hasText:'Search unavailable'}).waitFor({timeout:10000});
   await page.waitForFunction(()=>!document.querySelector('.place-suggestions'),
     null,{timeout:7000});
   assert.equal(await city.getAttribute('aria-expanded'),'false');
   // And clicking another input must dismiss the error immediately.
   await city.fill('QA Search Failure City Again');
   await page.locator('.place-suggestion-message')
     .filter({hasText:'Search unavailable'}).waitFor({timeout:10000});
   await page.locator('#route-trip-name').click();
   assert.equal(await page.locator('.place-suggestions').count(),0);
   await page.evaluate(()=>tab('plan'));
   console.log('PASS',label,'transient location search notice and outside-click dismissal');

   const major=errors.filter(e=>!/network|resource/i.test(e));
   assert.deepEqual(major,[],'Browser uncaught JS errors: '+major.join(' | '));
   await context.close();
  }
  // Real service-worker offline reload: app shell must load without network.
  const offlineContext=await browser.newContext({
    viewport:{width:390,height:844},serviceWorkers:'allow'
  });
  const offlinePage=await offlineContext.newPage();
  const offlineErrors=[];
  offlinePage.on('pageerror',e=>offlineErrors.push(e.message));
  await offlinePage.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
  await offlinePage.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await offlinePage.reload({waitUntil:'domcontentloaded'});
  await offlinePage.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),
    null,{timeout:15000});
  await offlineContext.setOffline(true);
  await offlinePage.reload({waitUntil:'domcontentloaded'});
  await offlinePage.waitForFunction(
    ()=>!document.documentElement.classList.contains('mt923-booting'),
    null,{timeout:15000});
  assert.equal(await offlinePage.locator('#mt923-boot-cover').isVisible(),false);
  assert.equal(offlineErrors.length,0,'Offline JavaScript error: '+offlineErrors.join(' | '));
  await offlineContext.close();
  console.log('PASS offline service worker reload and full app shell');
  console.log('BROWSER_QA_OK');
 } finally {await browser.close();}
})().catch(e=>{console.error('BROWSER_QA_FAILED',e.stack||e);process.exit(1)});