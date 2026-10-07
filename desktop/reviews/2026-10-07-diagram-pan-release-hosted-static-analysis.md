# Hosted partial-pan failure — read-only static analysis

Author: /root/hosted_resume_retention. Status: CAUSE UNRESOLVED. This is a static comparison of original hosted receipts, one retained failure PNG, and exact candidate source snapshots; no new GUI or test execution.

Run37591120593 fails the second endpoint phase in both development and copied package. First phase down/up without move reaches45/25; second down→move20/10→up45/25 records all correct document events but remains0/0. Both original inputs are unchanged. The five inspected source snapshots were read from local source commit4fd4d481d7ba646bf88473e0b6d18b211606dbde and each Git blob SHA1 equals canonical tree77d85bb5d8ecf7ea8d14c38a38ac04a471acb5ac. Controller96d93 and harnessaa0b exact filesystem SHA256 also equal the original hosted input fields. No moving working-tree equality is assumed.

A Mermaid node hit does not explain rejection by itself: controller diagram.js113 rejects only non-left button, ancestor a, annotation panel or controls; it does not reject data-native-node-id. The final screenshot shows the observed centre near the connector between nodes, controls bottom right. This is a post-failure image, not pointerdown hit-test evidence.

Controller114–115 sets final pan directly from the captured drag origin and matching release coordinates. If viewport down was accepted, matching up occurs without cancellation, paused/disposed stay false, and no later Fit runs, final pan must be45/25. The retained document-capture down/move/up ring does not prove those premises. It omits target ancestry, viewport handler delivery, cancellation/capture events, timestamps, buttons and controller state.

The proposed generic resize/reset explanation is unsupported: ResizeObserver126 calls only walkthrough.updateGeometry, which changes overlay geometry/visibility without changing pan; onPreview78 applies existing pan rather than resetting it. Fit44 explicitly zeroes pan and is wired to Fit111 and walkthrough overview10. Original harness clicks Fit before each phase; there is no retained evidence of an unexpected later Fit.

One remaining code-level possibility is same-id lostpointercapture or pointercancel after the new down: cancelPan115 clears drag for matching id, including a possibly late event from an earlier gesture. This would prevent movePan from changing zero pan. No cancel/got/lost event is recorded, so this remains a hypothesis, not a reproduced or identified cause. Rejected/non-viewport down, lifecycle cancellation, and a later Fit also remain distinguishable only with better event ordering evidence.

Recommended future diagnostic: bounded passive document+viewport down/move/up/cancel/got/lostcapture/click ring, primitive event timestamp/target/currentTarget/buttons/id/capture fields, and if necessary a reviewed temporary accepted-drag/cancel-reason ring. Keep layout reads and extra transport round trips out of the gesture. Retain failures before assertions, cleanup and instrumentation scope. Preserve original endpoint/order/coordinate oracles and all previous adverse receipts. No diagnostic was executed here.

JSON SHA256:170b39d07db4189778e2d1f31848343cbf2da6c561b55679eaa6561677f0d19e.
