import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Terminal, 
  LogIn, 
  Activity, 
  Search,
  ShieldAlert
} from 'lucide-react';
import { API_URL } from '../config';

interface LoginLogData {
  id: number;
  user_id: number;
  email: string;
  name: string;
  login_method: string;
  ip_address: string;
  user_agent: string;
  login_timestamp: string;
}

interface UsageLogData {
  id: number;
  user_id: number;
  email: string;
  name: string;
  action: string;
  timestamp: string;
}

export function AdminLogs() {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'login' | 'usage'>('login');
  
  const [loginLogs, setLoginLogs] = useState<LoginLogData[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchLogs() {
      try {
        setLoading(true);
        const endpoint = activeTab === 'login' ? 'login-logs' : 'usage-logs';
        const response = await fetch(`${API_URL}/api/admin/${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to retrieve log audit history');
        }
        const data = await response.json();
        if (activeTab === 'login') {
          setLoginLogs(data);
        } else {
          setUsageLogs(data);
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading logs');
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      fetchLogs();
    }
  }, [token, activeTab]);

  const filteredLoginLogs = loginLogs.filter(log => 
    log.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.ip_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.login_method.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsageLogs = usageLogs.filter(log => 
    log.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in relative z-10">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider uppercase mb-2">
            Operations Audit
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
            System Operations Logs
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-normal">
            Analyze authentication requests and platform-wide configurations transactions.
          </p>
        </div>
      </div>

      {/* Tabs and Search row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-slate-900/10 border border-white/5 rounded-2xl">
        
        {/* Tabs */}
        <div className="flex p-1 bg-slate-950/40 rounded-xl border border-white/5 w-fit">
          <button
            onClick={() => {
              setActiveTab('login');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'login' 
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Login Sessions</span>
          </button>
          
          <button
            onClick={() => {
              setActiveTab('usage');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'usage' 
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>User Transactions</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input 
            type="text"
            placeholder={activeTab === 'login' ? "Search by email, name, IP..." : "Search by email, action..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-all font-mono"
          />
        </div>

      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4">
            <div className="h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-xs font-mono">Reading logs...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-450 flex items-center justify-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            <span className="text-xs font-mono">{error}</span>
          </div>
        ) : (activeTab === 'login' ? filteredLoginLogs : filteredUsageLogs).length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-xs font-mono">
            No audit logs found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'login' ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] text-slate-400 border-b border-white/5 uppercase font-mono text-[9px] tracking-wider">
                    <th className="px-6 py-3">Operator</th>
                    <th className="px-6 py-3">Email Address</th>
                    <th className="px-6 py-3">Login Method</th>
                    <th className="px-6 py-3">IP Address</th>
                    <th className="px-6 py-3">User Agent</th>
                    <th className="px-6 py-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {filteredLoginLogs.map((log) => (
                    <tr 
                      key={log.id} 
                      className="hover:bg-white/[0.01] transition-all cursor-pointer"
                      onClick={() => navigate(`/admin/user/${log.user_id}`)}
                    >
                      <td className="px-6 py-3.5 font-bold text-slate-200">{log.name}</td>
                      <td className="px-6 py-3.5 font-mono text-slate-400 text-[11px]">{log.email}</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase ${
                          log.login_method === 'google' 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/15' 
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/15'
                        }`}>
                          {log.login_method}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-400 text-[11px]">{log.ip_address || 'N/A'}</td>
                      <td className="px-6 py-3.5 text-slate-500 max-w-[220px] truncate" title={log.user_agent}>
                        {log.user_agent || 'Unknown'}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-slate-500">
                        {new Date(log.login_timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] text-slate-400 border-b border-white/5 uppercase font-mono text-[9px] tracking-wider">
                    <th className="px-6 py-3">Operator</th>
                    <th className="px-6 py-3">Email Address</th>
                    <th className="px-6 py-3">Performed Action</th>
                    <th className="px-6 py-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {filteredUsageLogs.map((log) => {
                    let actionColorClass = "bg-slate-800 text-slate-400 border-white/5";
                    if (log.action === "LOGIN") actionColorClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                    if (log.action === "LOGOUT") actionColorClass = "bg-slate-800 text-slate-500 border-white/5";
                    if (log.action === "UPLOAD_FILE") actionColorClass = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                    if (log.action === "RUN_ANALYSIS") actionColorClass = "bg-teal-500/10 text-teal-400 border-teal-500/20";
                    if (log.action === "GENERATE_REPORT" || log.action === "DOWNLOAD_REPORT") actionColorClass = "bg-pink-500/10 text-pink-400 border-pink-500/20";

                    return (
                      <tr 
                        key={log.id} 
                        className="hover:bg-white/[0.01] transition-all cursor-pointer"
                        onClick={() => log.user_id && navigate(`/admin/user/${log.user_id}`)}
                      >
                        <td className="px-6 py-3.5 font-bold text-slate-200">{log.name}</td>
                        <td className="px-6 py-3.5 font-mono text-slate-400 text-[11px]">{log.email}</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wide ${actionColorClass} border`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-slate-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
