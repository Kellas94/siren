# Hosted development CI32 — retrieved by root, 3 October 2026

Author: root implementer, not independent release approval. Retrieved the actual workflow runs, jobs and decoded logs through the authenticated private GitHub connector.

Remote commit `c90c432b54b684be895b9bab9b5e229b27bb1db6` corresponds to local `6b7720cb4cce75e152ef241ab7768d345ebe3a6a`. Desktop CI32 run `37114116201`, job `111177470136`: completed SUCCESS. Native identity 2/2 and other units 495/495, guarded renderer, all configured development native groups, and development package identity/probe steps succeeded. Access-screen reports completed true at 09:55:41 UTC; packaged probe reports completed true at 09:58:26 UTC. Launcher CI23 run `37114116168` also completed SUCCESS.

CI31 remote `90e366182a2c483e730b387d2dea15c28a4f55a9`, run `37113577432`, job `111175971659`: completed FAILURE. Its 497 units and guarded renderer passed, native access-screen timed out at Runtime.evaluate at 09:46:01 UTC, development package step SKIPPED. Launcher CI22 succeeded. CI30/31 failures remain historical failures. CI32 has the bounded diagnostic-only access-screen instrumentation; no product/oracle/deadline change. A passing subsequent observation does not establish the cause or resolution of the prior intermittent timeout.

CI32 predates the new Code-view flush implementation. It does not qualify those new inputs, production source/editor mounting, Home, all-view Lock/Quit, native Diagram/Presenter/Audience, physical monitors or a public release.

Canonical hosted evidence: https://github.com/Kellas94/siren/actions/runs/37114116201 and https://github.com/Kellas94/siren/actions/runs/37113577432. No rerun was requested and no independent report was fabricated.
