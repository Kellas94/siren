// Copy an inert prepared tree into a new execution root. No module execution.
import {cp} from 'node:fs/promises';
export async function copySessionProvisionTree(source,destination){
 await cp(source,destination,{recursive:true,errorOnExist:true,force:false});
}
