# Independent native admission-fixture addendum — 7 October 2026

Author: /root/terminal_foundation_review. **Exact one-line amendment confirmed; all prior assertions preserved. No actual native completion inferred.** The earlier fixture report remains untouched.

Fixture: tests/native/workspace-appearance.mjs. Previous SHA-256 359360527b48af58426e914606759223795cccd20975734d21935a4b8bcf0b93; amended/current SHA-256 80267cd607b4a3b3f30ecb0627cd2b387f512629adfe79b819dcc4c17a46801b.

I removed only the following LF-terminated line in memory and required the complete reconstructed file SHA-256 to equal the previously reviewed35936052 identity. It matched exactly, proving no other byte delta in this fixture:

    await waitForWorkspaceAdmission(driver);await driver.waitFor('document.getElementById("sirenAppNavigation")?.hidden===false&&!document.body.inert&&!document.getElementById("sirenAppTheme").disabled');

The line follows the originalPublic/beforeTheme snapshot and precedes the genuine Home theme click. It reuses the existing imported workspace-admission helper and the exact navigation visibility/non-inert/enabled predicate already used earlier. It introduces no deadline argument, retry, alternative click or changed success expectation; the existing genuine click hit-test remains in place.

All **28 native fixture assert calls** remain byte-identical, including all23 original base assertions and the five prior additive appearance assertions. Both direct assertion-line equality and the complete-file hash reconstruction establish preservation. The seven pure fixture hashes and all fourteen identities from the prior appearance report still match; the JSON records them individually.

I compiled **51** complete native evaluate/waitFor expressions and checked the new predicate with mocked Node truth cases. Visible/non-inert/enabled succeeds; hidden navigation, inert body, disabled theme and absent navigation refuse. These are syntax and local-predicate checks, not actual DOM or native validation.

Prior Markdown hash 3f2cee1369ab1a9b18c01c2f5fad537ccf75e6568e3b06be9387f4dd529f3f57 and JSON hash ebc090deb1904fe76fa6d86d2502ff83346b04369d7b073a3927481a04028da5 remained unchanged. The native helper hash 897408a2e194127b6e3cce4d4a487bdcd231178ce61d69e0443bc3a6ee02a5ca, amended fixture hash and all tracked inputs matched at the beginning and end of this audit.

ROOT reported launching amended native rerun97674. This reviewer did not execute GUI/Electron, inspect that run's outcome or infer successful qualification. The earlier adverse evidence remains preserved; current native completion needs its own exact-byte execution evidence. No full-suite, package or release approval is granted here.
