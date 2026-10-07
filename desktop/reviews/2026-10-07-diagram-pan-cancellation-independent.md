# Independent read-only pan cancellation diagnosis — 2026-10-07

Author: /root/hosted_resume_retention. The owner diagnostic 10-18-31 reproduces ADVERSE through the actual cancelPan handler: down stores drag id1 at5679.8ms, cancelPan→stop at5702.3ms clears it with pan0/0, and subsequent move at5704.8ms sees drag=null. paused/disposed are false. These retained stacks and states explain that instrumented diagnostic's ignored move/up; I executed no GUI.

The event kind remains unproven: the identical cancelPan handler receives pointercancel and lostpointercapture, and this diagnostic does not record event.type. It does not establish why Chromium cancelled or whether an older event with reused pointerId1 affected the new gesture. Do not call a specific capture-loss or historical hosted cause proven yet.

Static source rules out broad node-ignore as a general explanation: nodes/edges are accepted; only anchors, non-left and annotation controls are excluded. Fit resets pan, onPreview preserves current coordinates, ResizeObserver only updates walkthrough geometry. No Fit/preview logpoint occurs between the failing diagnostic down/cancel, and no pause/disposal is recorded. Original copied ADVERSE10-15-02 remains intact; later expanded COMPLETE10-16-30 is comparison evidence only.

Transport is genuine sequential CDP. Document down/move/up with correct coordinates does not demonstrate viewport handler delivery/capture state. The instrumented copy adds bounded false-returning debugger logpoints and repeated gestures; it can affect timing and is not unchanged original acceptance evidence.

Next evidence should record exact cancel event.type, pointerId/timeStamp/buttons,target and capture state beside down sequence/time, retaining45/25 oracle and adverse originals. Historical hosted pan remains open. All10 reviewed inputs are byte-identical before/after; detailed retained records and SHA256 values are in the adjacent JSON and evidence/workspace-surface/pan-cancellation-independent-static/.
