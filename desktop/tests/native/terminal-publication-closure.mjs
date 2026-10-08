// Test-only presence check for this fixed source set's literal relative imports.
// Not a JavaScript parser, package resolver, or native admission decision.
import path from 'node:path';

export function findMissingRelativeImports({ sources, availablePaths }) {
  const required = new Set();
  for (const { path: sourcePath, content } of sources) {
    if (!sourcePath.startsWith('desktop/') || path.posix.normalize(sourcePath) !== sourcePath || sourcePath.includes('\\')) throw Error('INVALID_SOURCE_PATH');
    required.add(sourcePath);
    const literal = /\bfrom\s*['"]([^'"\r\n]+)['"]|\bimport\s*\(\s*['"]([^'"\r\n]+)['"]\s*\)|\bimport\s*['"]([^'"\r\n]+)['"]/g;
    for (const match of content.matchAll(literal)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!specifier.startsWith('.')) continue;
      if (specifier.includes('\\') || /[?#]/.test(specifier)) throw Error('UNSUPPORTED_RELATIVE_IMPORT');
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier));
      if (!target.startsWith('desktop/')) throw Error('IMPORT_OUTSIDE_DESKTOP');
      required.add(target);
    }
  }
  const available = new Set(availablePaths), requiredPaths = [...required].sort();
  return { nativeExecutionAdmitted: false, requiredPaths, missingPaths: requiredPaths.filter(p => !available.has(p)) };
}
