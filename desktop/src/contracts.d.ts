export type Failure = { ok: false; code: string; message: string };
export type ProjectRef = { id: string; label: string; external: boolean };
export type Snapshot = { project: ProjectRef; revision: number; schema: 1; json: string; sha256: string };
export type PinState = { configured: boolean; pinLength: 4 | 6 | null; unlocked: boolean; available: boolean; blocked: boolean; retryAfterMs: number };
export type PinResult = { ok: true } | (Failure & { retryAfterMs?: number });
export type PinSetup = { pin: string; confirmation: string };
export type PinChange = { currentPin: string; newPin: string; confirmation: string };
export type BootstrapState = { mode: 'locked' | 'normal' | 'recovery' | 'readonly'; reason?: string | null; snapshot: Snapshot | null; recoveryProjectId: string | null; readonly: boolean; localAccess?: boolean; pin?: PinState };
export type SaveRequest = { projectId: string; baseRevision: number; json: string; purpose: 'workspace' | 'recovery' };
export type SaveResult = { ok: true; revision: number; sha256: string } | Failure;
export type RecoveryPoint = { id: string; projectId: string; createdAt: string; revision: number; schema: 1; sha256: string; kind: 'saved' | 'draft' | 'emergency'; verified: boolean };
export type RecoveryState = { mode: 'normal' | 'recovery' | 'readonly'; reason: string | null; points: RecoveryPoint[]; damagedPoints: Array<{ id: string; projectId: string }>; lastRecoverableAt: string | null };
export type AccessState = { state: 'unactivated' | 'online' | 'offline' | 'reauth-required' | 'revoked'; offlineUntil: string | null; recoveryOnly: boolean };
export type UpdateState = { phase: 'unconfigured' | 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'applying' | 'error'; version: string | null; bytesReceived: number; totalBytes: number | null; errorCode: string | null };
export type UpdateConfig = { repository: string | null; channel: 'stable'; trustedKeys: Record<string, string>; maxPackageBytes: number };
export type Manifest = { schema: 1; product: 'siren'; channel: 'stable'; version: string; platform: 'win32'; arch: 'x64'; dataSchema: 1; sequence: number; expiresAt: string; minAllowedVersion: string; keyId: string; asset: { name: string; bytes: number; sha256: string }; files: Array<{ path: string; bytes: number; sha256: string }> };
export type VerifiedUpdate = { manifest: Manifest; manifestSha256: string; assetUrl: string };

// cancelUpdate() has no renderer-supplied path/config; ready is staged, never installed.
