import {setTimeout as delay} from 'node:timers/promises';
/** A known disappearing frame can interrupt a read-only UI observation. It is
 * never success, never a mutation retry and never a new timeout allowance. */
export async function waitForNativeCondition(evaluate,expression,{clock=Date.now,delay:pause=delay,onNavigationGap=()=>{}}={}){
 const until=clock()+30000;
 while(clock()<until){
  try{if(await evaluate(expression))return;}
  catch(cause){if(cause.cdpCode!==-32000||cause.cdpMessage!=='Inspected target navigated or closed')throw cause;onNavigationGap();}
  await pause(100);
 }
 throw Error('UI condition not met: '+expression);
}
