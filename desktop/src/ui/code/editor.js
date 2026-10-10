import { Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { search, searchKeymap, openSearchPanel } from '@codemirror/search';
import { LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, languageDataProp, indentUnit, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { pythonLanguage, python } from '@codemirror/lang-python';
import { tags } from '@lezer/highlight';
import { createEditorAdapter } from './editor-adapter.js';
import { createCodeViewLifecycle } from './view-lifecycle.js';
import { readonlySelectionGuard } from './selection-guard.js';
import { createCodeCommands } from './commands.js';
import { preserveMultilineInput } from './multiline-input.js';
import { sourceUndo, sourceRedo, sourceHistoryKeymap, sourceHistoryInput } from './source-newlines.js';

function pythonSupport(parser) {
  if (!parser || typeof parser.configure !== 'function') throw new TypeError('PATCHED_PYTHON_REQUIRED');
  const byName = new Map(pythonLanguage.parser.nodeSet.types.map(type => [type.name, type]));
  const configured = parser.configure({ props: [
    indentNodeProp.add(type => byName.get(type.name)?.prop(indentNodeProp)),
    foldNodeProp.add(type => byName.get(type.name)?.prop(foldNodeProp)),
    languageDataProp.add(type => type.isTop ? pythonLanguage.data : undefined)
  ] });
  return new LanguageSupport(new LRLanguage(pythonLanguage.data, configured, 'python'), python().support);
}
function appearance(dark) {
  return [EditorView.theme({
    '&': { height: '100%', backgroundColor: `var(--siren-input,${dark ? '#181c24' : '#fbfcff'})`, color: `var(--siren-ink,${dark ? '#d9e0ed' : '#182335'})` },
    '.cm-scroller': { overflow: 'auto', fontFamily: 'Consolas, monospace', fontSize: '14px' },
    '.cm-content': { caretColor: dark ? '#ffffff' : '#172c49' },
    '.cm-gutters': { backgroundColor: `var(--siren-alt,${dark ? '#232936' : '#edf1f8'})`, color: `var(--siren-muted,${dark ? '#a7b4ca' : '#51637f'})`, border: 'none' },
    '.cm-line': { padding: '0 12px' }, '.cm-search': { padding: '8px' }
  }, { dark }), syntaxHighlighting(HighlightStyle.define([
    { tag: tags.keyword, color: dark ? '#b6a2ff' : '#7039a6' },
    { tag: [tags.string, tags.special(tags.string)], color: dark ? '#a8d5a1' : '#25683f' },
    { tag: tags.comment, color: dark ? '#8f9daf' : '#506179' },
    { tag: [tags.number, tags.bool], color: dark ? '#e8bd79' : '#986022' },
    { tag: [tags.typeName, tags.className, tags.function(tags.variableName)], color: dark ? '#7baaf7' : '#1d5dba' }
  ]))];
}

/** Source-backed view for isolated qualification before native workspace admission.
 * Receipts refer to source blobs/drafts; Save here never claims a linked Docs commit.
 */
export function createCodeEditor({ container, client, theme = 'light', readonly = false, pythonParser, language:syntaxLanguage='python', committedOperationId } = {}) {
  if (!container?.ownerDocument || typeof container.replaceChildren !== 'function') throw new TypeError('EDITOR_CONTAINER_REQUIRED');
  if (!['light', 'dark'].includes(theme)) throw new TypeError('INVALID_THEME');
  if(!['python','text','unknown'].includes(syntaxLanguage))throw new TypeError('INVALID_LANGUAGE');
  const document = container.ownerDocument, colors = new Compartment(), wrap = new Compartment(), editable = new Compartment();
  let view = null, disposed = false, wrapping = false, enabled = !readonly;
  const root = document.createElement('section'), toolbar = document.createElement('div'), surface = document.createElement('div'), status = document.createElement('div');
  root.className = 'siren-code-editor'; root.dataset.theme = theme;root.dataset.language=syntaxLanguage;
  Object.assign(root.style, { height: '100%', minHeight: '0', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', borderRadius: '12px', overflow: 'hidden', border: '1px solid #78859a55' });
  Object.assign(toolbar.style, { display: 'flex', gap: '8px', alignItems: 'center', padding: '10px', flexWrap: 'wrap' });
  Object.assign(surface.style, { height: '100%', minHeight: '0', overflow: 'hidden' });
  Object.assign(status.style, { padding: '8px 12px', font: '12px system-ui' }); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', 'Code commands');
  const buttons = new Map(),handlers=Object.create(null),menuItems=new Map();
  function button(name, label, action) {
    const item = document.createElement('button'); item.type = 'button'; item.textContent = label; item.dataset.command = name;
    Object.assign(item.style, { font: '13px system-ui', border: '1px solid #78859a55', borderRadius: '7px', padding: '6px 10px', cursor: 'pointer', color: 'inherit', background: 'transparent' });
    handlers[name]=action;item.addEventListener('click', () => { if(view)commands.run(name); }); buttons.set(name, item); toolbar.append(item); return item;
  }
  const adapter = createEditorAdapter({ client, readonly, committedOperationId, extensions: [lineNumbers(), drawSelection(), search({ top: true }),
    EditorView.domEventHandlers({beforeinput:(event, target)=>sourceHistoryInput(event,target)||preserveMultilineInput(event,target)}),
    readonlySelectionGuard({readonly,isFocused:()=>Boolean(view?.contentDOM.contains(document.activeElement))}),
    indentUnit.of('    '), ...(syntaxLanguage==='python'?[pythonSupport(pythonParser)]:[]), colors.of(appearance(theme === 'dark')), wrap.of([]), editable.of(EditorView.editable.of(enabled)),EditorView.contentAttributes.of({tabindex:'0'}),
    keymap.of([{ key: 'Mod-s', run: () => { commands.run('save'); return true; } }, ...sourceHistoryKeymap, ...defaultKeymap, ...searchKeymap, indentWithTab])
  ] });
  const commands=createCodeCommands({stateFor:adapter.getStatus,isDisposed:()=>disposed||!view,handlers});
  // Search panels live outside CM's contentDOM. Its editor input handlers do
  // not receive panel events; observe the owned root to commit pasted queries
  // before an immediate Enter, without intercepting ordinary code input.
  const onSearchInput = event => {
    if (event.target.closest?.('.cm-search')) event.target.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));
  };
  root.addEventListener('input', onSearchInput);
  button('undo', 'Undo', () => sourceUndo(view)); button('redo', 'Redo', () => sourceRedo(view));
  button('find', 'Find', () => openSearchPanel(view));
  const wrappingButton = button('wrap', 'Wrap', () => {
    wrapping = !wrapping; wrappingButton.setAttribute('aria-pressed', String(wrapping));
    view.dispatch({ effects: wrap.reconfigure(wrapping ? EditorView.lineWrapping : []) });
  }); wrappingButton.setAttribute('aria-pressed', 'false');
  button('save', 'Save source', () => { void flush(); });
  handlers['select-all']=()=>{view.dispatch({selection:{anchor:0,head:view.state.doc.length}});view.focus();};
  if(readonly)for(const name of ['undo','redo','save'])buttons.get(name).hidden=true;
  const commandButton=document.createElement('button'),menu=document.createElement('div');commandButton.type='button';commandButton.textContent='Commands';commandButton.dataset.command='menu';commandButton.setAttribute('aria-haspopup','menu');commandButton.setAttribute('aria-expanded','false');menu.setAttribute('role','menu');menu.setAttribute('aria-label','Code commands');menu.dataset.codeMenu='true';menu.hidden=true;
  Object.assign(commandButton.style,{font:'13px system-ui',border:'1px solid #78859a55',borderRadius:'7px',padding:'6px 10px',color:'inherit',background:'transparent'});
  Object.assign(menu.style,{position:'fixed',zIndex:'100',minWidth:'220px',padding:'6px',border:'1px solid #78859a55',borderRadius:'12px',background:'var(--siren-alt,#edf1f8)',color:'inherit',boxShadow:'0 16px 48px #0004'});
  for(const [name,label]of [['undo','Undo · Ctrl Z'],['redo','Redo · Ctrl Shift Z'],['find','Find · Ctrl F'],['select-all','Select all · Ctrl A'],['wrap','Toggle wrap'],['save','Save source · Ctrl S']]){const item=document.createElement('button');item.type='button';item.textContent=label;item.dataset.menuCommand=name;item.setAttribute('role','menuitem');Object.assign(item.style,{display:'block',width:'100%',textAlign:'left',font:'13px system-ui',padding:'8px 12px',border:'0',borderRadius:'6px',background:'transparent',color:'inherit'});item.hidden=readonly&&['undo','redo','save'].includes(name);item.addEventListener('click',()=>{hideMenu();commands.run(name);});menuItems.set(name,item);menu.append(item);}
  const hideMenu=()=>{menu.hidden=true;commandButton.setAttribute('aria-expanded','false');};
  const showMenu=(x,y)=>{if(disposed||!adapter.getStatus().ready||adapter.getStatus().paused)return;for(const [name,item]of menuItems)item.disabled=!commands.enabled(name);menu.style.left=Math.max(8,Math.min(x,document.defaultView.innerWidth-250))+'px';menu.style.top=Math.max(8,Math.min(y,document.defaultView.innerHeight-280))+'px';menu.hidden=false;commandButton.setAttribute('aria-expanded','true');[...menuItems.values()].find(item=>!item.hidden&&!item.disabled)?.focus();};
  commandButton.addEventListener('click',()=>{if(!menu.hidden){hideMenu();return;}const box=commandButton.getBoundingClientRect();showMenu(box.left,box.bottom+6);});
  const onContext=event=>{if(!adapter.getStatus().ready||adapter.getStatus().paused)return;event.preventDefault();showMenu(event.clientX,event.clientY);};surface.addEventListener('contextmenu',onContext);
  const outside=event=>{if(!menu.contains(event.target)&&event.target!==commandButton)hideMenu();};document.addEventListener('pointerdown',outside);
  const menuKeys=event=>{if(menu.hidden)return;if(event.key==='Escape'){event.preventDefault();hideMenu();view?.focus();}else if(event.key==='Tab')hideMenu();else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const items=[...menuItems.values()].filter(item=>!item.hidden&&!item.disabled),i=items.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?items.length-1:(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();}};root.addEventListener('keydown',menuKeys);
  toolbar.append(commandButton);
  const language = document.createElement('span'); language.textContent = syntaxLanguage==='python'?'Python':syntaxLanguage==='text'?'Plain text':'Plain text · language unclassified'; Object.assign(language.style, { marginLeft: 'auto', font: '12px system-ui' }); toolbar.append(language);
  root.append(toolbar, surface, status,menu); container.replaceChildren(root);
  function paintTheme() {
    const dark = theme === 'dark'; root.dataset.theme = theme;
    root.style.background = `var(--siren-alt,${dark ? '#232936' : '#edf1f8'})`; root.style.color = `var(--siren-ink,${dark ? '#d9e0ed' : '#182335'})`;
  }
  function refresh(value = adapter.getStatus()) {
    if (disposed) return;
    const nextEnabled = value.ready && !value.readonly && !value.fenced && !value.saving && !value.paused;
    for(const [name,item]of buttons)item.disabled=!commands.enabled(name);
    for(const [name,item]of menuItems)item.disabled=!commands.enabled(name);commandButton.disabled=!value.ready||value.paused;if(commandButton.disabled)hideMenu();
    status.textContent = value.code ? (value.ready ? `Source not saved · ${value.code} · local text retained` : `Source not opened · ${value.code}`)
      : value.opening ? 'Opening verified source…' : value.saving ? 'Saving source…'
      : value.pending ? `Storing draft · ${value.pending} edit${value.pending === 1 ? '' : 's'} pending`
      : value.paused ? 'Editing paused'
      : value.readonly ? 'Read only' : value.durability === 'recovery-degraded' ? 'Source saved · recovery degraded'
      : value.dirty ? 'Draft stored · Save source to commit' : value.durability === 'committed' ? 'Source saved' : value.ready ? 'Ready' : 'Choose a source';
    const current=adapter.getState(),selection=current?.selection.main;
    if(selection){root.dataset.selectionFrom=String(selection.from);root.dataset.selectionTo=String(selection.to);status.textContent+=` · line ${current.doc.lineAt(selection.head).number}${selection.empty?'':` · ${selection.to-selection.from} selected`}`;}
    if (view && nextEnabled !== enabled) { enabled = nextEnabled; view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(enabled)) }); }
  }
  const unsubscribe = adapter.subscribe(refresh); paintTheme(); refresh();
  async function open(ref) {
    const receipt = await adapter.open(ref);
    if (disposed) return Object.freeze({ ok: false, code: 'EDITOR_DISPOSED' });
    if (!receipt.ok) {
      refresh(); status.textContent = adapter.getState() ? `Open refused · ${receipt.code} · current source retained` : `Source not opened · ${receipt.code}`;
      return receipt;
    }
    view = new EditorView({ parent: surface, state: adapter.getState(), dispatchTransactions(transactions) {
      for (const transaction of transactions) {
        const accepted = adapter.applyTransaction(transaction);
        if (accepted.ok) view.update([transaction]);
        else { view.setState(adapter.getState()); status.textContent = `Edit refused · ${accepted.code} · source unchanged`; }
      }
    } }); refresh(); return receipt;
  }
  async function flush() { const receipt = await adapter.flush(); refresh(); return receipt; }
  const lifecycle = createCodeViewLifecycle({editor: adapter, client});
  return Object.freeze({ open, flush, pauseView: adapter.pauseView, resumeRefresh: adapter.resumeView, flushView: lifecycle.flushView, resumeView: lifecycle.resumeView, getStatus: adapter.getStatus,
    // Exact immutable raw Text; getState().doc is the display line projection.
    getSourceText: adapter.getSourceText, getState: adapter.getState,subscribe:adapter.subscribe,
    focus: () => view?.focus(),
    select(from, to = from) { if (view) { view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true }); view.focus(); } },
    setTheme(next) {
      if (disposed) return Object.freeze({ ok: false, code: 'EDITOR_DISPOSED' });
      if (!['light', 'dark'].includes(next)) return Object.freeze({ ok: false, code: 'INVALID_THEME' });
      theme = next; paintTheme(); view?.dispatch({ effects: colors.reconfigure(appearance(theme === 'dark')) }); return Object.freeze({ ok: true });
    },
    dispose() { if (disposed) return; disposed = true; unsubscribe(); document.removeEventListener('pointerdown',outside);surface.removeEventListener('contextmenu',onContext);root.removeEventListener('keydown',menuKeys);root.removeEventListener('input', onSearchInput); adapter.dispose(); view?.destroy(); view = null; root.remove(); }
  });
}
