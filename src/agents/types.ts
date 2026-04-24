export interface AgentInput {
  session_id: string;
  user_photo_path: string;
  garment_photo_paths: string[];
}

export interface AgentOutput {
  stage: string;
  result: unknown;
  error?: string;
}

export interface AuditLogEntry {
  timestamp: string;
  session_id: string;
  agent: string;
  action: string;
  duration_ms?: number;
  error?: string;
}

export interface TryonJob {
  id: string;
  person_asset_id: string;
  garment_asset_ids: string[];
  status: 'queued' | 'processing' | 'done' | 'failed';
  /** Higgsfield async job ID, present when job was created via /generate */
  higgsfield_job_id?: string;
}
