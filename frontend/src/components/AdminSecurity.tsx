import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Users, 
  LogIn, 
  Activity, 
  XCircle,
  FileCode,
  Sparkles,
  FileText
} from 'lucide-react';
import { API_URL } from '../config';

interface FailedAttempt {
  id: number;
  email: string;
  ip_address: string;
  user_agent: string;
  attempt_timestamp: string;
}

interface SuspiciousActivity {
  type: string;
  severity: 'High' | 'Medium' | 'Low';
  description: string;
  target: string;
  timestamp: string;
}

interface MostActiveUser {
  id: number;
  name: string;
  email: string;
  activity_count: number;
  uploads: number;
  analyses: number;
  reports: number;
}

interface SecurityData {
  failed_login_attempts: FailedAttempt[];
  recent_logins: any[];
  suspicious_activity: SuspiciousActivity[];
  most_active_users: MostActiveUser[];
}

export function AdminSecurity() {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSecurityTelemetry() {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/admin/security`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to retrieve security auditing telemetry');
        }
        const resData = await response.json();
        setData(resData);
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading security data');
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      fetchSecurityTelemetry();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-mono">Gathering security threats intelligence...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-center">
        <ShieldAlert className="h-8 w-8 text-rose-400 mx-auto mb-2" />
        <h4 className="text-white font-bold">Security Context Inaccessible</h4>
        <p className="text-rose-200/70 text-xs mt-1">{error || 'Security logs cannot be loaded.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in relative z-10">
      
      {/* Title Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider uppercase mb-2">
          Security Console
        </div>
        <h2 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
          Security & Threat Monitoring
        </h2>
        <p className="text-xs text-slate-400 mt-0.5 font-normal">
          Identify authentication anomalies, high-risk assets, and audit operator activity volume.
        </p>
      </div>

      {/* Grid: Alerts & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Suspicious Alerts (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-mono flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Active Threats & Anomalies</span>
          </h3>

          {data.suspicious_activity.length === 0 ? (
            <div className="p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-white">System Integrity Normal</h5>
                <p className="text-[10px] text-slate-450 text-slate-400 mt-0.5">No login abuse or rate-limiting infractions flagged in the database.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {data.suspicious_activity.map((alert, idx) => {
                let severityColor = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
                if (alert.severity === 'High') severityColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                if (alert.severity === 'Low') severityColor = "bg-slate-500/10 text-slate-400 border-white/5";

                return (
                  <div key={idx} className="p-4 bg-slate-900/10 border border-white/5 rounded-2xl flex items-start gap-4">
                    <div className={`p-1.5 rounded-lg border shrink-0 ${severityColor}`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-white uppercase font-mono">{alert.type.replace('_', ' ')}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${severityColor} border`}>
                          {alert.severity} Risk
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium leading-relaxed">{alert.description}</p>
                      <span className="text-[9px] text-slate-500 block font-mono">Detected: {new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Leaderboard (Right 1 col) */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-mono flex items-center gap-1.5">
            <Users className="h-4 w-4 text-purple-400" />
            <span>Activity Leaderboard</span>
          </h3>

          <div className="bg-slate-900/10 border border-white/5 rounded-2xl p-4 space-y-4">
            {data.most_active_users.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono text-center py-6">No usage statistics recorded.</p>
            ) : (
              <div className="space-y-4">
                {data.most_active_users.map((user, idx) => (
                  <div 
                    key={user.id} 
                    className="flex justify-between items-center p-2.5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 rounded-xl transition-all cursor-pointer"
                    onClick={() => navigate(`/admin/user/${user.id}`)}
                  >
                    <div className="space-y-0.5 max-w-[130px] sm:max-w-none">
                      <span className="text-xs font-bold text-slate-200 block truncate">{user.name}</span>
                      <span className="text-[9px] text-slate-500 font-mono block truncate">{user.email}</span>
                      <div className="flex items-center gap-2 text-[8px] text-slate-400 font-mono pt-1">
                        <span className="flex items-center gap-0.5"><FileCode className="h-2 w-2 text-blue-400" /> {user.uploads}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5"><Sparkles className="h-2 w-2 text-teal-400" /> {user.analyses}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5"><FileText className="h-2 w-2 text-pink-400" /> {user.reports}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-extrabold text-white font-mono">{user.activity_count}</span>
                      <span className="text-[8px] text-slate-500 block uppercase font-bold tracking-wider font-mono">Actions</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Row: Failed Login Attempts table */}
      <div className="bg-slate-900/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4.5 border-b border-white/5 bg-slate-950/20 flex items-center gap-2">
          <XCircle className="h-4.5 w-4.5 text-rose-500" />
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">Auth Failures telemetry</span>
        </div>

        {data.failed_login_attempts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs font-mono">
            No authentication anomalies registered.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.02] text-slate-400 border-b border-white/5 uppercase font-mono text-[9px] tracking-wider">
                  <th className="px-6 py-3">Target Email</th>
                  <th className="px-6 py-3">IP Address</th>
                  <th className="px-6 py-3">User Agent</th>
                  <th className="px-6 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {data.failed_login_attempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-white/[0.01] transition-all">
                    <td className="px-6 py-3.5 font-mono text-rose-400 text-[11px] font-semibold">{attempt.email}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-400 text-[11px]">{attempt.ip_address || 'Unknown'}</td>
                    <td className="px-6 py-3.5 text-slate-500 truncate max-w-[300px]" title={attempt.user_agent}>
                      {attempt.user_agent || 'Unknown'}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-slate-500">
                      {new Date(attempt.attempt_timestamp).toLocaleString()}
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
