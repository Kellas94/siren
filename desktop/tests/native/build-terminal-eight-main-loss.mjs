import assert from 'node:assert/strict';
import {writeEightMainLossPrototype} from './terminal-eight-main-loss-derive.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','ISOLATED_WINDOWS_CI_ONLY');
assert.equal(process.env.RUNNER_OS,'Windows','ISOLATED_WINDOWS_CI_ONLY');
await import(await writeEightMainLossPrototype('builder'));
