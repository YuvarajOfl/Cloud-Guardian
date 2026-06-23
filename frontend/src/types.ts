export interface User {
  id: number;
  google_id?: string;
  name: string;
  email: string;
  profile_picture?: string;
  role?: string;
  provider: string;
  is_active?: boolean;
  is_deleted?: boolean;
  is_admin?: boolean;
  access_level?: string;
  created_at: string;
  updated_at: string;
}

export interface TerraformResource {
  id: number;
  file_id: number;
  resource_type: string;
  resource_name: string;
  provider: string;
  region: string;
  resource_metadata: any;
  status: string;
}

export interface TerraformFile {
  id: number;
  user_id: number;
  file_name: string;
  file_type: string;
  upload_time: string;
  status: 'uploaded' | 'parsed' | 'failed';
  resources?: TerraformResource[];
}
