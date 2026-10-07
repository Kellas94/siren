# Independent held-button transport amendment review — 2026-10-07

Author: /root/hosted_resume_retention. The narrowly bounded harness amendment is justified; no product fix or historical hosted-cause closure is established.

Whole-source comparison confirms aa0b→811 changes exactly two CDP mouseMoved payloads by inserting button:left beside existing buttons1. All original endpoints45/25, event-order/drop assertions, deadlines and sequence remain unchanged. The old harness is retained byte-exact. No source/test/product files were edited by this reviewer.

CDP defines optional button defaultnone separately from the pressed buttons mask. [Official CDP source](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Input.pdl). Playwright's Chromium move supplies both fields, supporting explicit held-button transport. [Primary implementation](https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright-core/src/server/chromium/crInput.ts). These sources do not prove that omission is invalid or always causes cancellation.

I read ROOT's CDP explicit-left32 and PID-checked/focused native-input32 controls: both COMPLETE5 with32 exact endpoint/order/drop receipts. The CDP control's full source is reconstructible from the original with only transport fields, finite repetition, relocation and diagnostic label; assertions are identical. Native control additionally changes focus/transport and integer DIP coordinates, so it is supporting evidence rather than a one-variable comparison. No GUI was executed independently here.

The focus diagnostic remains ADVERSE with lostpointercapture/buttons1 while document.hasFocus=true, activeViewport and no focusEvents. Document blur is not supported by that observation; native OS focus in the failing run remains unrecorded. Legitimate capture-loss cancellation must remain intact.

Accept the transport-only change, preserve adverse originals, and qualify actual amended811 development/copied/hosted execution separately. Passing finite controls do not establish no intermittent product defect or retroactively approve earlier hosted evidence. All16 reviewed inputs remained unchanged; detailed hashes/limits are in the adjacent JSON and evidence/workspace-surface/pan-held-button-independent/.
