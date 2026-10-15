// CI-only fixed builder; no product dependency or installed replacement.
import assert from 'node:assert/strict';
import {writeComposedMainLossPrototype} from './terminal-composed-main-loss-derive.mjs';
assert.ok(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Windows','CI_ONLY_NATIVE_PROTOTYPE');
await import(await writeComposedMainLossPrototype('builder'));
