# CI27 fixture and reporting correction

Author: /root. Scope: test fixture and workflow operation, not product path-policy relaxation or a completed hosted CI result.

CI27's unit step failed and its renderer/native/package stages were skipped. Its required 180-second OIDC test had already passed; the later six-minute outer interruption occurred during update-service tests. The independently authored `2026-10-03-ci27-independent-diagnosis.md` retains the remote logs/archive, exact checked-out merge identity and limits of attribution.

The tracked source-client repository test now uses the existing canonical temporary-directory fixture helper. Production `ownedDirectory` remains unchanged. The reviewer reproduced the original `Project path refused` under an actual owned Windows 8.3 TEMP path, then independently ran the corrected tracked test under that same setup: 1/1 passed, exit 0, 250.5969 ms. Root separately ran all 22 source-client tests: 22/22 passed, exit 0, 331.9082 ms (`evidence/ci27-canonical-client-root-green.log`). The remote failed assertion had no retained stack, so this is controlled support for the fixture explanation, not absolute retrospective proof of its exact exception.

The workflow unit step uses a bounded 12-minute outer allowance and TAP logging. The job remains bounded at 25 minutes. Existing individual test, OIDC and update/download deadlines are unchanged; direct `node --test` uses the same test glob as `npm run verify`. This improves headroom and failure-stack retention without altering acceptance criteria. No CI rerun, main merge or release is implied.

The corrected local frozen suite completed: **388/388 passed**, zero failures/skips/cancellations, exit 0, all captured source/build/test/package/baseline inputs unchanged. Evidence is `evidence/ci27-source-loading-final-suite-{start,result}.json` and `.log`; log SHA-256 `93168bfb4b65dd139fd351a8fbdac6ffea96272bc49ab904163b91e6a63d29b7`. Prior frozen 388-test evidence belongs to the pre-correction fixture and remains preserved. This local result does not change CI27's hosted failure.
