export interface User {
  id: number;
  google_id: string;
  name: string;
  email: string;
  profile_picture?: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRecord {
  id: number;
  file_id: number;
  status: string;
  findings_count: number;
  created_at: string;
}

export interface TerraformFile {
  id: number;
  user_id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  upload_timestamp: string;
  status: 'uploaded' | 'queued' | 'analyzed' | 'failed';
  created_at: string;
  analysis_records: AnalysisRecord[];
}

