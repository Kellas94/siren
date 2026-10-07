// Exact fixture resource boundary. This does not relax product CSP/protocol.
export const expectedHomeResources=Object.freeze([
 'siren://app/home.html',
 'siren://app/assets/shell.js',
 'siren://app/assets/shell.css',
 'siren://app/assets/home-workspace.js',
 'siren://app/assets/diagram-catalogue.css',
]);
export function hasOnlyHomeResources(requests){return Array.isArray(requests)&&requests.length>0&&requests.every(url=>typeof url==='string'&&expectedHomeResources.includes(url));}
