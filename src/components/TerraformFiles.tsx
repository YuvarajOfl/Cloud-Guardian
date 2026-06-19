import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  UploadCloud, 
  FileCode, 
  Trash2, 
  Calendar, 
  Layers, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  HelpCircle,
  FileArchive
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface TerraformFile {
  id: number;
  file_name: string;
  file_type: string;
  upload_time: string;
  status: string;
}

export function TerraformFiles() {
  const { token } = useAuth();
  
  const [files, setFiles] = useState<TerraformFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // State for duplicate upload conflict handling
  const [conflictFile, setConflictFile] = useState<File | null>(null);
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/files`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchFiles();
    }
  }, [token]);

  const triggerMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage(null);
    }, 6000);
  };

  const uploadFile = async (fileObj: File, action?: 'replace' | 'version') => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', fileObj);

    let url = `${API_URL}/api/upload`;
    if (action) {
      url += `?upload_action=${action}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.status === 409) {
        // Handle duplicate upload conflict
        setConflictFile(fileObj);
        setShowConflictModal(true);
        setUploading(false);
        return;
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to process file upload.');
      }

      const newFile = await response.json();
      triggerMessage('success', `File '${newFile.file_name}' uploaded and parsed successfully.`);
      fetchFiles(true);
    } catch (err: any) {
      triggerMessage('error', err.message || 'An error occurred during file upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected && selected.length > 0) {
      if (selected.length === 1) {
        uploadFile(selected[0]);
      } else {
        setUploading(true);
        let successCount = 0;
        let errors: string[] = [];
        
        for (let i = 0; i < selected.length; i++) {
          const fileObj = selected[i];
          const formData = new FormData();
          formData.append('file', fileObj);
          
          try {
            const response = await fetch(`${API_URL}/api/upload?upload_action=replace`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData
            });
            
            if (response.ok) {
              successCount++;
            } else {
              const errData = await response.json();
              errors.push(`${fileObj.name}: ${errData.detail || 'Upload failed'}`);
            }
          } catch (err: any) {
            errors.push(`${fileObj.name}: ${err.message || 'Network error'}`);
          }
        }
        
        if (successCount > 0) {
          triggerMessage('success', `${successCount} file(s) uploaded and parsed successfully.`);
          fetchFiles(true);
        }
        if (errors.length > 0) {
          triggerMessage('error', `Failed to upload some files: ${errors.join(', ')}`);
        }
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const handleConflictResolve = async (action: 'replace' | 'version') => {
    if (conflictFile) {
      const fileToUpload = conflictFile;
      setConflictFile(null);
      setShowConflictModal(false);
      await uploadFile(fileToUpload, action);
    }
  };

  const handleDeleteFile = async (id: number, filename: string) => {
    if (!window.confirm(`Are you sure you want to delete '${filename}'? This will remove all associated findings and resources.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/files/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        triggerMessage('success', `File '${filename}' deleted successfully.`);
        fetchFiles(true);
      } else {
        triggerMessage('error', 'Failed to delete file.');
      }
    } catch (err) {
      triggerMessage('error', 'Network error occurred while deleting file.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in relative z-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
            Terraform Files
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Upload and manage your Terraform state and configuration files (.tfstate, .json, .tf, .tfvars) securely in your workspace.
          </p>
        </div>
        <button 
          onClick={() => fetchFiles()}
          className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-lg hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          title="Refresh Files List"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications */}
      {message && (
        <div className={`p-4 border rounded-xl text-xs flex items-start gap-2.5 transition-all shadow-lg ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Upload Drag/Drop Section */}
      <div className="bg-slate-900/20 border border-white/5 hover:border-blue-500/20 transition-all rounded-2xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-xl group">
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".tfstate,.json,.tf,.tfvars"
          className="hidden" 
          id="file-upload-input"
          multiple
        />
        <div className="p-4 bg-white/5 text-slate-400 rounded-2xl group-hover:scale-105 transition-transform mb-4 group-hover:text-blue-400 group-hover:bg-blue-500/10">
          {uploading ? (
            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <UploadCloud className="h-6 w-6" />
          )}
        </div>
        <h3 className="text-sm font-bold text-slate-200">
          {uploading ? 'Processing & Analyzing Files...' : 'Upload Terraform Files'}
        </h3>
        <p className="text-slate-500 text-[11px] mt-1 max-w-xs leading-normal">
          Drag and drop your file here, or click to browse. We support state files (<code className="text-slate-400">.tfstate</code>, <code className="text-slate-400">.json</code>) and HCL configuration files (<code className="text-slate-400">.tf</code>, <code className="text-slate-400">.tfvars</code>).
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
        >
          {uploading ? 'Analyzing...' : 'Browse Files'}
        </button>
      </div>

      {/* File List Table */}
      <div className="bg-slate-900/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/5 bg-slate-950/20 flex justify-between items-center">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">Recent Uploads</span>
          <span className="text-slate-500 font-mono text-[10px]">Total: <b>{files.length}</b></span>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-500">Loading workspace files...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-16 text-center">
            <div className="p-4 bg-white/5 rounded-full inline-block text-slate-500 mb-4">
              <FileCode className="h-6 w-6" />
            </div>
            <p className="text-slate-400 text-sm font-bold">No Terraform files uploaded yet.</p>
            <p className="text-slate-600 text-xs mt-1 max-w-sm mx-auto leading-normal">
              Upload your first infrastructure state file to scan cloud configurations for cost waste and compliance issues.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/40 text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                  <th className="py-3 px-6">File Details</th>
                  <th className="py-3 px-6">Uploaded Date</th>
                  <th className="py-3 px-6">File Status</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-white/[0.01] transition-all text-xs text-slate-350">
                    <td className="py-4 px-6 font-semibold text-slate-200">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate max-w-[280px] block" title={file.file_name}>
                          {file.file_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-500 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-650" />
                        <span>{new Date(file.upload_time).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium font-mono border ${
                        file.status === 'parsed' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450' 
                          : file.status === 'failed' 
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-450'
                          : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-450'
                      }`}>
                        {file.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDeleteFile(file.id, file.file_name)}
                        className="p-1.5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-900/30 text-slate-400 hover:text-rose-450 rounded-lg transition-colors cursor-pointer"
                        title="Delete file & resources"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Duplicate File Conflict Modal Prompt */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-550 border border-amber-500/20 rounded-xl">
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Duplicate File Detected</h3>
                <p className="text-[11px] text-slate-450 text-slate-400 mt-0.5">Choose how you want to handle this upload.</p>
              </div>
            </div>

            <p className="text-xs text-slate-350 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-white/5">
              A file with name <b>'{conflictFile?.name}'</b> already exists in your workspace. You can choose to replace the active state with the new copy, or save it as a new version.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => handleConflictResolve('replace')}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Replace Existing File
              </button>
              <button
                onClick={() => handleConflictResolve('version')}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Create New Version
              </button>
            </div>
            
            <button
              onClick={() => {
                setConflictFile(null);
                setShowConflictModal(false);
              }}
              className="w-full py-2 border border-transparent hover:underline text-slate-500 text-xs text-center cursor-pointer"
            >
              Cancel Upload
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
