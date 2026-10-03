/** All offsets and line widths are UTF-16 units; terminators do not count in width. */
export function measureSource(text) {
  if (typeof text !== 'string') throw Object.assign(new TypeError('Source must be text'), { code: 'INVALID_TEXT' });
  if (!text.isWellFormed()) throw Object.assign(new Error('Unpaired surrogate'), { code: 'INVALID_UNICODE' });
  let lines = 1;
  let longestLineUnits = 0;
  let start = 0;
  for (const match of text.matchAll(/\r\n|\r|\n/g)) {
    longestLineUnits = Math.max(longestLineUnits, match.index - start);
    start = match.index + match[0].length;
    lines += 1;
  }
  return {
    utf8Bytes: Buffer.byteLength(text, 'utf8'),
    utf16Units: text.length,
    lines,
    longestLineUnits: Math.max(longestLineUnits, text.length - start),
  };
}
