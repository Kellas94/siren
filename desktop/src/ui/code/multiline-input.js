import {Transaction} from '@codemirror/state';
import {EditorView} from '@codemirror/view';

/** Chromium delivers multiline insertText beforeinput intact, but the native
 * DOM-to-model path can collapse a leading blank line at EOF. Admit the trusted
 * cancelable text through the public transaction API before that DOM mutation.
 * Composition, paste and ordinary single-line input keep their native handlers. */
export function preserveMultilineInput(event,view){
 if(event.isTrusted!==true||event.cancelable!==true||event.defaultPrevented||event.isComposing||view.composing||event.inputType!=='insertText'||typeof event.data!=='string'||!/[\r\n]/.test(event.data)||view.state.readOnly||!view.state.facet(EditorView.editable))return false;
 event.preventDefault();
 view.dispatch(view.state.replaceSelection(event.data),{scrollIntoView:true,annotations:Transaction.userEvent.of('input.type')});
 return true;
}
