# Terminal QA request publication

These helpers coordinate an owned test actor and its host. They do not implement the Terminal product or grant execution authority.

The actor writes and closes the request body, verifies its bytes, writes and closes a completion manifest binding scope/actor/phase/path/length/hash, and creates an exclusive empty `.published` file last. The empty file is the sole visibility commit. Readers do not open either JSON body before that commit; committed corruption, missing content, identity mismatch or drift is fatal.

There are three UI request names and four native barrier names. Existing caller deadlines, phase ordering, held process identity, genuine ACK validation and native postconditions remain the caller's responsibility. A late publisher failure may already have committed: preserve the result and never automatically republish.

The Node test runs 18 real-file protocol checks through the actual producer and both Node/Python readers, including paused empty/partial writes, absent completion, exact publication, duplicate refusal and corrupted committed content. It uses synthetic requests and bounded Python file-reader subprocesses. It does not import an application, launch Electron, run a shell or qualify SDK input, native barriers, eight sessions, Stop or Quit.

Python must be available as `python`, or explicitly selected with `SIREN_QA_PYTHON`. Run the test with Node's test runner against `desktop/tests/terminal-request-publication.test.mjs`. The existing Windows verification job supplies fixed Python and discovers this test through its existing file glob.

No crash durability, multi-file filesystem atomicity, arbitrary concurrent filesystem safety or malicious-writer isolation is claimed. Originals and test-owned failure fixtures remain preserved. This source-only review does not qualify a packaged, installed or released application.

For a deliberately selected short canonical test-fixture parent, set SIREN_REQUEST_PUBLICATION_TEMP_ROOT. This selects test-owned files only and does not alter operating-system policy or skip cases.
