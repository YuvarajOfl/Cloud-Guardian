import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Layers, 
  ShieldAlert, 
  Coins, 
  FileCode, 
  HelpCircle,
  Database,
  Lock,
  ChevronDown,
  Sparkles,
  Info,
  CheckCircle2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface TerraformFile {
  id: number;
  file_name: string;
  file_type: string;
  upload_time: string;
  status: string;
}

interface TerraformResource {
  id: number;
  resource_type: string;
  resource_name: string;
  provider: string;
  region: string;
  resource_metadata: any;
  status: string;
}

interface SecurityFinding {
  id: number;
  resource_name: string;
  resource_type: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
}

interface CostFinding {
  id: number;
  resource_name: string;
  resource_type: string;
  estimated_monthly_cost: number;
  title: string;
  description: string;
  recommendation: string;
}

export function InfrastructureAnalysis() {
  const { token } = useAuth();
  
  const [files, setFiles] = useState<TerraformFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<number | ''>('');
  
  // Selection contents
  const [resources, setResources] = useState<TerraformResource[]>([]);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [costFindings, setCostFindings] = useState<CostFinding[]>([]);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);

  // AI Follow-up states
  const [questions, setQuestions] = useState<{ [findingId: number]: string }>({});
  const [answers, setAnswers] = useState<{ [findingId: number]: { answer: string; source: string; mode?: string } }>({});
  const [askingId, setAskingId] = useState<number | null>(null);
  const [aiError, setAiError] = useState<{ [findingId: number]: string }>({});

  const handleAskAI = async (findingId: number, resourceType: string, severity: string) => {
    const question = questions[findingId]?.trim();
    if (!question) return;

    setAskingId(findingId);
    setAiError(prev => ({ ...prev, [findingId]: '' }));

    try {
      const response = await fetch(`${API_URL}/api/ai/ask`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          finding_id: findingId,
          resource: resourceType,
          severity: severity,
          question: question
        })
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve answer from AI Advisor.');
      }

      const data = await response.json();
      setAnswers(prev => ({
        ...prev,
        [findingId]: {
          answer: data.answer,
          source: data.source,
          mode: data.mode
        }
      }));
    } catch (err: any) {
      console.error(err);
      setAiError(prev => ({ ...prev, [findingId]: err.message || 'An error occurred while calling the AI Advisor.' }));
    } finally {
      setAskingId(null);
    }
  };


  // Fetch all files for selection dropdown
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch(`${API_URL}/api/files`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          const parsedFiles = data.filter((f: any) => f.status === 'parsed');
          setFiles(parsedFiles);
          if (parsedFiles.length > 0) {
            setSelectedFileId(parsedFiles[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load files", err);
      } finally {
        setLoadingFiles(false);
      }
    };

    if (token) {
      fetchFiles();
    }
  }, [token]);

  // Fetch data for selected file
  useEffect(() => {
    if (!selectedFileId) {
      setResources([]);
      setFindings([]);
      setCostFindings([]);
      return;
    }

    const fetchAnalysisData = async () => {
      setLoading(true);
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Fetch resources
        const resResponse = await fetch(`${API_URL}/api/resources/${selectedFileId}`, { headers });
        const resData = resResponse.ok ? await resResponse.json() : [];
        setResources(resData);

        // Fetch security findings
        const secResponse = await fetch(`${API_URL}/api/findings/${selectedFileId}`, { headers });
        const secData = secResponse.ok ? await secResponse.json() : [];
        setFindings(secData);

        // Fetch cost findings
        const costResponse = await fetch(`${API_URL}/api/cost/findings/${selectedFileId}`, { headers });
        const costData = costResponse.ok ? await costResponse.json() : [];
        setCostFindings(costData);

      } catch (err) {
        console.error("Error loading analysis data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, [selectedFileId, token]);

  // Group resources by type/category
  const groupResources = () => {
    const categories: { [key: string]: TerraformResource[] } = {
      'AWS Security Groups': [],
      'EC2 Instances': [],
      'S3 Buckets': [],
      'RDS Databases': [],
      'IAM Resources': [],
      'Other Resources': []
    };

    resources.forEach(res => {
      const type = res.resource_type.toLowerCase();
      if (type.includes('security_group')) {
        categories['AWS Security Groups'].push(res);
      } else if (type.includes('instance') && !type.includes('db')) {
        categories['EC2 Instances'].push(res);
      } else if (type.includes('s3_bucket')) {
        categories['S3 Buckets'].push(res);
      } else if (type.includes('db_instance') || type.includes('rds') || type.includes('database')) {
        categories['RDS Databases'].push(res);
      } else if (type.includes('iam_')) {
        categories['IAM Resources'].push(res);
      } else {
        categories['Other Resources'].push(res);
      }
    });

    return categories;
  };

  const selectedFile = files.find(f => f.id === selectedFileId);
  const isHcl = selectedFile?.file_type === 'tf' || selectedFile?.file_type === 'tfvars';
  const grouped = groupResources();

  // Severity count calculators
  const critCount = findings.filter(f => f.severity === 'Critical').length;
  const highCount = findings.filter(f => f.severity === 'High').length;
  const medCount = findings.filter(f => f.severity === 'Medium').length;
  const lowCount = findings.filter(f => f.severity === 'Low').length;

  // Potential savings estimator
  const totalSavings = costFindings.reduce((acc, curr) => acc + curr.estimated_monthly_cost, 0);

  if (loadingFiles) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-slate-550">Loading infrastructure data...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center p-16 bg-slate-900/20 border border-white/5 rounded-2xl shadow-xl mt-12 relative z-10">
        <div className="p-4 bg-white/5 rounded-full inline-block text-slate-500 mb-4">
          <Layers className="h-6 w-6 animate-pulse" />
        </div>
        <p className="text-slate-350 text-sm font-bold">No infrastructure analysis available.</p>
        <p className="text-slate-550 text-xs mt-1 leading-normal max-w-sm mx-auto">
          Please upload and parse a Terraform state file in the 'Terraform Files' tab before executing analysis reports.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in relative z-10">
      
      {/* File Selector Selector */}
      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shadow-xl">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Infrastructure Analysis Workspace</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Select a scanned Terraform configuration file to display resources, safety audits, and cost savings.</p>
        </div>
        
        <div className="relative">
          <select 
            value={selectedFileId}
            onChange={(e) => setSelectedFileId(Number(e.target.value))}
            className="w-full md:w-72 pl-4 pr-10 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer appearance-none font-semibold"
          >
            {files.map(f => (
              <option key={f.id} value={f.id}>{f.file_name}</option>
            ))}
          </select>
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      </div>

      {/* Workspace Details Panel */}
      {selectedFile && (
        <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
            <div className="p-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg">
              <Info className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider font-mono">Workspace Analysis Details</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">Analysis Source</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold font-mono border ${
                isHcl 
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                <span>{isHcl ? '📂 Terraform Source Code' : '📄 Terraform State File'}</span>
              </span>
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">Analysis Type</span>
              <span className="text-slate-300 font-semibold">
                {isHcl ? 'Workspace-wide (All HCL Files)' : 'File-specific'}
              </span>
            </div>
          </div>

          {isHcl && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">Files in Workspace</span>
              <div className="flex flex-wrap gap-2">
                {files
                  .filter(f => f.file_type === 'tf' || f.file_type === 'tfvars')
                  .map(f => (
                    <span 
                      key={f.id} 
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                        f.id === selectedFileId 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold' 
                          : 'bg-slate-950 border-white/5 text-slate-400'
                      }`}
                    >
                      <FileCode className="h-3 w-3" />
                      <span>{f.file_name}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-550">Executing state compliance check...</span>
        </div>
      ) : (
        <div className="space-y-12">
          
          {/* Section 1: Infrastructure Inventory */}
          <section className="space-y-4 bg-slate-900/10 border border-white/5 rounded-2xl p-6 shadow-md">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                <Layers className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Section 1: Infrastructure Inventory</h3>
                <p className="text-[11px] text-slate-400">Total discovered resources: <b>{resources.length}</b>. Grouped by service modules.</p>
              </div>
            </div>

            {resources.length === 0 ? (
              <p className="text-slate-500 text-xs italic py-4 text-center">No managed cloud resources discovered in this file.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                {Object.entries(grouped).map(([category, items]) => {
                  if (items.length === 0) return null;
                  return (
                    <div key={category} className="bg-slate-950/40 border border-white/5 rounded-xl p-4 space-y-3 shadow-inner">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">{category}</span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full">
                          {items.length} Resource(s)
                        </span>
                      </div>
                      
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                        {items.map(item => (
                          <div key={item.id} className="flex justify-between items-center gap-4 p-1.5 hover:bg-white/[0.02] rounded transition-colors text-slate-400">
                            <span className="truncate font-semibold text-slate-300" title={item.resource_name}>
                              {item.resource_name}
                            </span>
                            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest shrink-0">
                              {item.region}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 2: Security Findings */}
          <section className="space-y-4 bg-slate-900/10 border border-white/5 rounded-2xl p-6 shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-500/10 text-rose-450 border border-rose-500/20 rounded-lg">
                  <ShieldAlert className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Section 2: Security Findings & Audits</h3>
                  <p className="text-[11px] text-slate-400">Scans vulnerabilities in HCL network subnets and identity configurations.</p>
                </div>
              </div>
              
              {/* Severity Summary counters */}
              <div className="flex gap-2 text-[10px] font-bold font-mono">
                <span className="px-2 py-0.5 bg-rose-950/45 border border-rose-500/20 text-rose-400 rounded">CRITICAL: {critCount}</span>
                <span className="px-2 py-0.5 bg-orange-950/45 border border-orange-500/20 text-orange-400 rounded">HIGH: {highCount}</span>
                <span className="px-2 py-0.5 bg-yellow-950/45 border border-yellow-500/20 text-yellow-400 rounded">MEDIUM: {medCount}</span>
                <span className="px-2 py-0.5 bg-blue-950/45 border border-blue-500/20 text-blue-400 rounded">LOW: {lowCount}</span>
              </div>
            </div>

            {findings.length === 0 ? (
              <div className="p-6 text-center text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex flex-col items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <span className="text-xs font-bold font-mono">No security configurations violations detected!</span>
              </div>
            ) : (
              <div className="space-y-3.5 pt-2">
                {findings.map(finding => (
                  <div key={finding.id} className="bg-slate-950/40 border border-white/5 hover:border-slate-800 transition-all rounded-xl p-4.5 space-y-3 shadow-inner">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-200 font-mono leading-tight flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            finding.severity === 'Critical' ? 'bg-rose-550 bg-rose-500' :
                            finding.severity === 'High' ? 'bg-orange-550 bg-orange-500' :
                            finding.severity === 'Medium' ? 'bg-amber-550 bg-amber-500' :
                            'bg-blue-550 bg-blue-500'
                          }`} />
                          {finding.title}
                        </span>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2 font-semibold">
                          <span>Resource: <code className="text-slate-400">{finding.resource_name}</code></span>
                          <span>|</span>
                          <span>Type: <code className="text-slate-400">{finding.resource_type}</code></span>
                        </div>
                      </div>
                      
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold font-mono tracking-wider uppercase border shrink-0 ${
                        finding.severity === 'Critical' 
                          ? 'bg-rose-500/10 border-rose-500/25 text-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]' 
                          : finding.severity === 'High' 
                          ? 'bg-orange-500/10 border-orange-500/25 text-orange-400' 
                          : finding.severity === 'Medium' 
                          ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' 
                          : 'bg-blue-500/10 border-blue-500/25 text-blue-400'
                      }`}>
                        {finding.severity}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] border-t border-white/5 pt-3 leading-relaxed">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Issue Description</span>
                        <p className="text-slate-400 mt-1">{finding.description}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Remediation Action</span>
                        <p className="text-slate-400 mt-1">{finding.recommendation}</p>
                      </div>
                    </div>

                    {/* Ask AI Section */}
                    <div className="border-t border-white/5 pt-4 mt-3.5 space-y-3">
                      <div className="flex items-center gap-1.5 text-slate-350">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="text-xs font-bold font-mono uppercase tracking-wider">Ask AI About This Finding</span>
                      </div>
                      
                      {/* Examples suggestions */}
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {[
                          "Why is this dangerous?",
                          "Show production Terraform fix",
                          "Explain this for a junior engineer",
                          "Give AWS best practices",
                          "What is the business impact?",
                          "How would an auditor view this?"
                        ].map((ex) => (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => setQuestions(prev => ({ ...prev, [finding.id]: ex }))}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 hover:text-white rounded border border-white/5 transition-all text-left text-slate-400 cursor-pointer font-medium"
                          >
                            {ex}
                          </button>
                        ))}
                      </div>

                      {/* Input and Submit Button */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={questions[finding.id] || ""}
                          onChange={(e) => setQuestions(prev => ({ ...prev, [finding.id]: e.target.value }))}
                          placeholder="Ask a question about this finding..."
                          className="flex-1 px-3 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => handleAskAI(finding.id, finding.resource_type, finding.severity)}
                          disabled={askingId === finding.id || !(questions[finding.id]?.trim())}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg text-white font-bold text-xs transition-colors cursor-pointer"
                        >
                          {askingId === finding.id ? "Analyzing..." : "Ask AI"}
                        </button>
                      </div>

                      {/* AI Error Display */}
                      {aiError[finding.id] && (
                        <p className="text-[10px] text-rose-450 font-semibold">{aiError[finding.id]}</p>
                      )}

                      {/* AI Response Card */}
                      {answers[finding.id] && (
                        <div className="bg-slate-950/60 border border-white/5 rounded-xl p-4.5 space-y-2.5 mt-3.5 animate-fade-in text-left">
                          <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400">AI Response</span>
                             <div className="flex gap-2 items-center">
                               {answers[finding.id].mode && (
                                 answers[finding.id].mode === 'general' ? (
                                   <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold font-mono border bg-teal-500/10 border-teal-500/20 text-teal-400">
                                     <span>🌍 General AI Mode</span>
                                   </span>
                                 ) : (
                                   <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold font-mono border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
                                     <span>🔒 Finding Analysis Mode</span>
                                   </span>
                                 )
                               )}
                               <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold font-mono border ${
                                 answers[finding.id].source === 'gemini' 
                                   ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                   : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                               }`}>
                                 <span>
                                   {answers[finding.id].source === 'gemini' ? '🟢 Live Gemini AI' : '🟡 Cached Knowledge Base'}
                                 </span>
                               </span>
                             </div>
                          </div>
                          
                          <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {/* Format HCL code blocks if present */}
                            {answers[finding.id].answer.split("```").map((part, index) => {
                              if (index % 2 === 1) {
                                const lines = part.split("\n");
                                const codeLines = lines[0].trim() === "hcl" || lines[0].trim() === "terraform" || lines[0].trim() === "json" ? lines.slice(1) : lines;
                                const codeString = codeLines.join("\n").trim();
                                return (
                                  <div key={index} className="my-2 select-all font-mono text-[10px] bg-slate-950 p-4 border border-white/10 rounded-xl text-indigo-300 leading-normal overflow-x-auto relative">
                                    <pre>{codeString}</pre>
                                  </div>
                                );
                              }
                              return <span key={index}>{part}</span>;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 3: Cost Optimization */}
          <section className="space-y-4 bg-slate-900/10 border border-white/5 rounded-2xl p-6 shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 rounded-lg">
                  <Coins className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Section 3: Cost Optimization & Savings</h3>
                  <p className="text-[11px] text-slate-400">Discovers idle servers, overprovisioned resources, and unattached disks.</p>
                </div>
              </div>
              
              {/* Total savings counter */}
              <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-right shrink-0 flex items-center gap-2.5">
                <div className="text-left">
                  <span className="text-[8px] uppercase tracking-wider font-bold text-emerald-400 block font-mono">Est. Monthly Savings</span>
                  <span className="text-base font-extrabold text-emerald-300 tracking-tight font-mono">${totalSavings.toFixed(2)}/mo</span>
                </div>
              </div>
            </div>

            {costFindings.length === 0 ? (
              <div className="p-6 text-center text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex flex-col items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <span className="text-xs font-bold font-mono">No cost optimization or waste opportunities detected.</span>
              </div>
            ) : (
              <div className="space-y-3.5 pt-2">
                {costFindings.map(finding => (
                  <div key={finding.id} className="bg-slate-950/40 border border-white/5 hover:border-slate-800 transition-all rounded-xl p-4.5 space-y-3 shadow-inner">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-200 font-mono leading-tight block">
                          {finding.title}
                        </span>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2 font-semibold">
                          <span>Resource: <code className="text-slate-400">{finding.resource_name}</code></span>
                          <span>|</span>
                          <span>Type: <code className="text-slate-400">{finding.resource_type}</code></span>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block font-mono">Waste</span>
                        <span className="text-xs font-bold text-rose-400 font-mono">-${finding.estimated_monthly_cost.toFixed(2)}/mo</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] border-t border-white/5 pt-3 leading-relaxed">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Optimization Reason</span>
                        <p className="text-slate-400 mt-1">{finding.description}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Recommended Adjustment</span>
                        <p className="text-slate-400 mt-1">{finding.recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      )}

    </div>
  );
}
