import { mkdir,readdir,readFile,writeFile,copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join,relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const entries=[];
async function copyTree(source,target) {
  await mkdir(target,{recursive:true});
  for(const item of await readdir(source,{withFileTypes:true})) {
    if(item.isSymbolicLink()) throw Error('Unexpected dependency symlink');
    if(item.isDirectory()) {if(!['.git','node_modules','out','cache','build'].includes(item.name)) await copyTree(join(source,item.name),join(target,item.name));}
    else if(item.name.endsWith('.sol') || /^(LICENSE.*|COPYING.*|package\.json)$/i.test(item.name)) {
      const destination=join(target,item.name);await copyFile(join(source,item.name),destination);
      entries.push({path:relative(root,destination).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(destination)).digest('hex')});
    }
  }
}
const core=join(root,'node_modules/@uniswap/v4-core');
await copyTree(join(core,'src'),join(root,'lib/v4-core/src'));
await mkdir(join(root,'lib/v4-core/test/utils'),{recursive:true});
await copyFile(join(core,'test/utils/CurrencySettler.sol'),join(root,'lib/v4-core/test/utils/CurrencySettler.sol'));
await copyTree(join(core,'lib/solmate/src/auth'),join(root,'lib/solmate/src/auth'));
await copyTree(join(root,'node_modules/@openzeppelin/contracts'),join(root,'lib/openzeppelin-contracts'));
for(const [source,target] of [[core,join(root,'lib/v4-core')],[join(core,'lib/solmate'),join(root,'lib/solmate')]]) {
  for(const item of await readdir(source,{withFileTypes:true})) if(item.isFile() && /^(LICENSE.*|COPYING.*|package\.json)$/i.test(item.name)) await copyFile(join(source,item.name),join(target,item.name));
}
// Hash every delivered vendor file, including copied licences and the test settlement helper.
entries.length=0;
async function hashTree(path) {for(const item of await readdir(path,{withFileTypes:true})) {const full=join(path,item.name);if(item.isDirectory()) await hashTree(full);else entries.push({path:relative(root,full).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(full)).digest('hex')});}}
await hashTree(join(root,'lib'));entries.sort((a,b)=>a.path.localeCompare(b.path));
await writeFile(join(root,'vendor-integrity.json'),JSON.stringify({dependencies:{'@uniswap/v4-core':'1.0.2','@openzeppelin/contracts':'5.4.0',solmate:'bundled with @uniswap/v4-core 1.0.2'},files:entries},null,2)+'\n');
console.log(JSON.stringify({vendoredFiles:entries.length,networkRequests:0}));
