import {createDiagramMetadataContract} from '../src/documents/diagram-metadata.mjs';
export function buildDiagramMetadata(){return 'window.SirenDiagramMetadata=('+createDiagramMetadataContract.toString()+')();';}
