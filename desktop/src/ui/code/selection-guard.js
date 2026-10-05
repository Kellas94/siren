import {EditorState,Transaction} from '@codemirror/state';

/** A non-editable CM view still observes DOM selection while a toolbar owns
 * focus. Repainting syntax can leave a delayed, collapsed browser selection.
 * Keep the stored range; genuine pointer/keyboard and explicit navigation remain.
 */
export function readonlySelectionGuard({readonly,isFocused}) {
 return EditorState.transactionFilter.of(transaction=>
  readonly&&!transaction.docChanged&&transaction.selection&&
  transaction.annotation(Transaction.userEvent)==='select'&&!isFocused()
   ? [] : transaction);
}
