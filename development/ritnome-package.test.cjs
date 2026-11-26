'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {buildRitnomePackage}=require('./ritnome-package.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ritnome-package-'));
try{
 const a=path.join(root,'a'),b=path.join(root,'b');
 const ma=buildRitnomePackage(a),mb=buildRitnomePackage(b);
 assert.deepEqual(ma,mb);assert.equal(ma.version,'0.1.0-dev');assert.equal(ma.status,'development_only');
 assert.deepEqual(Object.keys(ma.files).sort(),['authenticated-ritnome.js','index.html','ritnome-audio.js','ritnome-clock.js','ritnome-warmup.js']);
 for(const [name,digest] of Object.entries(ma.files)){const bytes=fs.readFileSync(path.join(a,name));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),digest);assert.deepEqual(bytes,fs.readFileSync(path.join(b,name)))}
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(a,'manifest.json'),'utf8')),ma);
 const html=fs.readFileSync(path.join(a,'index.html'),'utf8');
 const scripts=[...html.matchAll(/<script src="\.\/([^"]+)">/g)].map(m=>m[1]);
 assert.equal(scripts.length,4);assert.ok(scripts.every(n=>n.endsWith('.js')&&Object.hasOwn(ma.files,n)));assert.ok(!html.includes('.cjs'));
 assert.throws(()=>buildRitnomePackage(a),{code:'EEXIST'});
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(a,'manifest.json'),'utf8')),ma);
 console.log('PASS: deterministic versioned Ritnome package, SHA-256 integrity, valid browser assets and overwrite protection');
}finally{fs.rmSync(root,{recursive:true,force:true})}
