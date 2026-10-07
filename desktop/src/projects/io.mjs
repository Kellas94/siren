import { open } from 'node:fs/promises';
import { ownedFile } from './paths.mjs';

export async function readOwnedBytes(path, limit) {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid file limit');
  const file = await open(await ownedFile(path), 'r');
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > limit) throw new Error('File exceeds read limit');
    const chunks = []; let total = 0;
    for (;;) {
      const chunk = Buffer.alloc(Math.min(65536, limit - total + 1));
      const { bytesRead } = await file.read(chunk, 0, chunk.length, null);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > limit) throw new Error('File grew beyond read limit');
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, total);
  } finally { await file.close(); }
}
