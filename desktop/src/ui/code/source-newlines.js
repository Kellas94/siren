import { ChangeSet, EditorState, StateEffect, StateField, Text, Transaction } from '@codemirror/state';
import { history, historyKeymap, isolateHistory, undo, redo, undoSelection, redoSelection, undoDepth, redoDepth } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';

const textOf = text => Text.of(text.split('\n'));
function projectPart(text, next = '') {
  return text.replace(/\r(?!\n)/g, (cr, at) => at === text.length - 1 && next === '\n' ? cr : '\n');
}

/** Standard CM Text with universal lines and the same UTF-16 positions as raw.
 * Standalone CR occupies one logical break. CRLF keeps its existing two units
 * (the CR remains at the end of the preceding line). This is a display
 * projection only: raw Text is the separate serialization/persistence source.
 * An unchanged LF/CRLF tree is returned by identity.
 */
export function projectSourceLines(raw) {
  let projected = null, position = 0;
  for (const iterator = raw.iter(); !iterator.next().done;) {
    const value = iterator.value, end = position + value.length;
    const next = raw.sliceString(end, Math.min(raw.length, end + 1));
    const text = iterator.lineBreak ? value : projectPart(value, next);
    if (!projected && text !== value) projected = raw.slice(0, position);
    if (projected) projected = projected.append(textOf(text));
    position = end;
  }
  return projected ?? raw;
}

const appliedSourceChanges = StateEffect.define();
const sourceHistoryTransaction = StateEffect.define();
const historyAnnotations = transaction => [Transaction.time, Transaction.userEvent, Transaction.addToHistory, isolateHistory]
  .filter(type => transaction.annotation(type) !== undefined).map(type => type.of(transaction.annotation(type)));
function sameChanges(left, right) {
  if (left === right) return true;
  if (left.length !== right.length || left.newLength !== right.newLength) return false;
  const ranges = []; left.iterChanges((from, to, nextFrom, nextTo, text) => ranges.push({ from, to, nextFrom, nextTo, text }));
  let index = 0, equal = true;
  right.iterChanges((from, to, nextFrom, nextTo, text) => {
    const range = ranges[index++];
    if (!range || range.from !== from || range.to !== to || range.nextFrom !== nextFrom || range.nextTo !== nextTo || !range.text.eq(text)) equal = false;
  });
  return equal && index === ranges.length;
}
function rawHistory(raw, state) {
  return EditorState.create({ doc: raw, selection: state.selection, extensions: [history(),
    EditorState.lineSeparator.of('\n'), EditorState.allowMultipleSelections.of(true), EditorState.readOnly.of(state.readOnly)] });
}

/** Reproject changed ranges and one source unit on either side. Only actual
 * differences become CM changes, so neighboring raw CRs are not spuriously
 * deleted/reinserted into history. No whole-source serialization on input.
 */
function projectedChanges(before, raw, changes) {
  const after = changes.apply(raw), base = changes.apply(before), ranges = [];
  changes.iterChanges((_from, _to, from, to) => {
    from = Math.max(0, from - 1); to = Math.min(after.length, to + 1);
    const last = ranges.at(-1);
    if (last && from <= last.to) last.to = Math.max(to, last.to);
    else ranges.push({ from, to });
  });
  const corrections = [];
  for (const { from, to } of ranges) {
    const expected = projectPart(after.sliceString(from, to), after.sliceString(to, Math.min(after.length, to + 1)));
    const actual = base.sliceString(from, to);
    // Each mismatch is exactly a CR/LF substitution, with no offset mapping.
    for (let index = 0; index < expected.length; index++) if (expected[index] !== actual[index]) {
      corrections.push({ from: from + index, to: from + index + 1, insert: expected[index] });
    }
  }
  const repair = ChangeSet.of(corrections, base.length, '\n');
  return { changes: corrections.length ? changes.compose(repair) : changes, repair };
}

