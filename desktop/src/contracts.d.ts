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

export type NativeViewRole = 'workspace' | 'code' | 'docs' | 'presenter' | 'audience';
export type NativeViewRequest = { role: 'code' | 'docs'; entityId: string; version?: number };
export type NativeViewRecord = { windowId: string; role: NativeViewRole; projectId: string; epoch: number; entityId: string | null; state: 'active' | 'minimized' };
export type NativeViewGrant = { webContentsId: number; mainFrameUrl: string; windowId: string; role: NativeViewRole; projectId: string; epoch: number; entityIds: readonly string[] };
// Shell records contain no source/Docs bodies. Editor/presentation transport is
// deliberately separate; presenter/audience open is not admitted by shell IPC.

export type NativeDocumentContext = { ok: true; readonly: boolean; canEdit?: boolean; document: Record<string, unknown> & { id: string }; version: string; sha256: string; projectRevision: number };
export type NativeDocumentEdit = { operationId: string; documentId: string; expectedVersion: string; action: 'rename' | 'replace-blocks' | 'replace-content'; payload: { title?: string; blocks?: unknown[] } };
export type NativeDocumentReceipt = { ok: true; domain: 'docs'; entityId: string; version: string; sha256: string; projectRevision: number; durability: 'committed' | 'recovery-degraded'; operationId?: string };
export type NativeDocumentChange = { documentId: string; version: string; projectRevision: number };
export type NativeDiagramRead = { ok: true; readonly: boolean; canEdit?: boolean; diagram: { id: string; name?: string; source: string; [key: string]: unknown }; version: number; sha256: string; projectRevision: number } | { ok: false; code: string };
export type AnalysisStatus = 'complete' | 'partial' | 'unsupported' | 'budget-exceeded' | 'cancelled' | 'error';
export type AnalysisSourceRef = { sourceId: string; version: number; sha256: string };
export type SourceAnalysisRequest = AnalysisSourceRef & { jobId: string } & ({ kind: 'index'; range?: { from: number; to: number }; budget?: { maxUnits?: number; maxDefinitions?: number; maxNodes?: number; wallMs?: number } } | { kind: 'diff'; rightWindowId: string; rightRef: AnalysisSourceRef; budget?: { maxUnits?: number; maxCells?: number; maxLines?: number; maxHunks?: number; maxPreviewUnits?: number; maxTotalPreviewUnits?: number; wallMs?: number } });
export type SourceComparisonChoices = { ok: true; items: { windowId: string; sourceRef: AnalysisSourceRef }[] } | { ok: false; code: string };
export type DiffRange = { from: number; to: number; fromLine: number; toLine: number; preview: string };
export type SourceDiffResult = { ok: true; sourceId: string; version: number; jobId: string; rightRef: AnalysisSourceRef; status: AnalysisStatus; coverage: { left: { from: number; to: number; totalUnits: number }; right: { from: number; to: number; totalUnits: number }; approximate: boolean; previewTruncated: boolean } | null; result?: { identical: boolean; approximate: boolean; previewTruncated: boolean; hunks: { left: DiffRange; right: DiffRange; approximate: boolean }[] }; reason?: string } | { ok: false; code: string };
export type SourceDefinition = { name: string; kind: 'class' | 'function'; async: boolean; from: number; to: number; nameFrom: number; nameTo: number; line: number; parent: number | null };
export type SourceAnalysisResult = { ok: true; sourceId: string; version: number; jobId: string; status: AnalysisStatus; coverage: { from: number; to: number; totalUnits: number; truncated: boolean; syntaxErrors: number; limited: boolean } | null; result?: { definitions: SourceDefinition[]; errors: { from: number; to: number }[]; visited: number }; reason?: string } | { ok: false; code: string };
