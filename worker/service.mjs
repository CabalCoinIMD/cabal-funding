import { FundingEngine } from './engine.mjs';

/** Run in a single, durable coordinator process. The caller supplies its wallet adapter explicitly.
 * This library has no listener, no browser route, and no implicit startup or secret discovery.
 * Status is returned to an operator callback; public messages must not include internal records.
 */
export async function runFundingService({store,adapter,config,signal,onStatus=()=>{},intervalMs=5000}) {
  const engine=new FundingEngine({store,adapter,mode:config.mode??'disabled',minGasWei:config.minimumGasBalanceWei??0,maintenanceMin:config.maintenanceMinAtomic??1});
  if(engine.mode==='disabled') {const result=await engine.runOnce();onStatus(result);return;}
  if(intervalMs<1000) throw Error('Funding poll interval must be at least one second');
  while(!signal?.aborted) {
    onStatus(await engine.runOnce());
    if(signal?.aborted) break;
    await new Promise(resolve=>{const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',finish);resolve();};const timer=setTimeout(finish,intervalMs);signal?.addEventListener('abort',finish,{once:true});});
  }
}
