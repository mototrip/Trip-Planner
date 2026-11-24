'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const file = p => fs.readFileSync(path.join(root,p),'utf8');
const exists = p => fs.existsSync(path.join(root,p));
function pass(name) { console.log('PASS:',name); }
const js = fs.readdirSync(root).filter(p=>p.endsWith('.js'));
for (const f of js) {
 const r=cp.spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8'});
 assert.equal(r.status,0,f+': '+r.stderr);
}
pass('All '+js.length+' top-level JavaScript source files parse');
const pages=['index.html','report.html','privacy.html','terms.html','ownership.html'];
const bad=[];
for(const page of pages) {
 const source=file(page);
 for (const m of source.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)="([^"]+)"/g)) {
  const ref=m[1].split(/[?#]/)[0];
  if (!ref || /^(?:data:|blob:|https?:|\/\/|#|mailto:|tel:)/i.test(ref)) continue;
  if(!exists(ref)) bad.push(page+' -> '+ref);
 }
 const ids=[...source.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 const duplicated=[...new Set(ids.filter((v,i)=>ids.indexOf(v)!==i))];
 if(duplicated.length) bad.push(page+' has duplicate DOM id: '+duplicated.join(', '));
}
assert.deepEqual(bad,[],'Missing local resources or duplicate HTML IDs');
pass('Local HTML assets and unique DOM IDs');
const manifest=JSON.parse(file('manifest.json'));
assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons) assert.ok(exists(icon.src),'Missing icon '+icon.src);
assert.ok(exists('sw.js')&&exists('index.html'));
pass('PWA manifest and icons');
const sw=file('sw.js');
const shell=sw.match(/const APP_SHELL = \[([\s\S]*?)\];/);
assert.ok(shell,'Service worker app shell missing');
const missing=[...shell[1].matchAll(/'(\.\/[^']+)'/g)].map(x=>x[1].replace(/^\.\//,'').split('?')[0]).filter(x=>!exists(x));
assert.deepEqual(missing,[],'Service worker pre-cache contains unavailable local assets');
pass('All service worker core cache URLs exist');
const activity=file('android-app/app/src/main/java/com/mototrip/app/MainActivity.java');
assert.ok(!/setJavaScriptEnabled\s*\(/.test(activity));
assert.ok(!/new\s+WebView\s*\(/.test(activity));
const appGradle=file('android-app/app/build.gradle');
assert.ok(appGradle.includes("applicationId 'com.mototrip.app.twa'"));
assert.ok(/compileSdk\s+36\b/.test(appGradle), 'Compile SDK must support API 36');
assert.ok(/targetSdk\s+36\b/.test(appGradle), 'Google Play target SDK must be API 36');
const dal=file('docs/twa-assetlinks.example.json');
assert.ok(dal.includes('REPLACE_WITH_REAL_RELEASE_APP_SIGNING_CERT_SHA256'));
pass('TWA side-by-side package, no embedded WebView, DAL setup marked incomplete');
console.log('STATIC_QA_OK');