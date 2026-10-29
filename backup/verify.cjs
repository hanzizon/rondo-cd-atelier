// Verify immutable Sites source and all referenced covers/media without network access.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'sites-v19-manifest.json')));
for(const entry of manifest.files){
 const bytes=fs.readFileSync(path.join(root,'snapshots/sites-v19',entry.path));
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 if(hash!==entry.sha256||bytes.length!==entry.bytes)throw Error('Snapshot mismatch: '+entry.path);
}
for(const folder of ['dist','snapshots/sites-v19/dist']){
 const dir=path.join(root,folder),covers=JSON.parse(fs.readFileSync(path.join(dir,'covers.json')));
 for(const cover of covers)if(!fs.existsSync(path.resolve(dir,cover.data)))throw Error('Missing cover: '+cover.data);
 const music=fs.readFileSync(path.join(dir,'music.js'),'utf8');
 const tracks=[...new Set([...music.matchAll(/'([^']+\.(?:mp4|m4a))'/g)].map(m=>m[1]))];
 for(const file of tracks)if(!fs.existsSync(path.join(dir,'audio',file)))throw Error('Missing media: '+file);
 for(const name of fs.readdirSync(dir).filter(n=>/\.(js|html)$/.test(n))){
  const content=fs.readFileSync(path.join(dir,name),'utf8');
  for(const m of content.matchAll(/(?:from\s*|src=)["'](\.\/[^"']+)["']/g)){
   if(!fs.existsSync(path.resolve(dir,m[1])))throw Error('Missing dependency: '+name+' -> '+m[1]);
  }
 }
 console.log(folder+': '+covers.length+' albums; '+tracks.length+' referenced media; dependencies present');
}
console.log('Verified '+manifest.files.length+' Sites source files byte for byte (SHA-256).');
