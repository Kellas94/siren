export const MAX_WORKSPACE_BYTES = 64 * 1024 * 1024;
// Embedding valid workspace JSON as a JSON string can double its UTF-8 size.
// Project, pending and recovery envelopes share a bounded metadata allowance.
export const MAX_SERIALIZED_WORKSPACE_BYTES = MAX_WORKSPACE_BYTES * 2 + 65536;

export function serializeWorkspaceRecord(record) {
  const bytes = Buffer.from(JSON.stringify(record));
  if (bytes.length > MAX_SERIALIZED_WORKSPACE_BYTES) throw new Error('Serialized workspace exceeds record limit');
  return bytes;
}
