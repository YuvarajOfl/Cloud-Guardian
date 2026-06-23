import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Calendar, AlertCircle } from 'lucide-react';

export function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-350 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>User session not found. Please try logging in again.</span>
        </div>
      </div>
    );
  }

  const formattedDate = user.created_at 
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Unknown';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-1 text-left">
        <h1 className="text-xl font-bold text-white tracking-tight">User Profile</h1>
        <p className="text-xs text-slate-450">Inspect your security operator account details and parameters.</p>
      </div>

      {/* Main card */}
      <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-8 relative overflow-hidden text-left">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

        {/* Profile header block */}
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-white/5">
          <div className="h-20 w-20 rounded-full bg-blue-950/60 border-2 border-blue-500/30 p-1 flex items-center justify-center overflow-hidden shadow-2xl relative group shrink-0">
            {user.profile_picture ? (
              <img src={user.profile_picture} alt="Profile" className="h-full w-full object-cover rounded-full" />
            ) : (
              <User className="h-10 w-10 text-blue-400" />
            )}
            <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-center sm:text-left space-y-1.5">
            <h2 className="text-lg font-bold text-white">{user.name}</h2>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded">
                Access Level: {user.access_level || (user.role === 'admin' ? 'Administrator' : 'Standard User')}
              </span>
              <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                user.role === 'admin'
                  ? 'bg-purple-500/15 border border-purple-500/20 text-purple-400'
                  : 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-400'
              }`}>
                Provider: {user.provider === 'google' ? 'Google OAuth' : 'Local Account'}
              </span>
            </div>
          </div>
        </div>

        {/* Grid of properties */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <User className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Operator Name</span>
              <span className="text-sm font-semibold text-slate-200 block">{user.name}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Mail className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Email Address</span>
              <span className="text-sm font-semibold text-slate-200 block">{user.email}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
              <Shield className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Unique User ID</span>
              <span className="text-sm font-mono font-semibold text-slate-300 block">{user.id}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Account Created At</span>
              <span className="text-sm font-semibold text-slate-200 block">{formattedDate}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Shield className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Authentication Provider</span>
              <span className="text-sm font-semibold text-slate-200 block">{user.provider === 'google' ? 'Google OAuth' : 'Local Account'}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex items-start gap-3">
            <div className={`p-2 rounded-lg ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <Shield className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Access Level</span>
              <span className="text-sm font-semibold text-slate-200 block">{user.access_level || (user.role === 'admin' ? 'Administrator' : 'Standard User')}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
