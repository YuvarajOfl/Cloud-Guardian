import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Sparkles, 
  ChevronDown, 
  Cpu, 
  Lock, 
  HelpCircle, 
  Copy, 
  Check, 
  ShieldAlert, 
  Coins, 
  CheckCircle,
  Database,
  ArrowRight
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface TerraformFile {
  id: number;
  file_name: string;
  file_type: string;
  upload_time: string;
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

interface AIInsight {
  id: number;
  finding_id: number;
  finding_type: 'security' | 'cost';
  prompt: string;
  response: any;
  created_at: string;
}

export function AIAdvisor() {
  const { token } = useAuth();
  
  const [files, setFiles] = useState<TerraformFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<number | ''>('');
  
  // Findings
  const [securityFindings, setSecurityFindings] = useState<SecurityFinding[]>([]);
  const [costFindings, setCostFindings] = useState<CostFinding[]>([]);
  
  // AI Insights map keyed by "finding_type-finding_id"
  const [insights, setInsights] = useState<{ [key: string]: AIInsight }>({});
  
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const fetchAnalysisAndInsights = async () => {
    if (!selectedFileId) return;
    setLoadingData(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Fetch findings
      const secResponse = await fetch(`${API_URL}/api/findings/${selectedFileId}`, { headers });
      const secData = secResponse.ok ? await secResponse.json() : [];
      setSecurityFindings(secData);

      const costResponse = await fetch(`${API_URL}/api/cost/findings/${selectedFileId}`, { headers });
      const costData = costResponse.ok ? await costResponse.json() : [];
      setCostFindings(costData);

      // Fetch all cached user insights
      const insightsResponse = await fetch(`${API_URL}/api/ai/insights`, { headers });
      if (insightsResponse.ok) {
        const insightsData: AIInsight[] = await insightsResponse.json();
        const map: { [key: string]: AIInsight } = {};
        insightsData.forEach(ins => {
          map[`${ins.finding_type}-${ins.finding_id}`] = ins;
        });
        setInsights(map);
      }
    } catch (err) {
      console.error("Error loading advisor data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchFiles();
    }
  }, [token]);

  useEffect(() => {
    fetchAnalysisAndInsights();
  }, [selectedFileId, token]);

  const handleGenerateInsight = async (findingId: number, type: 'security' | 'cost') => {
    const key = `${type}-${findingId}`;
    setGeneratingId(key);
    try {
      const response = await fetch(`${API_URL}/api/ai/analyze/${findingId}?finding_type=${type}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const newInsight: AIInsight = await response.json();
        setInsights(prev => ({
          ...prev,
          [key]: newInsight
        }));
      }
    } catch (err) {
      console.error("Failed to generate AI insight:", err);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleCopyCode = (code: string, idStr: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(idStr);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  if (loadingFiles) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-slate-550">Loading AI workspace...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center p-16 bg-slate-900/20 border border-white/5 rounded-2xl shadow-xl mt-12 relative z-10">
        <div className="p-4 bg-white/5 rounded-full inline-block text-slate-500 mb-4">
          <Sparkles className="h-6 w-6 animate-pulse" />
        </div>
        <p className="text-slate-350 text-sm font-bold">No AI recommendations generated yet.</p>
        <p className="text-slate-550 text-xs mt-1 leading-normal max-w-sm mx-auto">
          Please upload a Terraform file and let the system run the scanner before retrieving Gemini compliance advisor recommendations.
        </p>
      </div>
    );
  }

  const hasFindings = securityFindings.length > 0 || costFindings.length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in relative z-10">
      
      {/* Selector Control */}
      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-md-center gap-4 shadow-xl">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-teal-400" />
            <span>Gemini AI Remediation Advisor</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Generate technical breakdowns, security impact summaries, and copyable Terraform remediation code blocks.</p>
        </div>
        
        <div className="relative">
          <select 
            value={selectedFileId}
            onChange={(e) => setSelectedFileId(Number(e.target.value))}
            className="w-full md:w-72 pl-4 pr-10 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none font-semibold"
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

      {loadingData ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-550">Fetching scanned configurations...</span>
        </div>
      ) : !hasFindings ? (
        <div className="p-16 text-center bg-slate-900/20 border border-white/5 rounded-2xl max-w-lg mx-auto">
          <div className="p-3 bg-white/5 rounded-xl inline-block text-emerald-450 mb-3">
            <CheckCircle className="h-5 w-5" />
          </div>
          <p className="text-slate-350 text-sm font-bold">Upload and analyze a Terraform file to generate AI recommendations.</p>
          <p className="text-slate-650 text-xs mt-1">
            This configuration file is completely compliant with no security vulnerabilities or cost optimization alerts.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Security Recommendations List */}
          {securityFindings.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-450 font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                <span>Security AI Advisor</span>
              </h3>
              
              <div className="space-y-4">
                {securityFindings.map(finding => {
                  const insKey = `security-${finding.id}`;
                  const insight = insights[insKey];
                  const generating = generatingId === insKey;
                  
                  return (
                    <div key={finding.id} className="bg-slate-900/20 border border-white/5 rounded-2xl overflow-hidden shadow-md">
                      
                      {/* Finding summary header */}
                      <div className="p-4 bg-slate-950/40 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="space-y-0.5 text-left">
                          <span className="text-xs font-bold text-slate-200 block">{finding.title}</span>
                          <span className="text-[10px] text-slate-500 font-mono">Resource: <code className="text-slate-400">{finding.resource_name}</code></span>
                        </div>

                        {insight ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold font-mono border ${
                            insight.response?.source === 'gemini'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          } uppercase`}>
                            {insight.response?.source === 'gemini' ? (
                              <span>🟢 Live Gemini AI</span>
                            ) : (
                              <span>🟡 Cached Knowledge Base</span>
                            )}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleGenerateInsight(finding.id, 'security')}
                            disabled={generating}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-indigo-950 disabled:to-slate-900 disabled:cursor-not-allowed text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            {generating ? (
                              <>
                                <div className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin" />
                                <span>Remediating...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3" />
                                <span>Remediate with Gemini AI</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* AI Response details */}
                      {insight ? (
                        <div className="p-5 space-y-5 text-xs text-slate-355 leading-relaxed">
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-relaxed">
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Issue Summary</span>
                              <p className="text-slate-300 font-medium">{insight.response.issue_summary}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Why This Matters (Risk)</span>
                              <p className="text-slate-300">{insight.response.why_this_matters}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-relaxed border-t border-white/5 pt-4">
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Business Impact</span>
                              <p className="text-slate-300">{insight.response.business_impact}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Recommended Fix</span>
                              <p className="text-slate-300">{insight.response.recommended_fix}</p>
                            </div>
                          </div>

                          {/* Code Example block */}
                          {insight.response.terraform_example && (
                            <div className="space-y-1.5 border-t border-white/5 pt-4">
                              <div className="flex justify-between items-center text-[9px] uppercase font-bold text-slate-500 font-mono">
                                <span>Terraform HCL Example Fix</span>
                                <button
                                  onClick={() => handleCopyCode(insight.response.terraform_example, insKey)}
                                  className="flex items-center gap-1 text-[9px] hover:text-white transition-colors py-0.5 px-1.5 bg-white/5 rounded"
                                >
                                  {copiedId === insKey ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-450" />
                                      <span className="text-emerald-450 font-semibold font-mono">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span>Copy Code</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="p-4 bg-slate-950 border border-white/10 rounded-xl font-mono text-[10px] text-indigo-300 overflow-x-auto select-all leading-normal">
                                {insight.response.terraform_example}
                              </pre>
                            </div>
                          )}

                          <div className="bg-slate-950/40 p-3.5 border border-white/5 rounded-xl text-slate-400">
                            <span className="text-[9px] uppercase font-bold text-indigo-400 block font-mono">Best Practice</span>
                            <p className="mt-1">{insight.response.best_practice}</p>
                          </div>

                          {/* Ask AI Section */}
                          <div className="border-t border-white/5 pt-4 mt-3.5 space-y-3 text-left">
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
                              <p className="text-[10px] text-rose-455 font-semibold">{aiError[finding.id]}</p>
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
                      ) : (
                        <div className="p-8 text-center text-slate-500 text-xs italic">
                          Remediation breakdown not generated yet. Click the advisor button to consult Gemini AI.
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cost Recommendations List */}
          {costFindings.length > 0 && (
            <div className="space-y-4 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-455 font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
                <Coins className="h-4.5 w-4.5 text-emerald-400" />
                <span>Cost AI Advisor</span>
              </h3>
              
              <div className="space-y-4">
                {costFindings.map(finding => {
                  const insKey = `cost-${finding.id}`;
                  const insight = insights[insKey];
                  const generating = generatingId === insKey;
                  
                  return (
                    <div key={finding.id} className="bg-slate-900/20 border border-white/5 rounded-2xl overflow-hidden shadow-md">
                      
                      {/* Finding summary header */}
                      <div className="p-4 bg-slate-950/40 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="space-y-0.5 text-left">
                          <span className="text-xs font-bold text-slate-200 block">{finding.title}</span>
                          <span className="text-[10px] text-slate-500 font-mono">Resource: <code className="text-slate-400">{finding.resource_name}</code></span>
                        </div>

                        {insight ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold font-mono border ${
                            insight.response?.source === 'gemini'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          } uppercase`}>
                            {insight.response?.source === 'gemini' ? (
                              <span>🟢 Live Gemini AI</span>
                            ) : (
                              <span>🟡 Cached Knowledge Base</span>
                            )}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleGenerateInsight(finding.id, 'cost')}
                            disabled={generating}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-indigo-950 disabled:to-slate-900 disabled:cursor-not-allowed text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            {generating ? (
                              <>
                                <div className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin" />
                                <span>Remediating...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3" />
                                <span>Remediate with Gemini AI</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* AI Response details */}
                      {insight ? (
                        <div className="p-5 space-y-5 text-xs text-slate-355 leading-relaxed">
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-relaxed">
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Cost Concern</span>
                              <p className="text-slate-300 font-medium">{insight.response.cost_concern}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Financial Impact</span>
                              <p className="text-slate-300">{insight.response.estimated_impact}</p>
                            </div>
                          </div>

                          <div className="space-y-1 leading-relaxed border-t border-white/5 pt-4">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block font-mono">Optimization Suggestion</span>
                            <p className="text-slate-300">{insight.response.optimization_suggestion}</p>
                          </div>

                          {/* Code Example block */}
                          {insight.response.alternative_resource_recommendation && (
                            <div className="space-y-1.5 border-t border-white/5 pt-4">
                              <div className="flex justify-between items-center text-[9px] uppercase font-bold text-slate-500 font-mono">
                                <span>Optimized HCL Configuration</span>
                                <button
                                  onClick={() => handleCopyCode(insight.response.alternative_resource_recommendation, insKey)}
                                  className="flex items-center gap-1 text-[9px] hover:text-white transition-colors py-0.5 px-1.5 bg-white/5 rounded"
                                >
                                  {copiedId === insKey ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-450" />
                                      <span className="text-emerald-450 font-semibold font-mono">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span>Copy Code</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="p-4 bg-slate-950 border border-white/10 rounded-xl font-mono text-[10px] text-emerald-400 overflow-x-auto select-all leading-normal">
                                {insight.response.alternative_resource_recommendation}
                              </pre>
                            </div>
                          )}

                          <div className="bg-slate-950/40 p-3.5 border border-white/5 rounded-xl text-slate-400">
                            <span className="text-[9px] uppercase font-bold text-indigo-400 block font-mono">Best Practice</span>
                            <p className="mt-1">{insight.response.best_practice}</p>
                          </div>

                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-500 text-xs italic">
                          Remediation breakdown not generated yet. Click the advisor button to consult Gemini AI.
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
