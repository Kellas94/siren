// PREPARED SOURCE CONTRACT ONLY. No native loads, fixtures, faults or probes run.
// This variant supplements the original ten host cases; it is not an adapter.
export const CLASSIFICATION='OWNER_WIP_PREPARED_NOT_EXECUTED_NOT_ADMITTED';
export const EXECUTION_PREREQUISITES=Object.freeze([
 'Separately reviewed isolated adapter, contained fixtures and external watchdog.',
 'Exact v2 source/runtime/binary hashes plus exact genuine legacy binary/source hashes.',
 'Independent native held-handle Safety observations BEFORE any Safety cleanup.',
 'Audited actual API-result fault instrumentation; armed booleans alone are insufficient.',
 'Actual native context/handle identity observations from before the fault and after rejection; counters alone are insufficient.',
]);
const fault=(id,api,stage)=>Object.freeze({id,api,stage,expected:'reject',requires:'AUDITED_ACTUAL_NATIVE_API_FAILURE',observations:Object.freeze([
 'Fault executed exactly once with non-success API result and unchanged raw handle/work/hook identity on the failure branch.',
 'Original native pair context, stable membership and counted slot retained; nativeReaped/final join false.',
 'Actual subsequent admission exhausts the same finite slot budget; no replacement, retry, deletion or refund after unknown release.',
 'Safety observations collected before cleanup; cleanup cannot repair a failed candidate observation.',
])});
export const RELEASE_FAILURE_CASES=Object.freeze([
 fault('close_handle_during_peer_drain','CloseHandle','actual retired pair pipe/process/Job release'),
 fault('close_handle_during_peer_finalization','CloseHandle','actual joined peer thread/event/wake release'),
 fault('delete_async_work_during_peer_finalization','napi_delete_async_work','actual completed peer finalization work release before capacity/join'),
 Object.freeze({id:'remove_empty_environment_cleanup_hook',api:'napi_remove_async_cleanup_hook',stage:'actual environment cleanup with active0',expected:'unknown retained',requires:'AUDITED_ACTUAL_NATIVE_API_FAILURE',observations:Object.freeze([
  'Exact environment/context/hook identity remains owned in the same occupied environment slot after actual failure.',
  'Cleanup callback context is not deleted; no retry or new environment for the failed identity.',
  'Create/close environment cycles exhaust the fixed nine environment slots when removal remains unknown.',
  'No assertion of an actual second callback or use-after-free; retain exact failure and native context evidence.',
 ])}),
]);
export const LEGACY_CAPABILITY_CASES=Object.freeze([
 ['Owner','stopAndCloseHostAsync'],['Session','snapshotSession'],
 ['Pair','closePeerListeners'],['Endpoint','peerSnapshot'],['Witness','closePeerWitness'],
].map(([family,entry])=>Object.freeze({id:'legacy_'+family.toLowerCase()+'_crossing',family,entry,expected:'synchronous native refusal before unwrap/layout',requires:'GENUINE_LEGACY_AND_V2_ADDONS_COLOADED_IN_ISOLATED_TARGET',observations:Object.freeze([
 'Capability is obtained from the actual legacy addon and pre-contained legacy fixture, never a fabricated JS object or copied type tag.',
 'Call the actual v2 entry with that genuine legacy capability and otherwise valid scalar arguments.',
 'Audited entry trace confirms the distinct type-tag check refuses before unwrap or any native layout field read.',
 'Independent Safety observations precede separate cleanup of both actual addon fixtures.',
])})));
export const LIMITATIONS=Object.freeze([
 'No adapter, native fault instrumentation or legacy-contained fixture is implemented here.',
 'The nine supplementary cases and the original ten cases remain NOT_EXECUTED.',
 'The existing candidate has five opaque capability tags. Launch/bootstrap is a validated packet, not a sixth wrapped native capability shape.',
 'Full production JavaScript Session/allocation cleanup join remains UNIMPLEMENTED.',
 'Source comparisons of genuine legacy tags do not demonstrate runtime crossing, refusal, a crash or product reachability.',
]);