const sourceText = StateField.define({
  create: state => ({ raw: state.doc, history: rawHistory(state.doc, state), changes: ChangeSet.empty(state.doc.length), valid: true }),
  update(value, transaction) {
    let historyTransaction = transaction.effects.find(effect => effect.is(sourceHistoryTransaction))?.value;
    if (!transaction.docChanged && !transaction.selection && !historyTransaction && transaction.annotation(isolateHistory) === undefined) return value;
    const effect = transaction.effects.find(candidate => candidate.is(appliedSourceChanges));
    const changes = effect ? effect.value : transaction.changes;
    let valid = !historyTransaction || historyTransaction.startState === value.history;
    // Legacy CM commands on an unprojected LF/CRLF state remain compatible
    // only when their actual inverse equals the raw history inverse. A view
    // inverse containing display repairs cannot enter raw persistence.
    if (!historyTransaction && /^(undo|redo|select\.undo|select\.redo)$/.test(transaction.annotation(Transaction.userEvent) ?? '')) {
      const command = transaction.isUserEvent('undo') ? undo : transaction.isUserEvent('redo') ? redo
        : transaction.isUserEvent('select.undo') ? undoSelection : redoSelection;
      command({ state: value.history, dispatch: next => { historyTransaction = next; } });
      valid = !!historyTransaction && sameChanges(historyTransaction.changes, changes);
    }
    if (!historyTransaction) historyTransaction = value.history.update({ changes, selection: transaction.newSelection, annotations: historyAnnotations(transaction) });
    const raw = historyTransaction.newDoc;
    valid = valid && sameChanges(historyTransaction.changes, changes)
      && projectedChanges(transaction.startState.doc, value.raw, changes).changes.apply(transaction.startState.doc).eq(transaction.newDoc);
    return { raw, history: historyTransaction.state, changes, valid };
  }
});

export function exactSourceExtensions(raw) {
  return [sourceText.init(state => ({ raw, history: rawHistory(raw, state), changes: ChangeSet.empty(raw.length), valid: true })),
    EditorView.clipboardOutputFilter.of((text, state) => {
      const ranges = state.selection.ranges.filter(range => !range.empty);
      if (!ranges.length) return text; // CM's linewise copy does not include a source terminator.
      const selected = ranges.map(range => state.sliceDoc(range.from, range.to)).join(state.lineBreak);
      if (text !== selected) return text;
      const source = state.field(sourceText).raw;
      return ranges.map(range => source.sliceString(range.from, range.to)).join(state.lineBreak);
    }),
    EditorState.transactionFilter.of(transaction => {
      if (!transaction.docChanged) return transaction;
      const changes = transaction.changes;
      const projected = projectedChanges(transaction.startState.doc, transaction.startState.field(sourceText).raw, changes);
      // Retain the public transaction's effects, annotations, selection and
      // IME identity; append a same-length repair in new-document coordinates.
      return [transaction, { changes: projected.repair, effects: appliedSourceChanges.of(changes), sequential: true }];
    })];
}

/** Source history uses installed CM history on exact persistent raw Text.
 * Display repairs never enter that history. Commands dispatch the projected
 * view transaction, and its raw history state is adopted only with that same
 * transaction. Refusing the adapter transaction therefore consumes no history.
 * These commands, rather than CM history on state.doc, are the source API.
 */
function sourceCommand(command) {
  return ({ state, dispatch }) => {
    const source = state.field(sourceText, false);
    if (!source || state.readOnly) return false;
    return command({ state: source.history, dispatch: rawTransaction => dispatch(state.update({
      changes: rawTransaction.changes, selection: rawTransaction.selection,
      effects: sourceHistoryTransaction.of(rawTransaction), annotations: historyAnnotations(rawTransaction),
      scrollIntoView: rawTransaction.scrollIntoView
    })) });
  };
}
export const sourceUndo = sourceCommand(undo), sourceRedo = sourceCommand(redo);
export const sourceUndoSelection = sourceCommand(undoSelection), sourceRedoSelection = sourceCommand(redoSelection);
export const sourceUndoDepth = state => state?.field(sourceText, false) ? undoDepth(state.field(sourceText).history) : 0;
export const sourceRedoDepth = state => state?.field(sourceText, false) ? redoDepth(state.field(sourceText).history) : 0;
export const isSourceHistoryTransaction = transaction => transaction.effects.some(effect => effect.is(sourceHistoryTransaction));
const sourceCommands = new Map([[undo, sourceUndo], [redo, sourceRedo], [undoSelection, sourceUndoSelection], [redoSelection, sourceRedoSelection]]);
const handled = command => view => { command(view); return true; };
export const sourceHistoryKeymap = [...historyKeymap.map(binding => ({ ...binding, run: handled(sourceCommands.get(binding.run)) })),
  { key: 'Mod-Shift-z', run: handled(sourceRedo), preventDefault: true }];
export function sourceHistoryInput(event, view) {
  if (!['historyUndo', 'historyRedo'].includes(event.inputType)) return false;
  if (!event.defaultPrevented) { event.preventDefault(); (event.inputType === 'historyUndo' ? sourceUndo : sourceRedo)(view); }
  return true;
}

export const getSourceText = state => state?.field(sourceText).raw ?? null;
export function getSourceChanges(transaction) {
  const value = transaction.state.field(sourceText);
  return value.valid ? value.changes : null;
}
