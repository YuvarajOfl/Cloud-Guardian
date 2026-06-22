import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User as UserIcon, 
  ArrowLeft, 
  FileCode, 
  Sparkles, 
  FileText, 
  LogIn,
  History,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { API_URL } from '../config';

interface UserDetail {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    provider: string;
    profile_picture?: string;
    created_at: string;
    updated_at: string;
  };
  uploads_count: number;
  analysis_count: number;
  reports_count: number;
  last_login: string | null;
  login_method: string | null;
  activity: Array<{
    id: number;
    action: string;
    timestamp: string;
  }>;
}

export function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserDetail() {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/admin/user/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to retrieve user diagnostics');
        }
        const resData = await response.json();
        setData(resData);
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading user detail');
      } finally {
        setLoading(false);
      }
    }
    if (token && id) {
      fetchUserDetail();
    }
  }, [token, id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-mono">Loading user diagnostic stats...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-center">
        <ShieldAlert className="h-8 w-8 text-rose-400 mx-auto mb-2" />
        <h4 className="text-white font-bold">Error Accessing User File</h4>
        <p className="text-rose-200/70 text-xs mt-1">{error || 'User details cannot be accessed.'}</p>
        <button 
          onClick={() => navigate('/admin/users')}
          className="mt-4 px-4 py-2 bg-slate-900 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-bold text-white cursor-pointer"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  const { user } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in relative z-10">
      
      {/* Back Button and Identity Header */}
      <div className="space-y-4">
        <button 
          onClick={() => navigate('/admin/users')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Directory</span>
        </button>

        <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-slate-900/10 border border-white/5 rounded-2xl">
          <div className="h-20 w-20 rounded-full bg-slate-950 border border-white/10 p-0.5 flex items-center justify-center overflow-hidden shadow-2xl">
            {user.profile_picture ? (
              <img src={user.profile_picture} alt="Profile" className="h-full w-full object-cover rounded-full" />
            ) : (
              <UserIcon className="h-10 w-10 text-slate-400" />
            )}
          </div>
          <div className="space-y-2 text-center md:text-left flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h3 className="text-xl font-extrabold text-white tracking-tight">{user.name}</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase w-fit mx-auto md:mx-0 ${
                user.role === 'admin' 
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/15' 
                  : 'bg-slate-500/10 text-slate-400 border border-white/5'
              }`}>
                {user.role || 'user'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">{user.email}</p>
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-[10px] text-slate-550 text-slate-500 font-mono pt-1">
              <span>Provider: <b className="capitalize text-slate-300">{user.provider}</b></span>
              <span>•</span>
              <span>Operator ID: <b className="text-slate-300">#{user.id}</b></span>
              <span>•</span>
              <span>Registered: <b className="text-slate-300">{new Date(user.created_at).toLocaleString()}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* User Stats summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Uploads count */}
        <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 font-mono">Uploads</span>
          <h4 className="text-xl font-extrabold text-white mt-1.5 font-mono">{data.uploads_count}</h4>
          <span className="text-[8px] text-slate-500 font-mono flex items-center gap-1 mt-1">
            <FileCode className="h-2.5 w-2.5 text-blue-400" />
            <span>Files submitted</span>
          </span>
        </div>

        {/* Cost Optimization analyses */}
        <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 font-mono">Analyses</span>
          <h4 className="text-xl font-extrabold text-white mt-1.5 font-mono">{data.analysis_count}</h4>
          <span className="text-[8px] text-slate-500 font-mono flex items-center gap-1 mt-1">
            <Sparkles className="h-2.5 w-2.5 text-teal-400" />
            <span>AI investigations</span>
          </span>
        </div>

        {/* Reports generated */}
        <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 font-mono">Reports</span>
          <h4 className="text-xl font-extrabold text-white mt-1.5 font-mono">{data.reports_count}</h4>
          <span className="text-[8px] text-slate-500 font-mono flex items-center gap-1 mt-1">
            <FileText className="h-2.5 w-2.5 text-pink-400" />
            <span>PDF Assessments</span>
          </span>
        </div>

        {/* Last Login date */}
        <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl sm:col-span-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 font-mono">Last Session</span>
          <h4 className="text-sm font-bold text-white mt-2 truncate">
            {data.last_login ? new Date(data.last_login).toLocaleString() : 'Never Logged In'}
          </h4>
          <span className="text-[8px] text-slate-500 font-mono flex items-center gap-1 mt-1">
            <LogIn className="h-2.5 w-2.5 text-purple-400" />
            <span>Method: <b className="uppercase text-slate-400">{data.login_method || 'N/A'}</b></span>
          </span>
        </div>

      </div>

      {/* Activity Log Audit Timeline */}
      <div className="bg-slate-900/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4.5 border-b border-white/5 bg-slate-950/20 flex items-center gap-2">
          <History className="h-4.5 w-4.5 text-purple-400" />
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">Operator Usage Logs (Last 15)</span>
        </div>

        {data.activity.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-xs font-mono">
            No system actions recorded for this operator.
          </div>
        ) : (
          <div className="p-6 relative">
            {/* Vertical timeline connector */}
            <div className="absolute left-9 top-8 bottom-8 w-[1px] bg-white/5" />
            
            <div className="space-y-6 relative">
              {data.activity.map((act) => {
                let actionColorClass = "bg-slate-800 text-slate-400 border-white/5";
                if (act.action === "LOGIN") actionColorClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                if (act.action === "LOGOUT") actionColorClass = "bg-slate-800 text-slate-500 border-white/5";
                if (act.action === "UPLOAD_FILE") actionColorClass = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                if (act.action === "RUN_ANALYSIS") actionColorClass = "bg-teal-500/10 text-teal-400 border-teal-500/20";
                if (act.action === "GENERATE_REPORT" || act.action === "DOWNLOAD_REPORT") actionColorClass = "bg-pink-500/10 text-pink-400 border-pink-500/20";

                return (
                  <div key={act.id} className="flex items-center gap-6 text-xs pl-0.5">
                    {/* Bullet */}
                    <div className="h-6 w-6 rounded-full bg-slate-950 border-2 border-white/10 flex items-center justify-center shrink-0 z-10">
                      <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                    </div>
                    {/* Action Block */}
                    <div className="flex-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 bg-white/[0.01] border border-white/5 rounded-xl hover:bg-slate-900/15 transition-all">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wide ${actionColorClass} border`}>
                          {act.action}
                        </span>
                        <span className="font-semibold text-slate-200">
                          {act.action === 'LOGIN' && 'Authenticated onto Control Tower'}
                          {act.action === 'LOGOUT' && 'Session terminated'}
                          {act.action === 'UPLOAD_FILE' && 'Uploaded a new Terraform configuration'}
                          {act.action === 'RUN_ANALYSIS' && 'Triggered compliance analysis'}
                          {act.action === 'GENERATE_REPORT' && 'Generated Assessment Report'}
                          {act.action === 'DOWNLOAD_REPORT' && 'Downloaded Assessment PDF'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{new Date(act.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
