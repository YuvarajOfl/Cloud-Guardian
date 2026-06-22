import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  UserCheck, 
  LogIn, 
  FileCode, 
  Sparkles, 
  FileText, 
  ShieldAlert,
  Activity,
  ArrowRight
} from 'lucide-react';
import { API_URL } from '../config';

interface DashboardStats {
  total_users: number;
  total_logins: number;
  total_analyses: number;
  total_reports: number;
  total_uploads: number;
  active_users_today: number;
  recent_logins: Array<{
    id: number;
    user_id: number;
    email: string;
    name: string;
    login_method: string;
    ip_address: string;
    user_agent: string;
    login_timestamp: string;
  }>;
}

export function AdminDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch(`${API_URL}/api/admin/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to retrieve administrative statistics');
        }
        const data = await response.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading stats');
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      fetchStats();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-mono">Loading admin cockpit...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-center">
        <ShieldAlert className="h-8 w-8 text-rose-400 mx-auto mb-2" />
        <h4 className="text-white font-bold">Access Violation or System Error</h4>
        <p className="text-rose-200/70 text-xs mt-1">{error || 'Unable to retrieve cockpit metrics.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in relative z-10">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider uppercase mb-2">
            Administrator Area
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
            Control Tower Admin Cockpit
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-normal">
            Monitor identities, sessions, file transactions, and threat intelligence.
          </p>
        </div>
      </div>

      {/* Stats Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Total Users */}
        <div 
          onClick={() => navigate('/admin/users')}
          className="p-4 bg-white/[0.01] border border-white/5 hover:border-purple-500/20 rounded-xl cursor-pointer transition-all hover:bg-slate-900/25 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Total Users</div>
          <div className="text-xl font-extrabold text-white mt-2 font-mono">{stats.total_users}</div>
          <div className="text-[9px] text-purple-400 mt-1 flex items-center gap-1 font-mono">
            <Users className="h-2.5 w-2.5" />
            <span>Directory</span>
          </div>
        </div>

        {/* Active Today */}
        <div 
          onClick={() => navigate('/admin/logs')}
          className="p-4 bg-white/[0.01] border border-white/5 hover:border-emerald-500/20 rounded-xl cursor-pointer transition-all hover:bg-slate-900/25 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Active Today</div>
          <div className="text-xl font-extrabold text-white mt-2 font-mono">{stats.active_users_today}</div>
          <div className="text-[9px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
            <UserCheck className="h-2.5 w-2.5" />
            <span>24h window</span>
          </div>
        </div>

        {/* Total Logins */}
        <div 
          onClick={() => navigate('/admin/logs')}
          className="p-4 bg-white/[0.01] border border-white/5 hover:border-blue-500/20 rounded-xl cursor-pointer transition-all hover:bg-slate-900/25 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Total Logins</div>
          <div className="text-xl font-extrabold text-white mt-2 font-mono">{stats.total_logins}</div>
          <div className="text-[9px] text-blue-400 mt-1 flex items-center gap-1 font-mono">
            <LogIn className="h-2.5 w-2.5" />
            <span>Audit session</span>
          </div>
        </div>

        {/* Total Uploads */}
        <div 
          className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Total Uploads</div>
          <div className="text-xl font-extrabold text-white mt-2 font-mono">{stats.total_uploads}</div>
          <div className="text-[9px] text-indigo-400 mt-1 flex items-center gap-1 font-mono">
            <FileCode className="h-2.5 w-2.5" />
            <span>Terraform</span>
          </div>
        </div>

        {/* Total Analyses */}
        <div 
          className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">Analyses Run</div>
          <div className="text-xl font-extrabold text-white mt-2 font-mono">{stats.total_analyses}</div>
          <div className="text-[9px] text-teal-400 mt-1 flex items-center gap-1 font-mono">
            <Sparkles className="h-2.5 w-2.5" />
            <span>AI advisor</span>
          </div>
        </div>

        {/* Total Reports */}
        <div 
          className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">PDF Reports</div>
          <div className="text-xl font-extrabold text-white mt-2 font-mono">{stats.total_reports}</div>
          <div className="text-[9px] text-pink-400 mt-1 flex items-center gap-1 font-mono">
            <FileText className="h-2.5 w-2.5" />
            <span>Persistent</span>
          </div>
        </div>

      </div>

      {/* Recent logins block */}
      <div className="bg-slate-900/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4.5 border-b border-white/5 bg-slate-950/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-purple-400" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">Recent Authentication Events</span>
          </div>
          <button 
            onClick={() => navigate('/admin/logs')}
            className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>View Full Audit</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {stats.recent_logins.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No authentication logs found in database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.02] text-slate-400 border-b border-white/5 uppercase font-mono text-[9px] tracking-wider">
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Method</th>
                  <th className="px-6 py-3">IP Address</th>
                  <th className="px-6 py-3">Browser / User Agent</th>
                  <th className="px-6 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tr className="h-2 bg-transparent"></tr>
              <tbody className="divide-y divide-white/[0.02]">
                {stats.recent_logins.map((log) => (
                  <tr 
                    key={log.id} 
                    className="hover:bg-white/[0.01] transition-all cursor-pointer"
                    onClick={() => navigate(`/admin/user/${log.user_id}`)}
                  >
                    <td className="px-6 py-3 font-semibold text-slate-200">{log.name || 'System User'}</td>
                    <td className="px-6 py-3 font-mono text-slate-400 text-[11px]">{log.email}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        log.login_method === 'google' 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/15' 
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/15'
                      }`}>
                        {log.login_method}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-400 text-[11px]">{log.ip_address || 'N/A'}</td>
                    <td className="px-6 py-3 text-slate-500 truncate max-w-[200px]" title={log.user_agent}>
                      {log.user_agent || 'Unknown'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-slate-500">
                      {new Date(log.login_timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
