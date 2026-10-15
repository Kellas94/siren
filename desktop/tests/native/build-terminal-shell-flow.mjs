// Isolated Windows CI only. No local compilation or native execution.
import assert from 'node:assert/strict';import {writeShellFlowBuilderPrototype} from './terminal-shell-flow-derive.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','ISOLATED_WINDOWS_CI_ONLY');assert.equal(process.env.RUNNER_OS,'Windows','ISOLATED_WINDOWS_CI_ONLY');
await import(await writeShellFlowBuilderPrototype());
