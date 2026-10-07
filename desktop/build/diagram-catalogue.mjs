import {createDiagramCatalogueContract} from '../src/documents/diagram-catalogue.mjs';
export function buildDiagramCatalogueScript(){const script='window.SirenDiagramCatalogue=('+createDiagramCatalogueContract.toString()+')();';if(/<\/script/i.test(script))throw Error('Catalogue script boundary refused');return script;}
