import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User as UserIcon, 
  ShieldAlert, 
  GitCompare, 
  FileText, 
  FileCode,
  UserCheck
} from 'lucide-react';

export function DashboardOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
              Welcome, {user?.name || 'Guardian'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-lg font-normal">
              Authentication succeeded. You are successfully signed into CloudGuardian AI. Navigate to the Terraform Analyzer to upload Infrastructure-as-Code files, discover security findings, and generate compliance reports.
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
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4">
              Click to open Analyzer and upload configurations.
            </p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* state: Security Findings */}
          <div className="p-5 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center text-center min-h-[160px] transition-all group relative overflow-hidden">
            <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:scale-105 transition-transform mb-4">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Security Findings</span>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4">
              Requires active scanning from the analyzer.
            </p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* state: Drift Results */}
          <div className="p-5 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center text-center min-h-[160px] transition-all group relative overflow-hidden">
            <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:scale-105 transition-transform mb-4">
              <GitCompare className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Drift Results</span>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4">
              Requires state drift scan validation.
            </p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* state: Reports */}
          <div className="p-5 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center text-center min-h-[160px] transition-all group relative overflow-hidden">
            <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:scale-105 transition-transform mb-4">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Reports</span>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4">
              Generate PDF summaries from the scan reports.
            </p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-pink-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

        </div>
      </div>

    </div>
  );
}
