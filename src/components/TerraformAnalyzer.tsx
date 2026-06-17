import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { TerraformFile, TerraformResource } from '../types';
import { 
  UploadCloud, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  FileCode, 
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Database,
  ShieldAlert,
  FileText,
  DollarSign,
  Sparkles,
  Copy
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function TerraformAnalyzer() {
  const { token } = useAuth();
  
  // Data State
  const [files, setFiles] = useState<TerraformFile[]>([]);
  const [resources, setResources] = useState<TerraformResource[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [costFindings, setCostFindings] = useState<any[]>([]);
  
  // Loading & Action State
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
  const [loadingResources, setLoadingResources] = useState<boolean>(true);
  const [loadingFindings, setLoadingFindings] = useState<boolean>(true);
  const [loadingCostFindings, setLoadingCostFindings] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedFileId, setSelectedFileId] = useState<string>('all');
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'inventory' | 'findings' | 'ai-insights'>('inventory');
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [generatingInsightId, setGeneratingInsightId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [findingsSearchTerm, setFindingsSearchTerm] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  
  // Cost Search & Filter State
  const [costSearchTerm, setCostSearchTerm] = useState<string>('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [costCurrentPage, setCostCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Files from Backend
  const fetchFiles = async (silent = false) => {
    if (!silent) setLoadingFiles(true);
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
      if (!silent) setLoadingFiles(false);
    }
  };

  // Fetch Resources from Backend
  const fetchResources = async (silent = false) => {
    if (!silent) setLoadingResources(true);
    try {
      const url = selectedFileId === 'all' 
        ? `${API_URL}/api/resources` 
        : `${API_URL}/api/resources/${selectedFileId}`;
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setResources(data);
      } else {
        console.error('Failed to fetch resources.');
      }
    } catch (err) {
      console.error('Network error fetching resources:', err);
    } finally {
      if (!silent) setLoadingResources(false);
    }
  };

  // Fetch Findings from Backend
  const fetchFindings = async (silent = false) => {
    if (!silent) setLoadingFindings(true);
    try {
      const url = selectedFileId === 'all' 
        ? `${API_URL}/api/findings` 
        : `${API_URL}/api/findings/${selectedFileId}`;
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFindings(data);
      } else {
        console.error('Failed to fetch findings.');
      }
    } catch (err) {
      console.error('Network error fetching findings:', err);
    } finally {
      if (!silent) setLoadingFindings(false);
    }
  };

  // Fetch Cost Findings from Backend
  const fetchCostFindings = async (silent = false) => {
    if (!silent) setLoadingCostFindings(true);
    try {
      const url = selectedFileId === 'all' 
        ? `${API_URL}/api/cost/findings` 
        : `${API_URL}/api/cost/findings/${selectedFileId}`;
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCostFindings(data);
      } else {
        console.error('Failed to fetch cost findings.');
      }
    } catch (err) {
      console.error('Network error fetching cost findings:', err);
    } finally {
      if (!silent) setLoadingCostFindings(false);
    }
  };

  const fetchAiInsights = async (silent = false) => {
    try {
      const response = await fetch(`${API_URL}/api/ai/insights`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAiInsights(data);
      }
    } catch (err) {
      console.error('Network error fetching AI insights:', err);
    }
  };

  const handleGenerateAI = async (findingId: number, findingType: 'security' | 'cost') => {
    const identifier = `${findingType}-${findingId}`;
    setGeneratingInsightId(identifier);
    try {
      const response = await fetch(`${API_URL}/api/ai/analyze/${findingId}?finding_type=${findingType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        triggerMessage('success', `AI ${findingType === 'security' ? 'Analysis' : 'Recommendation'} generated successfully.`);
        await fetchAiInsights();
        setActiveTab('ai-insights');
      } else {
        const errData = await response.json();
        triggerMessage('error', errData.detail || 'Failed to generate AI explanation.');
      }
    } catch (err) {
      triggerMessage('error', 'Network error generating AI response.');
      console.error(err);
    } finally {
      setGeneratingInsightId(null);
    }
  };

  const handleCopyCode = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(identifier);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle PDF report generation and download
  const handleDownloadReport = async (fileId: number, fileName: string) => {
    try {
      const response = await fetch(`${API_URL}/api/reports/download/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to generate PDF compliance report.');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      let safeName = fileName.replace(/\.[^/.]+$/, "");
      a.download = `infrasight_report_${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      triggerMessage('success', `PDF compliance report for '${fileName}' downloaded successfully.`);
    } catch (err) {
      triggerMessage('error', 'Failed to generate and download compliance PDF report.');
      console.error(err);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchFiles();
    fetchResources();
    fetchFindings();
    fetchCostFindings();
    fetchAiInsights();
  }, [token]);

  // Refetch resources, findings & cost findings whenever selected file filter changes
  useEffect(() => {
    fetchResources();
    fetchFindings();
    fetchCostFindings();
    fetchAiInsights();
    setCurrentPage(1); // Reset page on filter update
    setCostCurrentPage(1);
  }, [selectedFileId]);

  // Trigger temporary notification banner
  const triggerMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage(null);
    }, 6000);
  };

  // Drag-and-drop handlers
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
    const filename = file.name.toLowerCase();
    
    // Validate exact name or extensions
    const isValid = filename === 'terraform.tfstate' || filename.endsWith('.tfstate') || filename.endsWith('.json');

    if (!isValid) {
      triggerMessage('error', 'Invalid file. Only terraform.tfstate, .tfstate, or .json files are allowed.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      triggerMessage('error', 'File size exceeds 20MB limit.');
      return;
    }

    uploadFileRequest(file);
  };

  // Upload request with progress bar tracking
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
        triggerMessage('success', `File '${file.name}' parsed successfully.`);
        fetchFiles(true);
        fetchResources(true);
        fetchFindings(true);
        fetchCostFindings(true);
        fetchAiInsights(true);
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          triggerMessage('error', errData.detail || 'Upload and parsing failed.');
        } catch {
          triggerMessage('error', 'Upload failed. Check connection.');
        }
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      triggerMessage('error', 'Network error occurred during file upload.');
    };

    xhr.send(formData);
  };

  // Delete file action
  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete '${name}'? This will remove all its discovered resources.`)) return;
    
    try {
      const response = await fetch(`${API_URL}/api/files/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        triggerMessage('success', `Successfully deleted '${name}'`);
        // If the selected file was the one deleted, reset selected file filter
        if (selectedFileId === String(id)) {
          setSelectedFileId('all');
        } else {
          fetchFiles(true);
          fetchResources(true);
          fetchFindings(true);
          fetchCostFindings(true);
          fetchAiInsights(true);
        }
      } else {
        triggerMessage('error', 'Failed to delete file.');
      }
    } catch (err) {
      triggerMessage('error', 'Connection error while deleting file.');
    }
  };

  // Manual Refresh of all tables
  const handleRefreshAll = () => {
    fetchFiles();
    fetchResources();
    fetchFindings();
    fetchCostFindings();
    fetchAiInsights();
  };

  // Derived Filter Options
  const uniqueProviders = Array.from(new Set(resources.map(r => r.provider))).filter(Boolean);
  const uniqueTypes = Array.from(new Set(resources.map(r => r.resource_type))).filter(Boolean);

  // Filtered resources list
  const filteredResources = resources.filter(res => {
    // 1. Search Query filter (matches Name, Type, Region, Provider)
    const matchSearch = searchTerm === '' || 
      res.resource_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.provider.toLowerCase().includes(searchTerm.toLowerCase());
      
    // 2. Provider filter
    const matchProvider = selectedProvider === 'all' || res.provider === selectedProvider;
    
    // 3. Resource Type filter
    const matchType = selectedType === 'all' || res.resource_type === selectedType;

    return matchSearch && matchProvider && matchType;
  });

  // Filtered security findings list
  const filteredFindings = findings.filter(f => {
    const matchSearch = findingsSearchTerm === '' ||
      f.title.toLowerCase().includes(findingsSearchTerm.toLowerCase()) ||
      f.description.toLowerCase().includes(findingsSearchTerm.toLowerCase()) ||
      f.recommendation.toLowerCase().includes(findingsSearchTerm.toLowerCase()) ||
      f.resource_name.toLowerCase().includes(findingsSearchTerm.toLowerCase()) ||
      f.resource_type.toLowerCase().includes(findingsSearchTerm.toLowerCase());
      
    const matchSeverity = selectedSeverity === 'all' || f.severity === selectedSeverity;
    
    return matchSearch && matchSeverity;
  });

  // Filtered cost findings list
  const filteredCostFindings = costFindings.filter(f => {
    const matchSearch = costSearchTerm === '' ||
      f.title.toLowerCase().includes(costSearchTerm.toLowerCase()) ||
      f.description.toLowerCase().includes(costSearchTerm.toLowerCase()) ||
      f.recommendation.toLowerCase().includes(costSearchTerm.toLowerCase()) ||
      f.resource_name.toLowerCase().includes(costSearchTerm.toLowerCase()) ||
      f.resource_type.toLowerCase().includes(costSearchTerm.toLowerCase());
      
    return matchSearch;
  });

  // Potential Monthly Savings
  const potentialSavings = costFindings.reduce((acc, curr) => acc + (curr.estimated_monthly_cost || 0), 0);

  // Pagination bounds
  const totalItems = activeTab === 'inventory' ? filteredResources.length : filteredFindings.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  
  const costTotalItems = filteredCostFindings.length;
  const costTotalPages = Math.ceil(costTotalItems / itemsPerPage) || 1;

  const paginatedResources = filteredResources.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const paginatedFindings = filteredFindings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const paginatedCostFindings = filteredCostFindings.slice(
    (costCurrentPage - 1) * itemsPerPage,
    costCurrentPage * itemsPerPage
  );

  // Filtered AI Insights based on current findings in view
  const currentFindingIds = findings.map(f => f.id);
  const currentCostFindingIds = costFindings.map(f => f.id);

  const filteredAIInsights = aiInsights.filter(insight => {
    if (insight.finding_type === 'security') {
      return currentFindingIds.includes(insight.finding_id);
    } else if (insight.finding_type === 'cost') {
      return currentCostFindingIds.includes(insight.finding_id);
    }
    return false;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in relative z-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
            Terraform Analysis
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Upload your Terraform state files to automatically parse, catalog, audit, and estimate infrastructure optimization opportunities.
          </p>
        </div>
        <button 
          onClick={handleRefreshAll}
          className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-350 rounded-lg hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          title="Refresh Catalog"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingFiles || loadingResources || loadingFindings || loadingCostFindings ? 'animate-spin' : ''}`} />
          <span>Refresh Catalog</span>
        </button>
      </div>

      {/* Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Resources */}
        <div className="p-5 bg-slate-900/20 border border-white/5 rounded-2xl flex flex-col justify-between min-h-[100px] shadow-xl relative overflow-hidden">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Total Resources</span>
          <span className="text-2xl font-extrabold text-white mt-2 font-mono">
            {loadingResources ? "..." : resources.length}
          </span>
          <div className="absolute top-0 right-0 p-2 font-mono text-[30px] text-white/[0.01] pointer-events-none select-none font-bold">RESOURCES</div>
        </div>

        {/* Security Findings */}
        <div className="p-5 bg-slate-900/20 border border-white/5 rounded-2xl flex flex-col justify-between min-h-[100px] shadow-xl relative overflow-hidden">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Security Findings</span>
          <span className={`text-2xl font-extrabold mt-2 font-mono ${findings.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {loadingFindings ? "..." : findings.length}
          </span>
          <div className="absolute top-0 right-0 p-2 font-mono text-[30px] text-white/[0.01] pointer-events-none select-none font-bold">SECURITY</div>
        </div>

        {/* Cost Findings */}
        <div className="p-5 bg-slate-900/20 border border-white/5 rounded-2xl flex flex-col justify-between min-h-[100px] shadow-xl relative overflow-hidden">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Cost Findings</span>
          <span className={`text-2xl font-extrabold mt-2 font-mono ${costFindings.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {loadingCostFindings ? "..." : costFindings.length}
          </span>
          <div className="absolute top-0 right-0 p-2 font-mono text-[30px] text-white/[0.01] pointer-events-none select-none font-bold">COSTS</div>
        </div>

        {/* Potential Savings */}
        <div className="p-5 bg-slate-900/20 border border-white/5 rounded-2xl flex flex-col justify-between min-h-[100px] shadow-xl relative overflow-hidden">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Potential Savings</span>
          <span className={`text-2xl font-extrabold mt-2 font-mono ${potentialSavings > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {loadingCostFindings ? "..." : `$${potentialSavings.toFixed(2)}/mo`}
          </span>
          <div className="absolute top-0 right-0 p-2 font-mono text-[30px] text-white/[0.01] pointer-events-none select-none font-bold">SAVINGS</div>
        </div>
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

        {/* Drag & Drop File Upload Area */}
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
            accept=".tfstate,.json,terraform.tfstate" 
          />
          
          <div className={`p-4 rounded-xl mb-4 transition-transform group-hover:scale-110 ${
            dragOver ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/10'
          }`}>
            <UploadCloud className="h-8 w-8" />
          </div>

          <h3 className="text-sm font-bold text-slate-200">
            Drag & drop your Terraform state file here
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm leading-normal">
            Accepts <code className="text-slate-300">terraform.tfstate</code>, <code className="text-slate-300">.tfstate</code>, and <code className="text-slate-300">.json</code> formats (Max size: 20MB). Or click to browse.
          </p>

          {/* Progress bar overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 backdrop-blur-sm z-30 animate-fade-in">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-[10px] font-mono text-slate-450">
                  <span>Uploading state & discovering resources...</span>
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

      {/* Recent Uploads Section */}
      <div className="bg-slate-900/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-450 flex items-center gap-2">
            <FileCode className="h-4 w-4 text-indigo-400" />
            <span>Recent Uploaded State Files</span>
          </span>
          <span className="text-[10px] text-slate-550 font-mono">
            Total: {files.length}
          </span>
        </div>

        {loadingFiles ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-500">Retrieving state history...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-450 text-xs font-semibold">No Terraform files uploaded yet.</p>
            <p className="text-slate-600 text-[10px] max-w-xs mx-auto leading-normal mt-1">
              Upload your JSON tfstate files above to view them here and populate your inventory.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/40 text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                  <th className="py-3 px-6">File Name</th>
                  <th className="py-3 px-6">Type</th>
                  <th className="py-3 px-6">Upload Time</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-white/[0.01] transition-all text-xs text-slate-350">
                    <td className="py-3 px-6 font-semibold text-slate-200">
                      {file.file_name}
                    </td>
                    <td className="py-3 px-6 font-mono text-[10px] uppercase text-slate-450">
                      {file.file_type}
                    </td>
                    <td className="py-3 px-6 font-mono text-slate-500">
                      {new Date(file.upload_time).toLocaleString()}
                    </td>
                    <td className="py-3 px-6">
                      {file.status === 'parsed' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Parsed
                        </span>
                      ) : file.status === 'failed' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/10 text-blue-450 border border-blue-500/20">
                          {file.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-right flex items-center justify-end gap-2">
                      {file.status === 'parsed' && (
                        <button
                          onClick={() => handleDownloadReport(file.id, file.file_name)}
                          className="p-1.5 hover:bg-blue-500/10 border border-white/5 hover:border-blue-900/30 text-slate-400 hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
                          title="Download PDF Compliance Report"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(file.id, file.file_name)}
                        className="p-1.5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-900/30 text-slate-400 hover:text-rose-450 rounded-lg transition-colors cursor-pointer"
                        title="Delete File & Resources"
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

      {/* Resource / Findings Tabbed View */}
      <div className="bg-slate-900/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        
        {/* Header with Tabs and File Filter */}
        <div className="p-5 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActiveTab('inventory'); setCurrentPage(1); }}
              className={`flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer py-1.5 px-3 rounded-lg ${
                activeTab === 'inventory' 
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Cloud Inventory ({resources.length})</span>
            </button>
            
            <button
              onClick={() => { setActiveTab('findings'); setCurrentPage(1); setCostCurrentPage(1); }}
              className={`flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer py-1.5 px-3 rounded-lg ${
                activeTab === 'findings' 
                  ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Security & Cost Findings ({findings.length + costFindings.length})</span>
            </button>

            <button
              onClick={() => { setActiveTab('ai-insights'); setCurrentPage(1); }}
              className={`flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer py-1.5 px-3 rounded-lg ${
                activeTab === 'ai-insights' 
                  ? 'text-blue-450 bg-blue-500/10 border border-blue-500/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <span>AI Insights ({filteredAIInsights.length})</span>
            </button>
          </div>
          
          {/* File Filter Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Filter File:</span>
            <select
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-lg py-1 px-3.5 text-slate-300 text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Uploaded Files</option>
              {files.filter(f => f.status === 'parsed').map(f => (
                <option key={f.id} value={f.id}>{f.file_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Conditional Tab Rendering */}
        {activeTab === 'inventory' ? (
          <div>
            {/* Search and Filters Controls */}
            <div className="p-5 border-b border-white/5 bg-slate-950/20">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Search Input */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-slate-500" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search resources..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Provider Filter */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                  </span>
                  <select
                    value={selectedProvider}
                    onChange={(e) => {
                      setSelectedProvider(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs text-slate-300 focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Providers</option>
                    {uniqueProviders.map(p => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                {/* Resource Type Filter */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                  </span>
                  <select
                    value={selectedType}
                    onChange={(e) => {
                      setSelectedType(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs text-slate-300 focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Resource Types</option>
                    {uniqueTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {loadingResources ? (
              <div className="p-16 flex flex-col items-center justify-center gap-3">
                <div className="h-7 w-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-slate-500">Analyzing cloud schema...</span>
              </div>
            ) : totalItems === 0 ? (
              <div className="p-16 text-center space-y-2">
                <p className="text-slate-450 text-xs font-semibold">No resources discovered.</p>
                <p className="text-slate-600 text-[10px] max-w-sm mx-auto leading-normal">
                  Upload a state file containing cloud configuration items or adjust your active query filters.
                </p>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-slate-950/40 text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                        <th className="py-3 px-6">Resource Name</th>
                        <th className="py-3 px-6">Resource Type</th>
                        <th className="py-3 px-6">Provider</th>
                        <th className="py-3 px-6">Region</th>
                        <th className="py-3 px-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {paginatedResources.map((res) => (
                        <tr key={res.id} className="hover:bg-white/[0.01] transition-all text-xs text-slate-350">
                          <td className="py-3.5 px-6 font-semibold text-slate-200">
                            {res.resource_name}
                          </td>
                          <td className="py-3.5 px-6 font-mono text-[10px] text-slate-400">
                            {res.resource_type}
                          </td>
                          <td className="py-3.5 px-6 font-bold uppercase tracking-wider text-[10px] text-slate-500">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] ${
                              res.provider === 'aws' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                            }`}>
                              {res.provider}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 font-mono text-slate-450">
                            {res.region}
                          </td>
                          <td className="py-3.5 px-6">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                              res.status === 'Managed' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-405 border border-amber-500/20'
                            }`}>
                              {res.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Shared Pagination Controls */}
                {renderPaginationControls(currentPage, totalPages, setCurrentPage, totalItems)}
              </div>
            )}
          </div>
        ) : activeTab === 'findings' ? (
          /* Findings Tab View */
          <div className="divide-y divide-white/5">
            {/* Section 1: Security Findings */}
            <div>
              <div className="p-4 bg-slate-950/40 border-b border-white/5 flex justify-between items-center">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <span>Security Vulnerability Audit</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Issues: {filteredFindings.length}
                </span>
              </div>

              {/* Security Filters */}
              <div className="p-5 bg-slate-950/20 border-b border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-slate-500" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search security findings by title, description..."
                    value={findingsSearchTerm}
                    onChange={(e) => {
                      setFindingsSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                  />
                </div>

                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                  </span>
                  <select
                    value={selectedSeverity}
                    onChange={(e) => {
                      setSelectedSeverity(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs text-slate-300 focus:border-rose-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {loadingFindings ? (
                <div className="p-16 flex flex-col items-center justify-center gap-3">
                  <div className="h-7 w-7 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono text-slate-500">Running compliance audit...</span>
                </div>
              ) : filteredFindings.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-xl mb-2">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="text-slate-200 text-xs font-bold">No security vulnerabilities found.</p>
                  <p className="text-slate-500 text-[10px] max-w-sm mx-auto leading-normal">
                    Your uploaded configurations passed all integrated security rule reviews successfully.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-slate-950/40 text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                          <th className="py-3 px-6">Severity</th>
                          <th className="py-3 px-6">Vulnerability / Resource</th>
                          <th className="py-3 px-6">Description</th>
                          <th className="py-3 px-6">Remediation Recommendation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {paginatedFindings.map((finding) => (
                          <tr key={finding.id} className="hover:bg-white/[0.01] transition-all text-xs text-slate-350 align-top">
                            <td className="py-4 px-6 shrink-0">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                finding.severity === 'Critical' 
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' 
                                  : finding.severity === 'High' 
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' 
                                  : finding.severity === 'Medium' 
                                  ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/20' 
                                  : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                              }`}>
                                {finding.severity}
                              </span>
                            </td>
                            <td className="py-4 px-6 max-w-[200px]">
                              <div className="font-bold text-slate-200 leading-snug">{finding.title}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-1 select-all truncate" title={finding.resource_name}>
                                {finding.resource_name}
                              </div>
                              <div className="text-[8px] text-slate-600 font-mono uppercase tracking-wide mt-0.5">
                                Type: {finding.resource_type}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-slate-400 leading-relaxed max-w-[320px]">
                              {finding.description}
                            </td>
                            <td className="py-4 px-6 bg-white/[0.01] text-slate-300 leading-relaxed max-w-[320px]">
                              <div>
                                <span className="text-[9px] font-bold text-slate-450 block mb-1 uppercase tracking-widest font-mono">Action Item:</span>
                                {finding.recommendation}
                              </div>
                              <div className="mt-3">
                                <button
                                  onClick={() => handleGenerateAI(finding.id, 'security')}
                                  disabled={generatingInsightId !== null}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_10px_rgba(37,99,235,0.2)]"
                                >
                                  {generatingInsightId === `security-${finding.id}` ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                  <span>Generate AI Analysis</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {renderPaginationControls(currentPage, totalPages, setCurrentPage, totalItems)}
                </div>
              )}
            </div>

            {/* Section 2: Cost Optimization Findings */}
            <div>
              <div className="p-4 bg-slate-950/40 border-b border-white/5 flex justify-between items-center">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-450 text-emerald-450 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  <span>Cost Optimization Findings</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Opportunities: {filteredCostFindings.length}
                </span>
              </div>

              {/* Cost Filters */}
              <div className="p-5 bg-slate-950/20 border-b border-white/5 grid grid-cols-1 gap-4">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-slate-500" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search cost findings by name, type, issue..."
                    value={costSearchTerm}
                    onChange={(e) => {
                      setCostSearchTerm(e.target.value);
                      setCostCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {loadingCostFindings ? (
                <div className="p-16 flex flex-col items-center justify-center gap-3">
                  <div className="h-7 w-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono text-slate-500">Analyzing cost profiles...</span>
                </div>
              ) : filteredCostFindings.length === 0 ? (
                <div className="p-16 text-center space-y-2">
                  <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-xl mb-2">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="text-slate-200 text-xs font-bold">No cost optimization opportunities detected.</p>
                  <p className="text-slate-500 text-[10px] max-w-sm mx-auto leading-normal">
                    Your configurations passed all integrated cloud spending reviews successfully.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-slate-950/40 text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                          <th className="py-3 px-6">Resource</th>
                          <th className="py-3 px-6">Type</th>
                          <th className="py-3 px-6">Estimated Cost Impact</th>
                          <th className="py-3 px-6">Issue</th>
                          <th className="py-3 px-6">Recommendation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {paginatedCostFindings.map((finding) => (
                          <tr key={finding.id} className="hover:bg-white/[0.01] transition-all text-xs text-slate-350 align-top">
                            <td className="py-4 px-6 max-w-[200px] font-semibold text-slate-200">
                              {finding.resource_name}
                            </td>
                            <td className="py-4 px-6 font-mono text-[10px] text-slate-400">
                              {finding.resource_type}
                            </td>
                            <td className="py-4 px-6 shrink-0">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                -${finding.estimated_monthly_cost.toFixed(2)}/mo
                              </span>
                            </td>
                            <td className="py-4 px-6 text-slate-400 leading-relaxed max-w-[320px]">
                              <div className="font-bold text-slate-200 leading-snug">{finding.title}</div>
                              <div className="text-[10px] text-slate-550 font-mono mt-1">{finding.description}</div>
                            </td>
                            <td className="py-4 px-6 bg-white/[0.01] text-slate-350 leading-relaxed max-w-[320px]">
                              <div>{finding.recommendation}</div>
                              <div className="mt-3">
                                <button
                                  onClick={() => handleGenerateAI(finding.id, 'cost')}
                                  disabled={generatingInsightId !== null}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                                >
                                  {generatingInsightId === `cost-${finding.id}` ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                  <span>Generate AI Recommendation</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {renderPaginationControls(costCurrentPage, costTotalPages, setCostCurrentPage, costTotalItems)}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* AI Insights Tab View */
          <div className="p-6 space-y-6">
            {filteredAIInsights.length === 0 ? (
              <div className="p-16 text-center space-y-2">
                <p className="text-slate-450 text-xs font-semibold">No findings available for AI analysis.</p>
                <p className="text-slate-600 text-[10px] max-w-sm mx-auto leading-normal">
                  Go to the Security & Cost Findings tab and click "Generate AI Analysis" or "Generate AI Recommendation" to populate AI remediation guides.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredAIInsights.map((insight) => {
                  let title = "";
                  let severity = "";
                  let resourceName = "";
                  let resourceType = "";
                  
                  if (insight.finding_type === 'security') {
                    const orig = findings.find(f => f.id === insight.finding_id);
                    title = orig?.title || "Security Finding";
                    severity = orig?.severity || "Critical";
                    resourceName = orig?.resource_name || "";
                    resourceType = orig?.resource_type || "";
                  } else {
                    const orig = costFindings.find(f => f.id === insight.finding_id);
                    title = orig?.title || "Cost Finding";
                    severity = "Cost";
                    resourceName = orig?.resource_name || "";
                    resourceType = orig?.resource_type || "";
                  }

                  const response = insight.response || {};
                  
                  const explanation = response.issue_summary 
                    ? `${response.issue_summary}\n\n${response.why_this_matters || response.attack_surface_explanation || ''}`
                    : `${response.cost_concern || response.cost_waste_explanation || ''}`;
                    
                  const businessImpact = response.business_impact || response.estimated_impact || response.estimated_monthly_savings || '';
                  const recommendedFix = response.recommended_fix || response.optimization_suggestion || response.cleanup_recommendation || '';
                  const terraformSnippet = response.terraform_example || response.terraform_fix || response.alternative_resource_recommendation || '';
                  const bestPractice = response.best_practice || '';

                  return (
                    <div key={insight.id} className="p-6 bg-slate-900/40 border border-white/5 rounded-2xl space-y-6 shadow-xl relative overflow-hidden">
                      {/* Card Header */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              insight.finding_type === 'security'
                                ? severity === 'Critical' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                                  : severity === 'High' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                  : 'bg-yellow-500/15 text-yellow-355 border border-yellow-500/20'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {insight.finding_type === 'security' ? `Security: ${severity}` : 'Cost Optimization'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">Resource: {resourceName}</span>
                          </div>
                          <h4 className="text-sm font-extrabold text-white mt-1.5">{title}</h4>
                        </div>
                        <span className="text-[9px] text-slate-550 font-mono">Generated: {new Date(insight.created_at).toLocaleDateString()}</span>
                      </div>

                      {/* Card Body Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-350">
                        <div className="space-y-4">
                          <div>
                            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono block mb-1">AI Explanation</span>
                            <p className="leading-relaxed whitespace-pre-line text-slate-400">{explanation}</p>
                          </div>
                          
                          {businessImpact && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono block mb-1">Business Impact</span>
                              <p className="leading-relaxed text-slate-400">{businessImpact}</p>
                            </div>
                          )}

                          {recommendedFix && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono block mb-1">Recommended Fix</span>
                              <p className="leading-relaxed text-slate-400">{recommendedFix}</p>
                            </div>
                          )}

                          {bestPractice && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-455 uppercase tracking-widest font-mono block mb-1">Best Practice</span>
                              <p className="leading-relaxed text-slate-400">{bestPractice}</p>
                            </div>
                          )}
                        </div>

                        {/* Right Column: Code Snippet */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono block mb-1.5">Remediation Snippet / Proposal</span>
                          {terraformSnippet ? (
                            <div className="flex-1 bg-slate-950 border border-white/5 rounded-xl p-4 font-mono text-[10px] text-slate-300 relative group overflow-x-auto min-h-[160px] flex flex-col justify-between">
                              <pre className="whitespace-pre overflow-x-auto pr-8">{terraformSnippet}</pre>
                              <button
                                onClick={() => handleCopyCode(terraformSnippet, `copy-${insight.id}`)}
                                className="absolute top-2 right-2 p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-450 hover:text-white transition-all cursor-pointer"
                                title="Copy snippet to clipboard"
                              >
                                {copiedId === `copy-${insight.id}` ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 bg-slate-950/40 border border-dashed border-white/5 rounded-xl flex items-center justify-center text-slate-500 font-mono text-[10px] min-h-[160px]">
                              No code snippet required for this remediation.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render pagination control blocks helper
  function renderPaginationControls(
    currPage: number,
    totalPgs: number,
    setPage: React.Dispatch<React.SetStateAction<number>>,
    totalCount: number
  ) {
    return (
      <div className="p-4 border-t border-white/5 bg-slate-950/20 flex items-center justify-between">
        <span className="text-[10px] text-slate-550 font-mono">
          Showing {totalCount === 0 ? 0 : (currPage - 1) * itemsPerPage + 1} to {Math.min(currPage * itemsPerPage, totalCount)} of {totalCount} items
        </span>
        
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
            disabled={currPage === 1}
            className="p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-slate-400 font-mono font-semibold px-2">
            Page {currPage} of {totalPgs}
          </span>
          <button
            onClick={() => setPage(prev => Math.min(prev + 1, totalPgs))}
            disabled={currPage === totalPgs}
            className="p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }
}
