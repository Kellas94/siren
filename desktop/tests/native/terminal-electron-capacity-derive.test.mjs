import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {deriveEightCreatorSource} from './terminal-electron-capacity-derive.mjs';
const source=readFileSync(new URL('../fixtures/terminal-electron-broker.cs',import.meta.url),'utf8');
test('reuse actual tested launcher byte-exact except entry rename and held snapshot bound',()=>{assert.equal(deriveEightCreatorSource(source),source.replace('static int Main(string[] args) {','static int TwoCreatorMain(string[] args) {').replace('count>=12&&count<=32','count>=12&&count<=128'));});
test('unknown launcher bytes refuse derivation',()=>assert.throws(()=>deriveEightCreatorSource(source+'\n')));
