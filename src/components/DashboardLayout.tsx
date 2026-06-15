import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User as UserIcon, 
  LogOut, 
  LayoutDashboard,
  ShieldCheck,
  FileCode
} from 'lucide-react';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
            <div className="px-6 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
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
              
              <NavLink 
                to="/dashboard" 
                end
                className={({ isActive }) => 
                  `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive 
                      ? 'bg-white/5 border border-white/10 text-white shadow-inner' 
                      : 'hover:bg-white/[0.02] border border-transparent text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                <LayoutDashboard className="h-4 w-4 text-blue-400" />
                <span>Overview Dashboard</span>
              </NavLink>

              <NavLink 
                to="/dashboard/analyzer" 
                className={({ isActive }) => 
                  `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive 
                      ? 'bg-white/5 border border-white/10 text-white shadow-inner' 
                      : 'hover:bg-white/[0.02] border border-transparent text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                <FileCode className="h-4 w-4 text-indigo-400" />
                <span>Terraform Analyzer</span>
              </NavLink>
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
              <span>Control Center / {user?.name || 'Guardian'}</span>
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded uppercase hidden sm:inline-block">
                Active Session
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-350 hover:text-rose-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </header>

          {/* Render nesting components here */}
          <div className="flex-1 overflow-y-auto p-8">
            <Outlet />
          </div>

        </main>
      </div>

    </div>
  );
}
