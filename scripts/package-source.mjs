import { readFile,writeFile,readdir,mkdir,copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { join,relative } from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=fileURLToPath(new URL('../../../../outputs/',import.meta.url));
const destination=join(output,'cabal-funding-imd-source-20261018');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const solidity=JSON.parse(await readFile(join(root,'reports/solidity-tests.json'),'utf8'));
const tests=Object.values(solidity).flatMap(s=>Object.entries(s.test_results).map(([name,t])=>({name,status:t.status,fuzzRuns:t.kind?.Fuzz?.runs??0})));
assert.ok(tests.length>=19 && tests.every(t=>t.status==='Success'));
const tap=(await readFile(join(root,'reports/worker-tests.tap'),'utf8')).replace(/^\uFEFF/,'');
const testCount=Number(tap.match(/# tests (\d+)/)?.[1]);assert.ok(testCount>=25 && /# fail 0\b/.test(tap));
const e2e=JSON.parse(await readFile(join(root,'reports/local-e2e.json'),'utf8'));assert.equal(e2e.status,'passed');
const factoryReview=JSON.parse(await readFile(join(root,'reports/factory-fork-review.json'),'utf8'));
assert.equal(factoryReview.status,'passed');assert.equal(factoryReview.cases.length,2);assert.equal(factoryReview.publicTransactions,0);
const routerReview=JSON.parse(await readFile(join(root,'reports/production-router-review.json'),'utf8'));
assert.equal(routerReview.status,'passed');assert.equal(routerReview.cases.length,2);assert.equal(routerReview.publicTransactions,0);
assert.ok(routerReview.cases.every(c=>c.tradingReview.quotes.length===4&&c.tradingReview.quotes.every(q=>q.quoteMatchesExecution)));
const config=JSON.parse(await readFile(join(root,'config.example.json'),'utf8'));
assert.equal(config.mode,'disabled');assert.equal(config.liveExecutionApproved,false);assert.equal(config.contract,null);assert.equal(config.treasury,null);
const entries=[];
async function walk(path) {for(const item of await readdir(path,{withFileTypes:true})) {const full=join(path,item.name);if(item.isDirectory()) await walk(full);else if(item.isFile()) entries.push(full);else throw Error('Unexpected link in release input');}}
for(const folder of ['src','worker','test','lib','scripts']) await walk(join(root,folder));
for(const name of ['README.md','foundry.toml','package.json','package-lock.json','config.example.json','vendor-integrity.json','.gitignore']) entries.push(join(root,name));
for(const name of ['contract-review.txt','factory-fork-review.json','production-router-review.json','production-router-review.txt','local-e2e.json','worker-tests.tap']) entries.push(join(root,'reports',name));
const manifest=[];
// Operator-specific deny terms are supplied at packaging time and never stored in the source bundle.
const denyTerms=JSON.parse(process.env.CABAL_PRIVACY_DENY_TERMS??'[]');
for(const source of entries) {
  const bytes=await readFile(source);const text=bytes.toString('utf8');
  const words=new Set(text.toLowerCase().split(/[^a-z0-9]+/));
  assert.ok(!/[a-z]:[\\/]Users[\\/]/i.test(text) && !denyTerms.some(term=>term.length<=4?words.has(term.toLowerCase()):text.toLowerCase().includes(term.toLowerCase())),'Privacy check: '+relative(root,source));
  manifest.push({path:relative(root,source).replaceAll('\\','/'),sha256:hash(bytes),bytes:bytes.length});
}
const report={createdAt:new Date().toISOString(),status:'reviewed_production_router_fork_passed_live_disabled',contractTests:tests.length,randomizedCases:tests.reduce((n,t)=>n+t.fuzzRuns,0),workerTests:testCount,endToEnd:e2e,factoryReview,routerReview,review:{independent:false,mediumFindingsFixed:2,additionalReproducibleHighOrCriticalFindings:0},sourceFiles:manifest.length,privacyFindings:0,publicChainTransactions:0,realFundsSpent:'0',activation:{enabled:false,coinLaunched:false,gameConnected:false,remaining:['production worker address and spending/reserve/gas limits','reviewed public source repository and commit','independent audit/IMD review panel and off-chain manifest acceptance','production signer/coordinator and verified result integration with durable storage','final deployed-pool revalidation and separate authorization for deployment and any paid smoke test']},toolLimitations:['Windows Foundry Solar preprocessing emits import diagnostics; solc compilation and EVM execution pass. No static-analysis clearance claimed.','Production router/quoter contract paths are tested on a local fork; the actual browser-wallet flow has not been exercised.'],tests};
await mkdir(join(root,'reports'),{recursive:true});await writeFile(join(root,'reports/validation.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(join(output,'cabal-funding-validation.json'),JSON.stringify(report,null,2)+'\n');
await mkdir(destination,{recursive:false});
for(const source of entries) {const target=join(destination,relative(root,source));await mkdir(join(target,'..'),{recursive:true});await copyFile(source,target);}
await mkdir(join(destination,'reports'),{recursive:true});
await copyFile(join(root,'reports/validation.json'),join(destination,'reports/validation.json'));
await writeFile(join(destination,'source-integrity.json'),JSON.stringify({files:manifest},null,2)+'\n');
const overview=`CABAL AUTOMATIC FUNDING - LOCAL VALIDATION

Status: Reviewed locally; factory and production router fork tests passed; live execution disabled.
No coin launch or real spending. See cabal-funding-contract-review.txt for findings.

Implemented:
- 4% buy / 4% sell IMD-side Uniswap v4 fee, separate from platform fees.
- Fixed 50,000 CABAL read-only eligibility view; token transfers stay unrestricted.
- 70% request reserve / 30% fixed project treasury, with cumulative dust accounting.
- Prefunding, automatic claim redemption and treasury payout, restricted oracle payment.
- Durable worker with duplicate prevention, saved signed transactions, restart recovery,
  receipt verification, spending/gas limits, and persistent reorg/ambiguity halt.
- Server-only BO5 funding reservation and decision queue interface.

Verified: ${tests.length} contract tests; ${report.randomizedCases} randomized cases; ${testCount} worker tests.
Two medium worker availability/reservation findings fixed and covered by regressions.
Deployed Robinhood factory tested on a local fork in both token orderings, including
CREATE2 deployment, pool initialization, all four swap modes, platform fee collection
and payments through the deployed Intake code. See reports/factory-fork-review.json.
Production UniversalRouter, V4Quoter and Permit2 were then tested in both orderings:
eight quote/execution comparisons passed, alongside slippage, deadline, approval,
stale-price and liquidity-limit tests. See reports/production-router-review.txt.
The 50,000 CABAL token view is included in the latest router revalidation.
No production hook or payment-worker behavior changed for the holding requirement.

Full local simulation:
1,000 IMD buy input -> 40 IMD custom tax -> 28 IMD request reserve + 12 IMD treasury.
Eight simulated oracle requests consume 4 IMD -> 24 IMD remains in the request fund.
A deliberately lost RPC reply and worker restart caused no duplicate payment.
This used a real Uniswap PoolManager locally, mock IMD/CABAL tokens and a mock intake.

Before launch: pin the reviewed public source repository/commit; provide a worker
address and operating limits; complete independent review and IMD manifest acceptance;
wire the disabled modules into the coordinator and verified result consumer; separately
authorize deployment and recheck the final live pool. Owner, treasury and remainder
roles are recorded separately in the operator launch draft, not in this source package.
The current game continues its existing behavior. No revised branded request was sent to IMD.

See the source bundle's README.md for operation, fee bases, full-fill behavior and limits.
`;
await writeFile(join(output,'cabal-funding-validation.txt'),overview);
console.log(JSON.stringify({sourceFiles:manifest.length,contractTests:tests.length,randomizedCases:report.randomizedCases,workerTests:testCount,privacyFindings:0,liveExecution:false}));
