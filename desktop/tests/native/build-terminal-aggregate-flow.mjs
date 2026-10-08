// Native operations are permitted only in isolated existing Windows CI.
import assert from 'node:assert/strict';import {writeAggregateFlowPrototype} from './terminal-aggregate-flow-derive.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','ISOLATED_WINDOWS_CI_ONLY');assert.equal(process.env.RUNNER_OS,'Windows','ISOLATED_WINDOWS_CI_ONLY');
await import(await writeAggregateFlowPrototype());
