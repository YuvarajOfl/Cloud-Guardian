import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { 
  Shield, 
  GitCompare, 
  FileText, 
  Lock, 
  Sparkles, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

export function LoginPage() {
  const { loginWithGoogleToken, loginWithEmailAndPassword, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [activeClientId, setActiveClientId] = useState<string>(import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your_google_client_id_here');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithEmailAndPassword(email, password);
    } catch (err: any) {
      console.error('Email Login error:', err);
      setError(err.message || 'Incorrect email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    console.log("GOOGLE CLIENT ID:", import.meta.env.VITE_GOOGLE_CLIENT_ID);
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/config`);
        if (response.ok) {
          const data = await response.json();
          if (data.google_client_id) {
            setActiveClientId(data.google_client_id);
          }
        }
      } catch (err) {
        console.error("Failed to load Google client ID from backend configuration:", err);
      }
    };
    fetchConfig();
  }, []);

  // Load Google SDK and initialize on activeClientId change
  useEffect(() => {
    if (!activeClientId) return;

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

  // Re-render button if SDK is loaded
  useEffect(() => {
    if (activeClientId) {
      setTimeout(() => {
        initializeGoogleSignIn();
      }, 150);
    }
  }, [activeClientId]);

  const handleCredentialResponse = async (response: any) => {
    setError(null);
    try {
      await loginWithGoogleToken(response.credential);
    } catch (err: any) {
      console.error('Google Auth backend validation error:', err);
      setError(err.message || 'Google Authentication failed. Verify backend is running.');
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
            <span className="font-bold text-white tracking-tight text-lg">InfraSight</span>
            <span className="text-[8px] text-slate-500 font-semibold tracking-widest block font-mono uppercase">Security & Cost Control</span>
          </div>
        </div>
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
            InfraSight
          </h1>
          <h2 className="text-xl sm:text-2xl font-bold text-indigo-400">
            Understand Infrastructure Before Deployment
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Analyze Terraform infrastructure, estimate costs, identify security risks, and generate AI recommendations with compliance reports.
          </p>

          {/* Features Preview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-blue-500/20 transition-all group">
              <div className="p-2 bg-blue-950/40 text-blue-400 rounded-lg w-fit mb-3">
                <Shield className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Security Analysis</h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Scan Terraform files for misconfigurations and vulnerable settings.
              </p>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-indigo-500/20 transition-all group">
              <div className="p-2 bg-indigo-950/40 text-indigo-400 rounded-lg w-fit mb-3">
                <GitCompare className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Cost Control</h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Detect idle servers, oversized tiers, and potential optimizations.
              </p>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-purple-500/20 transition-all group">
              <div className="p-2 bg-purple-950/40 text-purple-400 rounded-lg w-fit mb-3">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Compliance PDF</h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Generate executive summaries, security audits, and complete reports.
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

          <div className="space-y-4 py-4 flex flex-col items-center w-full">
            {authLoading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-slate-400">Verifying session token...</span>
              </div>
            ) : (
              <div className="space-y-4 w-full flex flex-col items-center">
                <div id="google-signin-button" className="relative z-20 min-h-[40px] flex items-center justify-center animate-fade-in" />
                <p className="text-[10px] text-slate-500 text-center flex items-center gap-1 justify-center max-w-xs">
                  <Lock className="h-3 w-3 text-emerald-500" />
                  Secure OAuth Authentication
                </p>

                {/* Divider */}
                <div className="w-full flex items-center gap-3 py-1">
                  <div className="h-[1px] flex-1 bg-white/10"></div>
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">or sign in with email</span>
                  <div className="h-[1px] flex-1 bg-white/10"></div>
                </div>

                {/* Email + Password Form */}
                <form onSubmit={handleEmailLogin} className="w-full space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-900/50 border border-white/10 rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Sign In"
                    )}
                  </button>

                  <div className="text-center pt-2 border-t border-white/5">
                    <span className="text-xs text-slate-500">Don't have an account? </span>
                    <a href="/register" className="text-xs text-blue-400 hover:underline hover:text-blue-300 transition-colors font-medium">Register here</a>
                  </div>
                </form>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer bar */}
      <footer className="w-full h-12 border-t border-white/5 bg-slate-950/30 flex items-center justify-between px-6 sm:px-12 text-[10px] text-slate-500 relative z-10">
        <span>© 2026 InfraSight Platform. All rights reserved.</span>
        <span className="font-mono uppercase tracking-wider text-[8px] bg-slate-900 border border-white/5 rounded px-1.5 py-0.5">Sprint: Refactoring v2.0</span>
      </footer>

    </div>
  );
}
