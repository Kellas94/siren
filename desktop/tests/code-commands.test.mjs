import test from 'node:test';
import assert from 'node:assert/strict';
import {createCodeCommands} from '../src/ui/code/commands.js';
test('finite shared commands preserve read-only, paused, saving and fenced mutation guards',()=>{
 let state={ready:true},disposed=false;const calls=[];
 const commands=createCodeCommands({stateFor:()=>state,isDisposed:()=>disposed,handlers:Object.fromEntries(['undo','redo','find','wrap','save','select-all'].map(name=>[name,()=>calls.push(name)]))});
 for(const key of ['readonly','paused','saving','fenced']){state={ready:true,[key]:true};for(const name of ['undo','redo','save'])assert.equal(commands.run(name),false);}
 state={ready:true,readonly:true};assert.equal(commands.run('find'),true);assert.equal(commands.run('select-all'),true);
 state={ready:false};assert.equal(commands.run('wrap'),false);state={ready:true};assert.equal(commands.run('arbitrary-script'),false);assert.equal(commands.run('undo'),true);
 disposed=true;for(const name of ['undo','find','save','select-all'])assert.equal(commands.run(name),false);assert.deepEqual(calls,['find','select-all','undo']);
});
