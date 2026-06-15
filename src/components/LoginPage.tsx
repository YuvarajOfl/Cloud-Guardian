import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { 
  Shield, 
  GitCompare, 
  FileText, 
  Lock, 
  Sparkles, 
  AlertCircle,
  HelpCircle,
  Settings
} from 'lucide-react';

export function LoginPage() {
  const { loginWithGoogleToken, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  
  // Custom Google Client ID state loaded from env or localStorage
  const [clientIdInput, setClientIdInput] = useState(localStorage.getItem('cg_google_client_id') || '');
  const [activeClientId, setActiveClientId] = useState(
    localStorage.getItem('cg_google_client_id') || 
    import.meta.env.VITE_GOOGLE_CLIENT_ID || 
    ''
  );
  
  const [showConfig, setShowConfig] = useState(false);

  // Load Google SDK and initialize on mount/client ID change
  useEffect(() => {
    if (!activeClientId) return;

    // Remove existing script if any to prevent duplicate initialization errors
    const existingScript = document.getElementById('google-gsi-client');
    if (existingScript) {
      initializeGoogleSignIn();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'google-gsi-client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initializeGoogleSignIn();
    };
    script.onerror = () => {
      console.error('Failed to load Google Identity Services client script.');
      setError('Failed to load Google Sign-In SDK. Check your network connection.');
    };
    document.body.appendChild(script);
  }, [activeClientId]);

  const initializeGoogleSignIn = () => {
    try {
      const google = (window as any).google;
      if (!google) return;

      google.accounts.id.initialize({
        client_id: activeClientId,
        callback: handleCredentialResponse,
        auto_select: false,
      });

      // Render button
      const btnParent = document.getElementById('google-signin-button');
      if (btnParent) {
        btnParent.innerHTML = ''; // Clear container
        google.accounts.id.renderButton(
          btnParent,
          { theme: 'filled_black', size: 'large', type: 'standard', shape: 'pill', width: 320 }
        );
      }
    } catch (err) {
      console.error('Failed to initialize Google Sign-In SDK:', err);
    }
  };

  // Re-render button if SDK is loaded but button element just became visible
  useEffect(() => {
    if (activeClientId) {
      setTimeout(() => {
        initializeGoogleSignIn();
      }, 150);
    }
  }, [activeClientId, showConfig]);

  const handleCredentialResponse = async (response: any) => {
    setError(null);
    try {
      await loginWithGoogleToken(response.credential);
    } catch (err: any) {
      console.error('Google Auth backend validation error:', err);
      setError(err.message || 'Google Authentication failed. Verify backend is running.');
    }
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = clientIdInput.trim();
    if (cleanId) {
      localStorage.setItem('cg_google_client_id', cleanId);
      setActiveClientId(cleanId);
      setError(null);
      setShowConfig(false);
    } else {
      localStorage.removeItem('cg_google_client_id');
      setActiveClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden flex flex-col justify-between selection:bg-blue-600/30 selection:text-blue-200">
      
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/15 blur-[150px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none" />

      {/* Header Bar */}
      <header className="w-full h-16 border-b border-white/5 backdrop-blur-md bg-slate-950/50 flex items-center justify-between px-6 sm:px-12 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-white tracking-tight text-lg">CloudGuardian AI</span>
            <span className="text-[8px] text-slate-500 font-semibold tracking-widest block font-mono uppercase">Security & Drift control</span>
          </div>
        </div>
        
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg transition-colors cursor-pointer"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Configure OAuth</span>
        </button>
      </header>

      {/* Main Form container */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 max-w-7xl mx-auto px-6 py-12 relative z-10 w-full">
        
        {/* Left Column: Descriptions */}
        <div className="flex-1 max-w-xl space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest font-mono">Continuous IaC Guardrails</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            CloudGuardian AI
          </h1>
          <h2 className="text-xl sm:text-2xl font-bold text-blue-450 text-indigo-400">
            Terraform Security & Drift Analyzer
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Analyze Terraform infrastructure files, detect security risks, identify configuration drift, and generate downloadable reports.
          </p>

          {/* Features Preview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-blue-500/20 transition-all group">
              <div className="p-2 bg-blue-950/40 text-blue-400 rounded-lg w-fit mb-3">
                <Shield className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Security Analysis</h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Scan HCL components for misconfigurations and vulnerable subnets.
              </p>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-indigo-500/20 transition-all group">
              <div className="p-2 bg-indigo-950/40 text-indigo-400 rounded-lg w-fit mb-3">
                <GitCompare className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Drift Detection</h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Compare HCL states against active deployments.
              </p>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-purple-500/20 transition-all group">
              <div className="p-2 bg-purple-950/40 text-purple-400 rounded-lg w-fit mb-3">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">PDF Reports</h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Generate downloadable summaries for auditor compliance checks.
              </p>
            </div>
            
          </div>
        </div>

        {/* Right Column: Glass Login Panel */}
        <div className="w-full max-w-md bg-white/[0.02] border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl flex flex-col justify-center space-y-6 relative overflow-hidden">
          
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-white">Access the Control Tower</h3>
            <p className="text-xs text-slate-400">Sign in to begin multi-cloud audits</p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Config form overlay */}
          {showConfig ? (
            <form onSubmit={handleSaveClientId} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-mono">Google Client ID</label>
                <input
                  type="text"
                  placeholder="e.g. xxxxx.apps.googleusercontent.com"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Save Configuration
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 py-4 flex flex-col items-center w-full">
              {activeClientId ? (
                <div className="space-y-4 w-full flex flex-col items-center">
                  {authLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-mono text-slate-400">Verifying session token...</span>
                    </div>
                  ) : (
                    <div className="space-y-4 w-full flex flex-col items-center">
                      <div id="google-signin-button" className="relative z-20 min-h-[40px] flex items-center justify-center" />
                      <button
                        type="button"
                        onClick={async () => {
                          setError(null);
                          try {
                            await loginWithGoogleToken("sandbox_developer_token");
                          } catch (err: any) {
                            setError(err.message || "Sandbox login failed.");
                          }
                        }}
                        className="text-[11px] text-slate-400 hover:text-emerald-450 underline transition-colors cursor-pointer font-semibold"
                      >
                        Or access via Demo Sandbox
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 text-center flex items-center gap-1 justify-center max-w-xs">
                    <Lock className="h-3 w-3 text-emerald-500" />
                    Secure OAuth payload processing handled server-side
                  </p>
                </div>
              ) : (
                <div className="text-center p-6 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-3.5 w-full flex flex-col items-center">
                  <p className="text-xs text-amber-300 leading-normal">
                    Google OAuth Client ID is not configured yet. 
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 w-full justify-center">
                    <button
                      type="button"
                      onClick={() => setShowConfig(true)}
                      className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs rounded-lg transition-colors cursor-pointer flex-1"
                    >
                      Set Google Client ID
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        try {
                          await loginWithGoogleToken("sandbox_developer_token");
                        } catch (err: any) {
                          setError(err.message || "Sandbox login failed.");
                        }
                      }}
                      className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs rounded-lg transition-colors cursor-pointer flex-1"
                    >
                      Demo Sandbox Access
                    </button>
                  </div>
                </div>
              )}
            </div>

          )}

          {/* Setup tips */}
          <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl space-y-2 text-left">
            <span className="text-[9px] uppercase font-bold text-indigo-400 tracking-wider font-mono flex items-center gap-1">
              <HelpCircle className="h-3 w-3" /> Technical setup guidance
            </span>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Register a Google Web Application client ID in your Google Cloud Console. Set Authorized JavaScript Origins to <code className="text-slate-350">http://localhost:3000</code>.
            </p>
          </div>

        </div>
      </main>

      {/* Footer bar */}
      <footer className="w-full h-12 border-t border-white/5 bg-slate-950/30 flex items-center justify-between px-6 sm:px-12 text-[10px] text-slate-500 relative z-10">
        <span>© 2026 CloudGuardian AI Platform. All rights reserved.</span>
        <span className="font-mono uppercase tracking-wider text-[8px] bg-slate-900 border border-white/5 rounded px-1.5 py-0.5">Sprint: Auth & Identity</span>
      </footer>

    </div>
  );
}
