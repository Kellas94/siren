# Browser Matrix

## Exercise Results (Firefox & WebKit)

Modern Firefox (v153) and WebKit (v26.5 / Safari 18) were tested over both http://localhost and ile:// protocols.

| Exercise | Firefox | WebKit | Notes |
|---|---|---|---|
| **Boot (ile:// & http://)** | Works | Works | Both protocols load seamlessly. No CORS or module blocking issues on ile://. |
| **Render diagrams** | Works | Works | Flowchart, Sequence, Gantt, Mindmap, and Pie all render correctly. |
| **Edit canvas** | Works | Works | Adding blocks, dragging the canvas, and renaming elements function smoothly. |
| **Trigger a toast** | Works | Works | Toasts appear natively in the Top Layer using showPopover(). |
| **Trigger a refusal** | Works | Works | Attempting to delete a critical path triggers the refusal guard and toast. |
| **Storage & Reload** | Works | Works | IndexedDB persistence succeeds. Changing a name and reloading restores state perfectly. |
| **Exports** | Works | Works | PDF, PNG, SVG, PowerPoint, Word, Excel, Markdown, JSON, and .siren all export valid files. |
| **Imports** | Works | Works | Importing a Chromium-exported .siren file succeeds with all workpapers intact. |
| **Docs inserter (/)** | Works | Works | The block slash-inserter menu appears and filters correctly. |
| **Present mode** | Works | Works | Presentation mode dims the background and BroadcastChannel communicates with the audience window. |

---

## Suspect API Analysis

The codebase was analyzed to determine the fallback strategy for each suspect API, answering what happens when the application is opened in older browsers (e.g., Safari < 17, Firefox < 125) where these features are missing.

| Feature | Result | Evidence | What a person would see in an older browser |
|---|---|---|---|
| showSaveFilePicker | Guarded | if (typeof window.showSaveFilePicker !== 'function') with <a download> fallback | A toast says "This browser cannot save directly to disk" and a standard file download begins. |
| popover= / showPopover | Mixed | 	ypeof showPopover === 'function' prevents crash, but HTML relies on Top Layer | Toasts appear via CSS opacity, but render *behind* any open <dialog> backdrop, obscuring warnings. |
| clipboard.writeText | Guarded | if (navigator.clipboard && typeof ... === 'function') with 	ry/catch | A toast says "Clipboard blocked by the browser". For templates, it gracefully prints the text to the console. |
| OffscreenCanvas | Guarded | Used internally by Cytoscape webgl texture generator | Diagram renders normally; the rendering engine safely falls back to a standard in-memory <canvas> element. |
| createImageBitmap | Guarded | 	ypeof createImageBitmap === 'function' falling back to 
ew Image() | Slightly slower image loading during updates or exports, but everything functions perfectly. |
| BroadcastChannel | Mixed | 	ry { new BroadcastChannel(...) } prevents crash, but breaks sync | Two open tabs silently clobber each other's saves in IndexedDB. |
| :has() (CSS) | Bare | .map-tile:has(...), .diagram-tab:has(...) | Presentation minimap overlaps prompts; map tiles lack focus rings; tab text clips under the close button. |
| structuredClone | Guarded | structuredCloneSafe wrapper falls back to JSON.parse(JSON.stringify()) | No difference; the application's state is plain JSON so the polyfill is functionally identical. |
| <dialog> / showModal | Guarded | if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); | Dialogs open inline without a blurred backdrop and fail to trap keyboard focus. |
| inert | Bare | egion.inert = true; without polyfill | During a presentation, users can Tab out of the overlay and accidentally trigger background app toolbars. |
| SVG Favicon | Bare | <link rel="icon" type="image/svg+xml"> without .ico fallback | The browser tab displays a default blank page or globe icon instead of the SIREN logo. |

---

## Silent Failures
*These are critical because they degrade the user experience without notifying the user or throwing a visible error.*

1. **\BroadcastChannel\ (Data Loss)**: If \BroadcastChannel\ is unsupported (e.g. Safari < 15.4), the \sirenStore\ gracefully catches the instantiation error but silently drops its cross-tab synchronisation. Because the save function (\idbPutWithBackup\) blindly overwrites the entire IndexedDB store, a user with two tabs open will silently clobber their own work. Tab B saves its state; Tab A remains unaware; Tab A later saves its state, permanently overwriting Tab B's data without any warning.
2. **\popover=\ (Hidden Warnings)**: While \showPopover()\ is strictly guarded against throwing an exception, the \<div class="toast">\ element relies on native HTML popover support to join the browser's Top Layer. In older browsers, the toast remains in the standard DOM z-index flow. If a toast is triggered while a \<dialog>\ is open (e.g., an import refusal or file overwrite warning), the \<dialog>\'s top-layer backdrop completely obscures the toast. The user is protected by the refusal but silently blinded to the reason why their action failed.
3. **\:has()\ (Visual Collision)**: The presentation mode relies on \:has(#presentDecisionPrompt:not([hidden]))\ to hide the minimap when a decision prompt appears. Without \:has()\ support, the minimap remains visible, creating a confusing visual overlap on the audience's screen.

---

## Honest Degradations
*These gracefully fall back to older standard patterns, warning the user if necessary, without breaking core functionality.*

- **\<dialog>\ and \showModal()\**: Perfectly guarded. If \showModal\ is missing, the app safely falls back to \setAttribute('open', '')\. The dialog appears without a backdrop and doesn't trap focus, but remains fully usable.
- **\structuredClone\**: Handled via the custom \structuredCloneSafe()\ which catches the absence and falls back to \JSON.parse(JSON.stringify(value))\. Since SIREN's state tree is exclusively plain data, this fallback is functionally flawless.
- **\clipboard.writeText\**: Wrapped in \	ry...catch\. If it fails or is denied by browser permissions, the app politely toasts "Clipboard blocked by the browser". For large template copies, it even logs the fallback text to the developer console.
- **\createImageBitmap\**: Safely guarded with a \	ypeof\ check. Falls back to a standard \
ew Image()\ with an \onload\ resolution, gracefully trading a fraction of performance for perfect reliability.
- **\OffscreenCanvas\**: Managed seamlessly by the underlying graph rendering engines. If unavailable, it degrades to using a standard in-memory \<canvas>\ for texture buffering.
- **\inert\**: If unsupported, \egion.inert = true\ simply fails to isolate keyboard focus during presentations. The user can accidentally Tab into the background, but no core functionality breaks.
- **SVG Favicon**: No \.ico\ fallback means older browsers just show a blank default icon.
- **\showSaveFilePicker\**: Catches the missing API and gracefully falls back to generating a Blob URL and triggering a classic \<a download>\ click, while explicitly notifying the user of the limitation via a toast.
