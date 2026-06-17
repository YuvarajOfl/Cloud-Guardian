import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User as UserIcon, 
  ShieldAlert, 
  GitCompare, 
  FileText, 
  FileCode,
  UserCheck,
  Coins
} from 'lucide-react';

export function DashboardOverview() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [filesCount, setFilesCount] = useState<number>(0);
  const [findingsCount, setFindingsCount] = useState<number>(0);
  const [costFindingsCount, setCostFindingsCount] = useState<number>(0);
  const [potentialSavings, setPotentialSavings] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Fetch files count
        const filesRes = await fetch(`${API_URL}/api/files`, { headers });
        if (filesRes.ok) {
          const filesData = await filesRes.json();
          setFilesCount(filesData.length);
        }
        
        // Fetch findings count
        const findingsRes = await fetch(`${API_URL}/api/findings`, { headers });
        if (findingsRes.ok) {
          const findingsData = await findingsRes.json();
          setFindingsCount(findingsData.length);
        }
        
        // Fetch cost findings count
        const costRes = await fetch(`${API_URL}/api/cost/findings`, { headers });
        if (costRes.ok) {
          const costData = await costRes.json();
          setCostFindingsCount(costData.length);
          const savings = costData.reduce((acc: number, item: any) => acc + (item.estimated_monthly_cost || 0), 0);
          setPotentialSavings(savings);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard stats", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchStats();
    }
  }, [token]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      
      {/* Row 1: Welcome & Profile Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Welcome Card */}
        <div className="md:col-span-2 p-6 bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-white/5 rounded-2xl flex flex-col justify-between space-y-4 shadow-xl">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider uppercase">
              Overview Dashboard
            </div>
            <h3 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
              Welcome, {user?.name || 'Operator'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-lg font-normal">
              Authentication succeeded. You are successfully signed into InfraSight. Navigate to the Terraform Analyzer to upload Infrastructure-as-Code files, discover security findings, and generate compliance reports.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Connected via Google OAuth Provider</span>
          </div>
        </div>

        {/* Profile Detail Card */}
        <div className="p-6 bg-slate-900/50 border border-white/5 rounded-2xl flex flex-col items-center text-center justify-between shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 font-mono text-[45px] text-white/[0.01] pointer-events-none select-none font-bold">
            PROFILE
          </div>
          <div className="space-y-3.5 flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-blue-950 border-2 border-blue-500/20 p-0.5 flex items-center justify-center overflow-hidden shadow-2xl">
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt={user?.name} className="h-full w-full object-cover rounded-full" />
              ) : (
                <UserIcon className="h-8 w-8 text-blue-400" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-white text-base leading-snug">{user?.name}</h4>
              <p className="text-xs text-slate-400 block truncate mt-0.5">{user?.email}</p>
            </div>
          </div>
          <div className="w-full pt-4 border-t border-white/5 flex justify-between items-center text-[10px] font-mono text-slate-500 mt-4">
            <span>Database ID: #{user?.id}</span>
            <span>Joined: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>

      </div>

      {/* Row 2: Empty State Modules grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-mono">
          Continuous Analysis Modules
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Action state: Terraform Files */}
          <div 
            onClick={() => navigate('/dashboard/analyzer')}
            className="p-5 bg-white/[0.01] border border-white/5 hover:border-blue-500/20 rounded-2xl flex flex-col items-center justify-center text-center min-h-[160px] transition-all group relative overflow-hidden cursor-pointer hover:bg-slate-900/25"
          >
            <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:scale-105 transition-transform mb-4 group-hover:text-blue-400 group-hover:bg-blue-500/10">
              <FileCode className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Terraform Files</span>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4 text-center">
              {loading ? "Loading..." : filesCount > 0 ? `${filesCount} State File(s) Parsed` : "No state files uploaded"}
            </p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* state: Security Findings */}
          <div 
            onClick={() => navigate('/dashboard/analyzer')}
            className="p-5 bg-white/[0.01] border border-white/5 hover:border-rose-500/20 rounded-2xl flex flex-col items-center justify-center text-center min-h-[160px] transition-all group relative overflow-hidden cursor-pointer hover:bg-slate-900/25"
          >
            <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:scale-105 transition-transform mb-4 group-hover:text-rose-400 group-hover:bg-rose-500/10">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Security Findings</span>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4 text-center">
              {loading ? "Loading..." : findingsCount > 0 ? `${findingsCount} Vulnerability Finding(s)` : "No vulnerabilities detected"}
            </p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-rose-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* state: Cost Savings */}
          <div 
            onClick={() => navigate('/dashboard/analyzer')}
            className="p-5 bg-white/[0.01] border border-white/5 hover:border-emerald-500/20 rounded-2xl flex flex-col items-center justify-center text-center min-h-[160px] transition-all group relative overflow-hidden cursor-pointer hover:bg-slate-900/25"
          >
            <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:scale-105 transition-transform mb-4 group-hover:text-emerald-400 group-hover:bg-emerald-500/10">
              <Coins className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Cost Savings</span>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4 text-center">
              {loading ? "Loading..." : costFindingsCount > 0 ? `${costFindingsCount} Optimization(s) (-$${potentialSavings.toFixed(2)}/mo)` : "No savings opportunities"}
            </p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* state: Reports */}
          <div 
            onClick={() => navigate('/dashboard/analyzer')}
            className="p-5 bg-white/[0.01] border border-white/5 hover:border-pink-500/20 rounded-2xl flex flex-col items-center justify-center text-center min-h-[160px] transition-all group relative overflow-hidden cursor-pointer hover:bg-slate-900/25"
          >
            <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:scale-105 transition-transform mb-4 group-hover:text-pink-400 group-hover:bg-pink-500/10">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Reports</span>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4 text-center">
              {loading ? "Loading..." : filesCount > 0 ? `${filesCount} PDF Report(s) Available` : "No reports generated"}
            </p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-pink-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

        </div>
      </div>

    </div>
  );
}
