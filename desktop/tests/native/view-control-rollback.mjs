// Fault mode belongs solely to the owned native probe; main receives no bypass.
process.argv.push('--owned-source-corruption');
await import('./source-read.mjs');
