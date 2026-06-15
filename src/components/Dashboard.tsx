import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User as UserIcon, 
  LogOut, 
  ShieldAlert, 
  GitCompare, 
  FileText, 
  FileCode,
  LayoutDashboard,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden selection:bg-blue-600/30 selection:text-blue-200">
      
      {/* Background gradients */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] left-[-15%] w-[55%] h-[55%] rounded-full bg-blue-900/10 blur-[140px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff02_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 flex h-screen overflow-hidden">
        
        {/* Left persistent sidebar */}
        <aside className="w-64 bg-slate-950 border-r border-white/5 flex flex-col justify-between shrink-0 h-full hidden md:flex">
          <div className="py-6 space-y-8">
            {/* Logo */}
            <div className="px-6 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <h1 className="font-bold text-white text-sm tracking-tight leading-normal">
                  CloudGuardian <span className="text-blue-400">AI</span>
                </h1>
                <span className="text-[8px] text-slate-500 font-semibold tracking-widest block font-mono uppercase">Control Tower</span>
              </div>
            </div>

            {/* Nav */}
            <div className="px-3 space-y-1">
              <span className="px-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Workspace</span>
              <button className="w-full flex items-center gap-3 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-white tracking-wide">
                <LayoutDashboard className="h-4 w-4 text-blue-400" />
                <span>Overview Dashboard</span>
              </button>
            </div>
          </div>

          {/* Profile footer in sidebar */}
          <div className="p-4 border-t border-white/5 bg-slate-900/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-blue-950 border border-blue-500/30 flex items-center justify-center text-[10px] text-blue-400 font-bold overflow-hidden shadow-inner">
                  {user?.profile_picture ? (
                    <img src={user.profile_picture} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="max-w-[120px] truncate">
                  <span className="text-xs font-bold text-slate-200 block truncate">{user?.name}</span>
                  <span className="text-[9px] text-slate-500 block truncate">{user?.email}</span>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 hover:bg-rose-500/10 border border-transparent hover:border-rose-900/30 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                title="Sign out of control tower"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Content area */}
        <main className="flex-1 flex flex-col h-full bg-[#08090f] overflow-hidden">
          
          {/* Header */}
          <header className="h-16 border-b border-white/5 px-8 flex items-center justify-between shrink-0 bg-slate-950/20 backdrop-blur-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Control Center / overview</span>
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded uppercase">
                Active Session
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-350 hover:text-rose-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </header>

          {/* Main workspace scroll area */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-6xl mx-auto space-y-8">
              
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
                      Authentication succeeded. You are successfully signed into CloudGuardian AI. Your session token is stored and will automatically renew. Follow-on modules (Terraform, Drift, PDF) will activate in the next sprint cycle.
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
                    <span>Joined: {new Date(user?.created_at || '').toLocaleDateString()}</span>
                  </div>
                </div>

              </div>

              {/* Row 2: Empty State Modules grid */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-mono">
                  Continuous Analysis Modules
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* Empty state: Terraform Files */}
                  <div className="p-5 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center text-center min-h-[160px] transition-all group relative overflow-hidden">
                    <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:scale-105 transition-transform mb-4">
                      <FileCode className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">Terraform Files</span>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4">
                      "No files uploaded yet."
                    </p>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Empty state: Security Findings */}
                  <div className="p-5 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center text-center min-h-[160px] transition-all group relative overflow-hidden">
                    <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:scale-105 transition-transform mb-4">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">Security Findings</span>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4">
                      "No security analysis available."
                    </p>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Empty state: Drift Results */}
                  <div className="p-5 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center text-center min-h-[160px] transition-all group relative overflow-hidden">
                    <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:scale-105 transition-transform mb-4">
                      <GitCompare className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">Drift Results</span>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4">
                      "No drift analysis available."
                    </p>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Empty state: Reports */}
                  <div className="p-5 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-2xl flex flex-col items-center justify-center text-center min-h-[160px] transition-all group relative overflow-hidden">
                    <div className="p-3 bg-white/5 text-slate-400 rounded-xl group-hover:scale-105 transition-transform mb-4">
                      <FileText className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">Reports</span>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-4">
                      "No reports generated."
                    </p>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-pink-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                </div>
              </div>

            </div>
          </div>

        </main>
      </div>

    </div>
  );
}
