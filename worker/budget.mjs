import { decisionKey } from './store.mjs';

/** Server-only API. Call at duel admission and when authoritative round evidence is frozen.
 * Do not expose these methods or raw question construction as unauthenticated browser endpoints.
 */
export class DuelFundingBudget {
  constructor({store,adapter,config}) {this.store=store;this.adapter=adapter;this.config=config;}
  async admit(matchId) {
    if(this.config.mode==='disabled') throw Error('Live swarm funding is disabled');
    // Serialize the balance snapshot/reservation with payment reconciliation. Otherwise a
    // payment could consume funds after this read while its released reservation admits a duel.
    if(!this.store.acquire()) throw Error('Funding coordinator busy; retry admission');
    try {
    await this.adapter.assertReady();
    const [balances,terms]=await Promise.all([this.adapter.balances(),this.adapter.terms()]);
    const price=BigInt(this.config.requestPriceAtomic);
    if(BigInt(terms.amount)!==price || this.store.blocked()) throw Error('Funding unavailable');
    if(this.config.minimumGasBalanceWei==null || this.config.minimumImdReserveAtomic==null) throw Error('Funding reserves must be configured');
    if(BigInt(balances.gas)<BigInt(this.config.minimumGasBalanceWei)) throw Error('Gas reserve too low');
    // BO5 has at most four intermissions, two player decisions per intermission.
    this.store.assertLease();
    this.store.reserveMatch(matchId,price*8n,balances.requestBalance,BigInt(this.config.minimumImdReserveAtomic));
    } finally {this.store.release();}
  }
  queueDecision({matchId,round,seat,input}) {
    if(this.config.mode==='disabled' || this.store.blocked()) throw Error('Swarm funding disabled');
    if(input?.v!==1 || input.chainId!==this.config.chainId || input.answerType!=='uint256' || input.evidence!=='panel'
      || input.panelSize!==5 || input.quorum!==4 || input.toleranceBps!==0 || input.guards?.min!=='0' || input.guards?.max!=='3'
      || typeof input.question!=='string' || input.question.length<20 || input.question.length>8000) throw Error('Invalid frozen decision input');
    // Serialize explicit public fields only: private server policy and account metadata are never copied wholesale.
    const body=JSON.stringify({v:1,chainId:this.config.chainId,question:input.question,window:{hours:24},answerType:'uint256',evidence:'panel',panelSize:5,quorum:4,toleranceBps:0,validForSeconds:300,guards:{min:'0',max:'3'}});
    return this.store.enqueue({id:decisionKey(this.config.chainId,this.config.contract,matchId,round,seat),match:matchId,amount:this.config.requestPriceAtomic,body});
  }
  finish(matchId) {this.store.closeMatch(matchId);}
}
