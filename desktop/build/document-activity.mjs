import {createDocumentActivityContract} from '../src/documents/document-activity.mjs';
export function buildDocumentActivity(){return 'window.SirenDocumentActivity=('+createDocumentActivityContract.toString()+')();';}
