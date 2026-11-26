'use strict';
// Canonical distributable, built locally from reviewed development sources.
// No dependency, network access, deployment or athlete data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const VERSION='0.1.0-dev';
const assets=Object.freeze({
 'ritnome-warmup-preview.html':'index.html',
 'ritnome-audio.cjs':'ritnome-audio.js',
 'ritnome-clock.cjs':'ritnome-clock.js',
 'authenticated-ritnome.cjs':'authenticated-ritnome.js',
 'ritnome-warmup-preview.cjs':'ritnome-warmup.js'
});
function buildRitnomePackage(output){
 if(typeof output!=='string'||!output)throw Error('Output directory required');
 const destination=path.resolve(output);
 // Never overwrite a previous bundle or any existing source/deployment directory.
 fs.mkdirSync(destination,{recursive:false});
 const files={};
 for(const [source,name] of Object.entries(assets)){
  let data=fs.readFileSync(path.join(__dirname,source),'utf8');
  if(name==='index.html'){
   for(const [old,newName] of Object.entries(assets))data=data.replaceAll('./'+old,'./'+newName);
   data=data.replace('Ritnome · Development preview','Ritnome · '+VERSION);
  }
  fs.writeFileSync(path.join(destination,name),data,{flag:'wx'});
  files[name]=crypto.createHash('sha256').update(data).digest('hex');
 }
 const manifest={name:'ritnome',version:VERSION,status:'development_only',entry:'index.html',personalMode:'explicit_authorized_host_only',files};
 fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return manifest;
}
if(require.main===module){if(process.argv.length!==3)throw Error('Usage: node development/ritnome-package.cjs NEW_OUTPUT_DIRECTORY');console.log(JSON.stringify(buildRitnomePackage(process.argv[2]),null,2))}
module.exports={buildRitnomePackage};
