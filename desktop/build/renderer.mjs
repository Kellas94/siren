import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { Script } from 'node:vm';

export const BASELINE_SHA256 = '5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function buildRenderer({ baselinePath, expectedSha256 = BASELINE_SHA256, outputDir }) {
  const bytes = await readFile(baselinePath);
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256) || sha256(bytes) !== expectedSha256.toLowerCase()) {
    throw new Error('Frozen baseline SHA-256 mismatch; no renderer emitted');
  }
  let html = bytes.toString('utf8');
  if (expectedSha256.toLowerCase() === BASELINE_SHA256) {
    // Paint the opening plate before document initialisation can expose controls.
    // Returning users and native recovery explicitly retire this initial plate.
    const openingPlate = '<div class="siren-intro-overlay" id="sirenIntroOverlay" hidden aria-hidden="true">';
    const openingChoice = 'const introPlaying = sirenFirstRun ? playSirenIntro() : false;';
    if (html.split(openingPlate).length !== 2 || html.split(openingChoice).length !== 2) throw new Error('Desktop opening plate marker mismatch');
    html = html.replace(openingPlate, openingPlate.replace(' hidden', ''));
    html = html.replace(openingChoice, 'const introPlaying = sirenFirstRun ? playSirenIntro() : (stopSirenIntro(), false);');
    // A floating editor must release the library's exclusive navigation state.
    // Keep the frozen web baseline intact; apply the qualified desktop change here.
    const codeRestore = 'onRestore:()=>{paintCodeWorkspace();queueCodeAnalysis();}';
    if (html.split(codeRestore).length !== 2) throw new Error('Desktop Code window navigation marker mismatch');
    html = html.replace(codeRestore, 'onRestore:()=>{setCodeSectionOpen(false,false);paintCodeWorkspace();queueCodeAnalysis();}');
    const marker = 'const sirenStore = (() => {';
    if (html.split(marker).length !== 2) throw new Error('Desktop storage patch marker mismatch');
    html = html.replace(marker, marker + '\n        if (window.sirenDesktop) return window.createSirenDesktopStore({ workspaceKey: STORAGE_KEY });');
    const managedCache = '      const LEGACY_STORAGE_KEYS = [';
    if (html.split(managedCache).length !== 2) throw new Error('Desktop managed cache boundary mismatch');
    const boundary = html.indexOf(managedCache);
    let managedTail = html.slice(boundary);
    for (const [operation, count] of [['getItem',21],['setItem',11],['removeItem',2]]) {
      const token = `localStorage.${operation}`;
      if (managedTail.split(token).length !== count + 1) throw new Error('Desktop managed cache call count mismatch');
      managedTail = managedTail.replaceAll(token, `desktopCache.${operation}`);
    }
    html = html.slice(0, boundary) + `      const desktopCache = {getItem:key=>sirenStore.get(key),setItem:(key,value)=>sirenStore.set(key,String(value)),removeItem:key=>sirenStore.remove(key)};\n` + managedTail;
    const draftPersist = " function persist(){const payload=JSON.stringify([...drafts.values()].map(d=>({id:d.id,ref:d.ref,name:d.name,language:d.language,base:d.base,text:d.text,generation:d.generation})));let status='memory-only';if(new TextEncoder().encode(payload).length<=budget&&storage.write){try{storage.write(payload);status='stored';}catch{status='failed';}}for(const d of drafts.values())d.recovery=status;return status;}";
    if (html.split(draftPersist).length !== 2) throw new Error('Desktop Code recovery receipt marker mismatch');
    html = html.replace(draftPersist, ` let persistenceSerial=0;
 function persist(){const serial=++persistenceSerial;const payload=JSON.stringify([...drafts.values()].map(d=>({id:d.id,ref:d.ref,name:d.name,language:d.language,base:d.base,text:d.text,generation:d.generation})));let status='memory-only';const settle=value=>{if(serial!==persistenceSerial)return;for(const d of drafts.values())d.recovery=value;storage.onStatus?.(value);};if(new TextEncoder().encode(payload).length<=budget&&storage.write){try{const receipt=storage.write(payload);if(receipt&&typeof receipt.then==='function'){status='pending';Promise.resolve(receipt).then(result=>settle(result?.ok===true?'stored':'failed'),()=>settle('failed'));}else status='stored';}catch{status='failed';}}for(const d of drafts.values())d.recovery=status;return status;}`);
    const draftStorage = "const codeDrafts=createCodeDrafts({read:()=>desktopCache.getItem('siren-code-drafts-v1'),write:value=>desktopCache.setItem('siren-code-drafts-v1',value)});";
    if (html.split(draftStorage).length !== 2) throw new Error('Desktop Code recovery refresh marker mismatch');
    html = html.replace(draftStorage, "const codeDrafts=createCodeDrafts({read:()=>desktopCache.getItem('siren-code-drafts-v1'),write:value=>desktopCache.setItem('siren-code-drafts-v1',value),onStatus:()=>{for(const controller of codeControllers)controller.refresh();}});");
    const recoveryLabel = "d.recovery==='stored'?'Private recovery stored':d.recovery==='failed'";
    if (html.split(recoveryLabel).length !== 2) throw new Error('Desktop Code recovery status marker mismatch');
    html = html.replace(recoveryLabel, "d.recovery==='stored'?'Private recovery stored':d.recovery==='pending'?'Saving private recovery…':d.recovery==='failed'");
    // Debounced callbacks must not turn a completed account flush into a false failure.
    for (const token of ["      function scheduleSave() {", "      function writeDraft() {", "      async function saveState() {"]) {
      if (html.split(token).length !== 2) throw new Error('Desktop paused autosave marker mismatch');
      const start = html.indexOf(token); const stop = html.indexOf('\n      }', start);
      const body = html.slice(start, stop);
      if (body.split('if (readOnlyMode)').length !== 2) throw new Error('Desktop paused autosave guard mismatch');
      html = html.slice(0, start) + body.replace('if (readOnlyMode)', 'if (readOnlyMode || window.sirenDesktopStorageLocked)') + html.slice(stop);
    }
    const readonly = 'let readOnlyMode = false;';
    if (html.split(readonly).length !== 2) throw new Error('Desktop access patch marker mismatch');
    html = html.replace(readonly, 'let readOnlyMode = !!window.sirenDesktopBootstrap?.readonly || !!window.sirenDesktopSafetyReadonly;');
    for (const token of ['readOnlyMode = Boolean(enabled);', 'readOnlyMode = Boolean(shared.ro);']) {
      if (html.split(token).length !== 2) throw new Error('Desktop read-only authority marker mismatch');
      html = html.replace(token, token.replace('Boolean(', '!!window.sirenDesktopBootstrap?.readonly || !!window.sirenDesktopSafetyReadonly || Boolean('));
    }
    const savedStatus = "        } else {\n          el.saveStateChip.dataset.state = 'good';\n          el.saveStateText.textContent = 'Saved locally';";
    if (html.split(savedStatus).length !== 2) throw new Error('Desktop read-only status marker mismatch');
    html = html.replace(savedStatus, "        } else if (readOnlyMode && window.sirenDesktop) {\n          el.saveStateChip.dataset.state = 'warn';\n          el.saveStateText.textContent = 'Read-only · local project';\n          el.saveStateChip.title = 'Local data can be read, recovered and exported. Sign in to activate editing.';\n          el.saveStateChip.classList.remove('is-action');\n          el.saveStateChip.removeAttribute('role');\n          el.saveStateChip.removeAttribute('tabindex');\n          el.saveStateChip.removeAttribute('aria-label');\n        } else {\n          el.saveStateChip.dataset.state = 'good';\n          el.saveStateText.textContent = 'Saved locally';");
    const importHelper = `
        window.sirenDesktopValidateImport = async (text, fileName) => {
          const original = parseMainImportJson(text, fileName);
          let payload = original;
          let bag = null;
          if (original?.kind === 'siren-desktop' && original.schema === 1) {
            bag = original;
            const raw = bag.storage?.[STORAGE_KEY];
            if (typeof raw !== 'string') throw new Error('Backup has no workspace');
            const importedState = parseMainImportJson(raw, fileName);
            payload = {type:PROJECT_TYPE,version:importedState.version || APP_VERSION,state:importedState};
          } else if (!original.state && (Array.isArray(original.diagrams) || original.source)) {
            throw new Error('Import a complete .siren export, rather than an internal workspace cache');
          }
          if (payload.type === 'siren-project') payload = {...payload,type:PROJECT_TYPE};
          const clean = await validatePortableProjectForImport(payload, fileName);
          const workpapers = prepareProjectWorkpapers(clean.state.workpapers, fileName);
          workpapers.forEach(doc => stampWorkpaperFileSignoff(doc, workpaperProjectReviewInput.get(doc)));
          const importedState = {...clean.state,workpapers};
          return JSON.stringify(bag ? {...bag,storage:{...bag.storage,[STORAGE_KEY]:JSON.stringify(importedState)}} : {...clean,state:importedState});
        };
    `;
    const startup = "document.addEventListener('DOMContentLoaded', () => {\n        sirenStore.start()";
    if (html.split(startup).length !== 2) throw new Error('Desktop startup patch marker mismatch');
    html = html.replace(startup, () => "document.addEventListener('DOMContentLoaded', () => {" + importHelper + `
        window.sirenDesktopApplySafety = event => {
          if (event?.readonly !== true) return;
          window.sirenDesktopSafetyReadonly = true;
          applyReadOnlyMode(true, false);
          if (el.readOnlyBanner) el.readOnlyBanner.textContent = event.reason || 'Read-only desktop project · Recovery and export remain available';
          setSaveState('saved');
        };
        window.sirenDesktopRequestClose = async () => {
          clearTimeout(saveTimer); clearTimeout(draftTimer);
          if (window.sirenDesktopBootstrap?.snapshot && window.sirenDesktopBootstrap?.mode === 'normal') {
            const result = await saveState();
            if (!['confirmed','read-only'].includes(result?.status)) throw new Error('Save not acknowledged: ' + (result?.status || 'unknown'));
          }
          const flushed = await window.sirenDesktopFlush();
          if (flushed?.ok === false) throw new Error('Recovery not acknowledged');
        };
        let accountTransitionBodyState = null;
        window.sirenDesktopBeginAccountTransition = async () => {
          if (accountTransitionBodyState !== null) throw new Error('Account transition already pending');
          accountTransitionBodyState = document.body.inert;
          document.body.inert = true;
          document.body.classList.add('desktop-account-transition');
          try {
            await window.sirenDesktopRequestClose();
            window.sirenDesktopStorageLocked = true;
          } catch (error) { window.sirenDesktopEndAccountTransition(); throw error; }
        };
        window.sirenDesktopEndAccountTransition = () => {
          window.sirenDesktopStorageLocked = false;
          if (accountTransitionBodyState !== null) document.body.inert = accountTransitionBodyState;
          accountTransitionBodyState = null;
          document.body.classList.remove('desktop-account-transition');
        };
        if (window.sirenDesktopBootstrap?.mode && window.sirenDesktopBootstrap.mode !== 'normal') return;
        sirenStore.start()`);
    const ready = 'sirenStore.start().catch(() => {}).then(initialize).then(() => {';
    if (html.split(ready).length !== 2) throw new Error('Desktop readiness patch marker mismatch');
    html = html.replace(ready, ready + "\n          if (window.sirenDesktopBootstrap?.readonly) { applyReadOnlyMode(true, false); if (el.readOnlyBanner) el.readOnlyBanner.textContent = 'Read-only desktop project · Recovery and export remain available'; setSaveState('saved'); }\n          window.sirenDesktopReady?.();");
    const palette = 'const known = new Set(commands.map(c => c.title.toLowerCase()));';
    if (html.split(palette).length !== 2) throw new Error('Desktop command registry marker mismatch');
    html = html.replace(palette, () => `if (window.sirenDesktop) {
          [['desktopOpenProject','Open / import local project…'],['desktopExportProject','Export saved backup…'],['desktopLogin','Account…'],['desktopCheckUpdates','Check for Updates'],['desktopRecovery','Disaster Recovery…'],['desktopGuide','Desktop guide…']].forEach(([id,title]) => {
            const row = add(title, 'Desktop', () => window.sirenDesktopCommand?.(id)); row.id = 'desktop:' + id; row.readOnlySafe = true;
          });
        }
        ` + palette);
    const tour = '      const TOUR_STEPS = [';
    if (html.split(tour).length !== 2) throw new Error('Desktop tour marker mismatch');
    html = html.replace(tour, tour + `
        ...(window.sirenDesktop ? [{sel:'#desktopOptions',title:'Local desktop workspace',text:'Desktop holds local project import, saved backups, account status, signed update checks and Disaster Recovery. Recovery opens a new copy and preserves the original. Code drafts stay private until Save to Docs. This development build has no production account service or update installation.'}] : []),`);
    const tourCard = '        tourCard.replaceChildren();';
    if (html.split(tourCard).length !== 2) throw new Error('Desktop tour card marker mismatch');
    html = html.replace(tourCard, tourCard + "\n        tourCard.dataset.desktopStep = String(step.sel === '#desktopOptions');");
    const uiRoot = fileURLToPath(new URL('../src/ui/', import.meta.url));
    const storage = await readFile(join(uiRoot, 'storage.js'), 'utf8');
    const ui = await readFile(join(uiRoot, 'desktop.js'), 'utf8');
    const css = await readFile(join(uiRoot, 'desktop.css'), 'utf8');
    if ([storage, ui].some(s => /<\/script/i.test(s)) || /<\/style/i.test(css)) throw new Error('Unexpected adapter closing tag');
    const appScript = "  <script>\n    (() => {\n      'use strict';\n\n      const APP_VERSION";
    if (html.split(appScript).length !== 2) throw new Error('Desktop script patch marker mismatch');
    html = html.replace(appScript, () => `<script>${storage}\n${ui}</script>\n` + appScript);
    const document = parse(html, { sourceCodeLocationInfo: true });
    const head = document.childNodes.find(n => n.tagName === 'html')?.childNodes.find(n => n.tagName === 'head');
    const end = head?.sourceCodeLocation?.endTag?.startOffset;
    if (!Number.isSafeInteger(end)) throw new Error('Desktop head marker mismatch');
    html = html.slice(0, end) + `<style>${css}</style>\n` + html.slice(end);
  }
  const nodes = [];
  const visit = node => { nodes.push(node); for (const child of node.childNodes || []) visit(child); };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  const scripts = nodes.filter(n => n.tagName === 'script');
  if (!scripts.length || scripts.some(n => n.attrs.some(a => a.name === 'src'))) throw new Error('Unexpected baseline scripts');
  for (const node of scripts) new Script(node.childNodes.map(c => c.value || '').join(''), { filename: 'generated-inline.js' });
  const hashes = [...new Set(scripts.map(n => `'sha256-${createHash('sha256').update(n.childNodes.map(c => c.value || '').join('')).digest('base64')}'`))];
  const csp = `default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self' blob:; font-src data:; worker-src blob:; base-uri 'none'; form-action 'none'; object-src 'none';`;
  const metas = nodes.filter(n => n.tagName === 'meta' && n.attrs.some(a => a.name === 'http-equiv' && a.value.toLowerCase() === 'content-security-policy'));
  if (metas.length !== 1) throw new Error('Unexpected baseline CSP marker');
  const location = metas[0].sourceCodeLocation;
  html = html.slice(0, location.startOffset) + `<meta http-equiv="Content-Security-Policy" content="${csp}" />` + html.slice(location.endOffset);
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'app.html'), html, { encoding: 'utf8' });
  const receipt = { schema: 1, baselineSha256: sha256(bytes), rendererSha256: sha256(Buffer.from(html)), scriptCount: scripts.length, electron: '44.5.1' };
  await writeFile(join(outputDir, 'build.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const baselinePath = process.argv[2];
  if (!baselinePath) throw new Error('Usage: node build/renderer.mjs <frozen-baseline.html> [output-directory]');
  console.log(JSON.stringify(await buildRenderer({ baselinePath, outputDir: process.argv[3] || resolve('generated') })));
}
