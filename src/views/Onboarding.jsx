import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Mail, Send, Grid3X3, Sparkle, User, Lock, Loader, Check, Copy, Share2, Eye, EyeOff, CheckCircle, Link, Gamepad2, Monitor, Zap } from 'lucide-react';
import { RetroButton, RetroWindow, RetroInput, useToast, ConfirmDialog } from '../components/UI.jsx';
import { supabase } from '../lib/supabase.js';
import { isTestMode } from '../lib/testMode.js';
import { useAuth } from '../context/instances.js';
import { LegalView } from './LegalView.jsx';

/* ═══════════════════════════════════════════════════════
   LANDING PAGE — cute & animated with floating elements
   ═══════════════════════════════════════════════════════ */
export function LandingView() {
  const navigate = useNavigate();
  const onTryYard = () => navigate('/signin');
  const onSignIn = () => navigate('/signup');
  return (
    <div className="h-[100dvh] w-full flex flex-col relative overflow-hidden text-main-text selection:bg-primary selection:text-white">

      <nav className="relative z-10 flex items-center justify-between px-5 py-3 sm:px-10 sm:py-4 shrink-0">
        <span className="font-bold text-[10px] tracking-widest uppercase text-main-text opacity-30 select-none">●●●</span>
        <span className="font-bold text-[10px] tracking-widest uppercase text-main-text opacity-30 select-none">yard</span>
      </nav>

      {/* HERO SECTION — fills remaining height */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center min-h-0">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[10%] left-[5%] text-primary opacity-[0.08] animate-float"><Gamepad2 size={70} /></div>
          <div className="absolute top-[60%] right-[8%] text-primary opacity-[0.06] animate-float-delayed"><Gamepad2 size={45} /></div>
          <div className="absolute bottom-[15%] left-[45%] text-primary opacity-[0.04] animate-float"><Gamepad2 size={35} /></div>
          <div className="absolute top-[25%] right-[15%] text-secondary opacity-[0.1] animate-float-delayed"><Monitor size={56} /></div>
          <div className="absolute bottom-[25%] left-[12%] text-secondary opacity-[0.07] animate-float"><Monitor size={44} /></div>
          <div className="absolute bottom-[35%] right-[22%] text-primary opacity-[0.12] animate-float-delayed"><Zap size={48} /></div>
          <div className="absolute top-[30%] left-[15%] text-primary opacity-[0.08] animate-float"><Zap size={38} className="rotate-[-15deg]" /></div>
          <div className="absolute bottom-[10%] right-[35%] text-accent opacity-[0.06] animate-float"><Grid3X3 size={60} /></div>
          <div className="absolute top-[55%] left-[8%] text-secondary opacity-[0.05] animate-float"><Sparkle size={40} /></div>
        </div>

        <div className="relative mb-3 sm:mb-5 transform-gpu hover:scale-105 transition-transform duration-500 flex items-center justify-center">
          <div className="absolute -inset-10 bg-primary/10 blur-[60px] rounded-full animate-pulse" />
          <h1 className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter text-primary drop-shadow-[0_10px_20px_rgba(233,69,96,0.3)] animate-float lowercase">
            yard
          </h1>
        </div>

        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 z-10">
          <p className="text-xs sm:text-base font-mono text-muted-text max-w-sm mx-auto leading-relaxed">
            A retro gaming corner of the internet, <br/> <span className="text-primary font-bold">for you and your guild</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <RetroButton size="lg" onClick={onTryYard} className="w-52 relative overflow-hidden group shadow-[4px_4px_0_var(--border)]">
              <span className="relative z-10 font-bold">enter yard</span>
            </RetroButton>
            <RetroButton size="lg" variant="white" onClick={onSignIn} className="w-52 opacity-80 hover:opacity-100 shadow-[4px_4px_0_var(--border)]">
              <span className="font-bold">start new journey</span>
            </RetroButton>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-3 text-center shrink-0">
        <button 
          onClick={() => navigate('/legal')}
          className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
        >
          Terms of Service / Privacy
        </button>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   AUTH VIEW — Login & Signup with 3D Depth
   ═══════════════════════════════════════════════════════ */
export function AuthView({ mode }) {
  const navigate = useNavigate();
  const { user, roomId, roomLoading, handleAuthSuccess } = useAuth();
  const [email, setEmail] = useState(() => localStorage.getItem('yard_remembered_email') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('yard_remembered_email'));
  const [authError, setAuthError] = useState(null);
  const [shake, setShake] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const addToast = useToast();

  const turnstileContainerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Add Turnstile script if not already present
    if (!document.getElementById('turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  /* Captcha temporarily disabled
  useEffect(() => {
    let retries = 0;
    const renderWidget = () => {
      if (window.turnstile && turnstileContainerRef.current) {
        // Clear any existing widget first to prevent duplicates
        if (widgetIdRef.current !== null) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch (e) {}
          widgetIdRef.current = null;
        }
        if (turnstileContainerRef.current) {
          turnstileContainerRef.current.innerHTML = '';
        }

        try {
          const isLocal = typeof window !== 'undefined' && 
            (window.location.hostname === 'localhost' || 
             window.location.hostname === '127.0.0.1' || 
             window.location.hostname.startsWith('192.168.'));

          const sitekey = isLocal 
            ? '1x00000000000000000000AA' 
            : (import.meta.env.VITE_TURNSTILE_SITEKEY || '0x4AAAAAADdzhyrg4kvhvTW3');
          
          // Render into a new child div to avoid React/DOM collision
          const el = document.createElement('div');
          turnstileContainerRef.current.appendChild(el);

          widgetIdRef.current = window.turnstile.render(el, {
            sitekey,
            callback: (token) => {
              setCaptchaToken(token);
            },
          });
        } catch (e) {
          console.error("Turnstile render error", e);
        }
      } else if (retries < 50) {
        retries++;
        timeoutRef.current = setTimeout(renderWidget, 100);
      } else {
        console.warn("Turnstile failed to load after 5 seconds");
      }
    };

    renderWidget();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {}
        widgetIdRef.current = null;
      }
      setCaptchaToken(null);
    };
  }, [mode]);
  */

  const onBack = () => navigate('/');

  // Paired users should never land on auth pages — send them straight home
  if (user && roomId) return <Navigate to="/dashboard" replace />;
  // A paired user whose room is still loading — don't flash the form
  if (user && roomLoading) return null;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };


  const startAuthFlow = (e) => {
    e.preventDefault();
    // Terms agreement is only required for new accounts
    if (mode === 'signup' && !termsAgreed) {
        setShowLegal(true);
        return;
    }
    handleAuth();
  };

  const handleAuth = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      if (mode === 'signup') {
        const authOptions = { data: { name } };
        const { data, error } = await supabase.auth.signUp({ 
            email, password, options: authOptions 
        });
        if (error) {
           if (error.message.toLowerCase().includes('already registered')) {
             throw new Error('An account with this email already exists. Try signing in instead!');
           }
           throw error;
        }
        
        if (data.user && !data.session) {
          addToast("Verification email sent! Please check your inbox before logging in.", "success");
          navigate('/signin');
          return;
        }

        if (rememberMe) localStorage.setItem('yard_remembered_email', email);
        else localStorage.removeItem('yard_remembered_email');

        addToast("Welcome! Yard is ready.", "success");
        handleAuthSuccess(data.session);
        navigate('/dashboard');
      } else {
        const authOptions = {};
        const { data, error } = await supabase.auth.signInWithPassword({ 
            email, password, options: authOptions 
        });
        if (error) {
           if (error.message.includes('Email not confirmed')) {
              throw new Error('Please verify your email before logging in. Check your inbox!');
           }
           throw error;
        }
        
        if (rememberMe) localStorage.setItem('yard_remembered_email', email);
        else localStorage.removeItem('yard_remembered_email');

        handleAuthSuccess(data.session);
        navigate('/dashboard');
      }
    } catch (err) { 
      triggerShake();
      setAuthError(err.message);
      addToast(err.message, "error"); 
    }
    finally { 
      setLoading(false);
      if (window.turnstile) {
        try {
          window.turnstile.reset();
        } catch (e) {}
      }
      setCaptchaToken(null);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message);
      addToast(err.message, "error");
      setLoading(false);
    }
  };

  const handleMagicLinkLogin = async () => {
    if (!email) {
      addToast('Please enter an email address first', 'error');
      return;
    }
    
    setLoading(true);
    setAuthError(null);
    try {
      const authOptions = {
        emailRedirectTo: `${window.location.origin}/dashboard`
      };
      if (captchaToken) {
        authOptions.captchaToken = captchaToken;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: authOptions
      });
      
      if (error) throw error;
      
      setLinkSent(true);
      addToast('Magic link sent!', 'success');
    } catch (err) {
      setAuthError(err.message);
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
      if (window.turnstile) {
        try {
          window.turnstile.reset();
        } catch (e) {}
      }
      setCaptchaToken(null);
    }
  };

  if (linkSent) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center p-4">
        <RetroWindow title="transmission_sent.exe" className="w-full max-w-[440px] shadow-2xl" onClose={onBack} noPadding>
          <div className="p-6 flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300 py-8 text-center">
            <CheckCircle size={48} className="text-primary animate-bounce" />
            <h2 className="text-2xl font-black uppercase tracking-widest text-main-text">Check your inbox</h2>
            <p className="text-sm opacity-70">We sent a magic link to <strong>{email}</strong>.<br/>Click it to instantly enter the Yard.</p>
            <RetroButton size="sm" variant="secondary" onClick={() => setLinkSent(false)} className="mt-4">
              Try a different email
            </RetroButton>
          </div>
        </RetroWindow>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4">

      <RetroWindow 
        title={`${mode === 'signup' ? 'join yard' : 'welcome back'}.exe`} 
        className={`w-full max-w-[440px] shadow-2xl scale-up-15 ${shake ? 'animate-shake' : ''}`} 
        onClose={onBack}
        noPadding
      >
        <div className="p-[20px] w-full max-w-[390px] mx-auto">
        <form onSubmit={startAuthFlow} className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1 mb-1">
            <h2 className="text-4xl sm:text-[40px] font-black tracking-tighter text-primary lowercase text-center leading-none">
              {mode === 'signup' ? 'join yard' : 'welcome back'}
            </h2>
          </div>

          {mode === 'signup' ? (
            <>
              <RetroInput 
                label="display name"
                icon={User}
                placeholder="alex"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
                className="focus:ring-2 focus:ring-primary/50"
              />

              <RetroInput 
                label="email"
                icon={Mail}
                type="email"
                placeholder="you@love.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              <RetroInput 
                label="password"
                icon={Lock}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />

              <p className="text-[10px] leading-relaxed text-muted-text mt-1">
                By creating an account, you agree to the <button type="button" onClick={() => setShowLegal(true)} className="text-primary underline cursor-pointer">Terms of Service</button> and acknowledge the privacy rules.
              </p>

              <div ref={turnstileContainerRef} className="flex justify-center mt-2"></div>

              <RetroButton size="lg" type="submit" disabled={loading} className="w-full mt-2">
                {loading ? <Loader className="animate-spin" /> : 'create account'}
              </RetroButton>
            </>
          ) : (
            <>
              <RetroInput 
                label="email"
                icon={Mail}
                type="email"
                placeholder="you@love.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />

              <div className="space-y-1">
                <RetroInput 
                  label="password"
                  icon={Lock}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <div className="flex justify-between items-center mt-1 px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 border-2 border-border accent-primary cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-muted-text group-hover:text-main-text lowercase">remember me</span>
                  </label>
                  <a href="/password-reset" className="text-[10px] font-bold text-muted-text hover:text-primary transition-colors lowercase">forgot password?</a>
                </div>
              </div>

              <div ref={turnstileContainerRef} className="flex justify-center mt-2"></div>

              <RetroButton size="lg" type="submit" disabled={loading} className="w-full mt-4">
                {loading ? <Loader className="animate-spin" /> : 'enter yard'}
              </RetroButton>
            </>
          )}

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-border opacity-20"></div>
            <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-muted-text uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-border opacity-20"></div>
          </div>

          <div className="flex gap-3 w-full justify-center items-center py-1">
            <RetroButton type="button" size="lg" variant="custom" onClick={() => handleOAuthLogin('google')} aria-label="Google" className="flex-1 bg-white hover:bg-gray-100 text-gray-800 border-gray-300">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            </RetroButton>
            <RetroButton type="button" size="lg" variant="primary" onClick={handleMagicLinkLogin} aria-label="Magic Link" className="flex-1">
              <Link size={20} />
            </RetroButton>
            <RetroButton type="button" size="lg" variant="custom" onClick={() => handleOAuthLogin('facebook')} aria-label="Facebook" className="flex-1 bg-[#1877F2] hover:bg-[#166FE5] text-white border-[#0c4b9e]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z"/></svg>
            </RetroButton>
          </div>
        </form>
        </div>
      </RetroWindow>

      {showLegal && (
        <LegalView 
          isOverlay 
          onClose={() => setShowLegal(false)} 
          onAccept={() => {
            setTermsAgreed(true);
            setShowLegal(false);
            // If they are in the middle of a flow, we could trigger auth here but 
            // since it's a form submit, we'll let them click the button again or 
            // handle it automatically.
            // Actually, let's trigger it automatically if they accepted.
            setTimeout(() => handleAuth(), 100);
          }} 
        />
      )}
    </div>
  );
}

