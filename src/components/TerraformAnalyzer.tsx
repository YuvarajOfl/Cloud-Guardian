import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { TerraformFile } from '../types';
import { 
  UploadCloud, 
  Trash2, 
  Eye, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  FileCode, 
  FileText, 
  FolderArchive,
  RefreshCw
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function TerraformAnalyzer() {
  const { token } = useAuth();
  const [files, setFiles] = useState<TerraformFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // File Viewer Modal State
  const [viewModalOpen, setViewModalOpen] = useState<boolean>(false);
  const [viewFileName, setViewFileName] = useState<string>('');
  const [viewFileLoading, setViewFileLoading] = useState<boolean>(false);
  const [viewContent, setViewContent] = useState<{ is_text: boolean; content?: string; zip_files?: string[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch files lists
  const fetchFiles = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/files`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      } else {
        console.error('Failed to fetch uploaded files list.');
      }
    } catch (err) {
      console.error('Network error fetching files:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [token]);

  // Polling setup for active queued background scans
  useEffect(() => {
    const hasQueuedFiles = files.some(file => file.status === 'queued');
    if (hasQueuedFiles) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => {
          fetchFiles(true);
        }, 2000);
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [files]);

  // Alert message controller
  const triggerMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage(null);
    }, 6000);
  };

  // Drag handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFileSelection(e.target.files[0]);
    }
  };

  // Extension validation
  const processFileSelection = (file: File) => {
    const allowed = ['.tf', '.tfvars', '.zip'];
    const filename = file.name.toLowerCase();
    const isAllowed = allowed.some(ext => filename.endsWith(ext));

    if (!isAllowed) {
      triggerMessage('error', `Invalid file extension. Only ${allowed.join(', ')} files are allowed.`);
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      triggerMessage('error', 'File size exceeds 20MB limit.');
      return;
    }

    uploadFileRequest(file);
  };

  // Upload request using XMLHttpRequest to report progress
  const uploadFileRequest = (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status === 201) {
        triggerMessage('success', `File '${file.name}' uploaded successfully.`);
        fetchFiles(true);
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          triggerMessage('error', errData.detail || 'Upload failed.');
        } catch {
          triggerMessage('error', 'Upload failed. Check connection.');
        }
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      triggerMessage('error', 'Network error during upload.');
    };

    xhr.send(formData);
  };

  // Delete File Action
  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete '${name}'?`)) return;
    
    try {
      const response = await fetch(`${API_URL}/api/files/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        triggerMessage('success', `Successfully deleted '${name}'`);
        fetchFiles(true);
      } else {
        triggerMessage('error', 'Failed to delete file.');
      }
    } catch (err) {
      triggerMessage('error', 'Connection error while deleting file.');
    }
  };

  // Analyze File Action
  const handleAnalyze = async (id: number, name: string) => {
    try {
      const response = await fetch(`${API_URL}/api/files/${id}/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        triggerMessage('success', `Security analysis queued for '${name}'`);
        fetchFiles(true);
      } else {
        const err = await response.json();
        triggerMessage('error', err.detail || 'Failed to queue analysis.');
      }
    } catch (err) {
      triggerMessage('error', 'Connection error while starting scan.');
    }
  };

  // View Content Action (opens code modal)
  const handleView = async (id: number, name: string) => {
    setViewFileName(name);
    setViewModalOpen(true);
    setViewFileLoading(true);
    setViewContent(null);

    try {
      const response = await fetch(`${API_URL}/api/files/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setViewContent(data);
      } else {
        setViewContent({ is_text: true, content: '[Failed to load file contents from server]' });
      }
    } catch (err) {
      setViewContent({ is_text: true, content: '[Network error loading file content]' });
    } finally {
      setViewFileLoading(false);
    }
  };

  // Determine file icon
  const getFileIcon = (filename: string) => {
    const fn = filename.toLowerCase();
    if (fn.endsWith('.zip')) return <FolderArchive className="h-4 w-4 text-amber-500" />;
    if (fn.endsWith('.tfvars')) return <FileText className="h-4 w-4 text-purple-500" />;
    return <FileCode className="h-4 w-4 text-indigo-400" />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in relative z-10">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
            Terraform Infrastructure Analyzer
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Upload configuration files or zip bundles to audit safety rules, identify open subnets, and check compliance.
          </p>
        </div>
        <button 
          onClick={() => fetchFiles()}
          className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-350 rounded-lg hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          title="Refresh table"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Upload Zone & Alerts */}
      <div className="grid grid-cols-1 gap-6">
        
        {message && (
          <div className={`p-4 border rounded-xl text-xs flex items-start gap-2.5 transition-all shadow-lg ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Drag & Drop Area */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[200px] relative overflow-hidden group ${
            dragOver 
              ? 'border-blue-500 bg-blue-950/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]' 
              : 'border-white/10 bg-white/[0.01] hover:border-blue-500/30 hover:bg-slate-900/10'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".tf,.tfvars,.zip" 
          />
          
          <div className={`p-4 rounded-xl mb-4 transition-transform group-hover:scale-110 ${
            dragOver ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/10'
          }`}>
            <UploadCloud className="h-8 w-8" />
          </div>

          <h3 className="text-sm font-bold text-slate-200">
            Drag & drop your configuration file here
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-normal">
            Supports <code className="text-slate-350">.tf</code>, <code className="text-slate-350">.tfvars</code>, and <code className="text-slate-350">.zip</code> bundles (Max size: 20MB). Or click to browse folders.
          </p>

          {/* Progress bar overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 backdrop-blur-sm z-30">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Uploading payload...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Files List Table */}
      <div className="bg-slate-900/30 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Uploaded Infrastructure Files
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            Total files: {files.length}
          </span>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <div className="h-7 w-7 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-500">Querying registry...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <p className="text-slate-400 text-xs font-medium">No files registered on your account.</p>
            <p className="text-slate-650 text-[10px] max-w-sm mx-auto leading-normal">
              Upload single terraform scripts or bundle zip directories above to configure your active security inspection catalog.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/40 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                  <th className="py-3 px-6">File Name</th>
                  <th className="py-3 px-6">Upload Date</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {files.map((file) => {
                  const isQueued = file.status === 'queued';
                  return (
                    <tr key={file.id} className="hover:bg-white/[0.01] transition-all text-xs text-slate-300">
                      <td className="py-3.5 px-6 font-medium text-slate-200">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(file.original_filename)}
                          <span className="truncate max-w-[240px]" title={file.original_filename}>
                            {file.original_filename}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-400">
                        {new Date(file.upload_timestamp).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-6">
                        {file.status === 'uploaded' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Ready for Scan
                          </span>
                        )}
                        {file.status === 'queued' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                            Scanning...
                          </span>
                        )}
                        {file.status === 'analyzed' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Analyzed ({file.analysis_records?.[0]?.findings_count ?? 0} findings)
                          </span>
                        )}
                        {file.status === 'failed' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-rose-500/10 text-rose-450 border border-rose-500/20">
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleView(file.id, file.original_filename)}
                            className="p-1.5 hover:bg-white/5 border border-white/5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="View contents"
                            disabled={isQueued}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          
                          <button
                            onClick={() => handleAnalyze(file.id, file.original_filename)}
                            className={`p-1.5 border rounded-lg transition-colors cursor-pointer ${
                              isQueued 
                                ? 'bg-amber-500/5 border-amber-500/10 text-amber-500 cursor-not-allowed'
                                : 'hover:bg-emerald-500/10 border-white/5 text-slate-450 hover:text-emerald-400'
                            }`}
                            title="Run scanner"
                            disabled={isQueued}
                          >
                            <Play className={`h-3.5 w-3.5 ${isQueued ? 'animate-spin' : ''}`} />
                          </button>

                          <button
                            onClick={() => handleDelete(file.id, file.original_filename)}
                            className="p-1.5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-900/30 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                            title="Delete file"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Code Viewer Modal */}
      {viewModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-white/5 bg-slate-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getFileIcon(viewFileName)}
                <span className="text-xs font-bold text-slate-200 truncate max-w-[320px] sm:max-w-md">
                  {viewFileName}
                </span>
              </div>
              <button 
                onClick={() => setViewModalOpen(false)}
                className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto bg-[#040508] p-6 font-mono text-[11px] leading-relaxed select-text">
              {viewFileLoading ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
                  <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-slate-500">Retrieving content from secure vaults...</span>
                </div>
              ) : viewContent?.is_text ? (
                <pre className="text-slate-350 text-left whitespace-pre-wrap font-mono select-text">
                  {viewContent?.content || '[Empty File]'}
                </pre>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center gap-2">
                    <FolderArchive className="h-4.5 w-4.5 text-amber-400" />
                    <span className="font-sans text-xs text-slate-300">
                      ZIP Archive contains {viewContent?.zip_files?.length ?? 0} files:
                    </span>
                  </div>
                  <ul className="divide-y divide-white/[0.02] border border-white/5 rounded-xl bg-slate-900/25 overflow-hidden">
                    {viewContent?.zip_files?.map((filename, idx) => (
                      <li key={idx} className="py-2.5 px-4 text-slate-400 hover:text-slate-200 hover:bg-white/[0.01]">
                        {filename}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/5 bg-slate-950/30 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setViewModalOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer font-semibold"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
