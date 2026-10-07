import test from 'node:test';
import assert from 'node:assert/strict';
const implementation=await import('./native/condition.mjs').catch(cause=>{if(cause.code!=='ERR_MODULE_NOT_FOUND')throw cause;return {};});
const wait=(...args)=>{assert.equal(typeof implementation.waitForNativeCondition,'function');return implementation.waitForNativeCondition(...args);};
test('a native frame navigation gap does not certify a condition or extend its deadline; genuine later observation is required',async()=>{
 let time=0,calls=0,gaps=0;await wait(async()=>{if(++calls===1)throw Object.assign(Error('Native navigation'),{cdpCode:-32000,cdpMessage:'Inspected target navigated or closed'});return calls===3;},'actual condition',{clock:()=>time,delay:async ms=>{time+=ms;},onNavigationGap:()=>gaps++});assert.equal(calls,3);assert.equal(gaps,1);
 calls=0;time=0;await assert.rejects(wait(async()=>{calls++;throw Object.assign(Error('Native navigation'),{cdpCode:-32000,cdpMessage:'Inspected target navigated or closed'});},'never true',{clock:()=>time,delay:async ms=>{time+=ms;}}),/UI condition not met/);assert.equal(time,30000);assert.equal(calls,300);
});
test('script exceptions, unknown native failures and CDP timeouts stay failures without retries',async()=>{
 for(const cause of [Error('Script assertion failed'),Error('CDP timeout: Runtime.evaluate'),Object.assign(Error('Other native error'),{cdpCode:-32000,cdpMessage:'Unknown error'}),Error('Inspected target navigated or closed')]){let calls=0;await assert.rejects(wait(async()=>{calls++;throw cause;},'actual condition',{delay:()=>assert.fail('Failure may not be retried')}),error=>error===cause);assert.equal(calls,1);}
});
