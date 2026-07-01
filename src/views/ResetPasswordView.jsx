import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader, Check } from 'lucide-react';
import { RetroWindow, RetroButton, useToast } from '../components/UI.jsx';
import { supabase } from '../lib/supabase.js';
import { playAudio } from '../utils/audio.js';
import { isTestMode } from '../lib/testMode.js';

export function ResetPasswordView({ sfx }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validToken, setValidToken] = useState(true);
  const toast = useToast();

  const [requestEmail, setRequestEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);

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

  useEffect(() => {
    const renderWidget = () => {
      if (window.turnstile && turnstileContainerRef.current) {
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
          const sitekey = import.meta.env.VITE_TURNSTILE_SITEKEY || '0x4AAAAAADdzhyrg4kvhvTW3';
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
      } else if (!validToken && !requestSent) {
        timeoutRef.current = setTimeout(renderWidget, 100);
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
  }, [validToken, requestSent]);

  useEffect(() => {
    const code = searchParams.get('code');
    const hash = window.location.hash;
    const hasTokenInHash = hash && (hash.includes('access_token=') || hash.includes('type=recovery'));
    
    if (!code && !hasTokenInHash) {
      setValidToken(false);
    } else {
      setValidToken(true);
    }
  }, [searchParams]);

  const validatePassword = () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!captchaToken && !isTestMode()) {
      setError('Please complete the human verification first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const redirectTo = `${window.location.origin}/password-reset`;
      const options = {};
      if (captchaToken) {
        options.captchaToken = captchaToken;
      }
      const { data, error: err } = await supabase.auth.resetPasswordForEmail(requestEmail, { 
        redirectTo,
        options
      });
      if (err) throw err;
      setRequestSent(true);
      if (toast) toast('Reset link sent. Check your inbox.', 'success');
    } catch (err) {
      setError(err.message || 'Failed to request password reset');
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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;
    setLoading(true);
    setError('');
    playAudio('click', sfx);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(err.message || 'Failed to reset password. Try again.');
        setLoading(false);
        return;
      }
      window.history.replaceState(null, '', window.location.pathname);
      setSuccess(true);
      if (toast) toast('Password reset successfully!', 'success');
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-main">
        <RetroWindow title="success.exe" className="w-full max-w-sm" noPadding>
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-none bg-primary flex items-center justify-center">
              <Check size={32} className="text-primary-text" />
            </div>
            <h2 className="text-2xl font-bold text-main-text">Password Reset!</h2>
            <p className="text-sm opacity-70 text-main-text">Your password has been successfully reset.</p>
            <Loader size={20} className="animate-spin text-primary" />
            <RetroButton onClick={() => navigate('/signin')} className="mt-3">remember password? sign in instead</RetroButton>
          </div>
        </RetroWindow>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-main">
        <RetroWindow title="password_reset_request.exe" className="w-full max-w-sm" noPadding onClose={() => navigate('/signin')}>
          <div className="p-6 flex flex-col items-center text-center gap-4 text-main-text">
            <h2 className="text-2xl font-bold">Reset your password</h2>
            <p className="text-sm opacity-70">Enter the email associated with your account to receive a reset link.</p>

            {requestSent ? (
              <div className="p-6 flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300 py-4 text-center mt-2 border-2 border-border bg-window">
                <Check size={48} className="text-primary animate-bounce" />
                <h3 className="text-lg font-black uppercase tracking-widest text-main-text">Email Sent</h3>
                <p className="text-xs opacity-70 font-bold">Check your inbox for the reset link.</p>
              </div>
            ) : (
              <form onSubmit={handleRequestReset} className="w-full">
                <input type="email" required placeholder="you@yard.com" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} className="w-full p-3 border-2 border-border bg-window mb-3" />
                {error && <p className="text-xs text-[var(--color-destructive)] mb-2">{error}</p>}
                <div ref={turnstileContainerRef} className="flex justify-center mb-3"></div>
                <RetroButton type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</RetroButton>
              </form>
            )}

            <button type="button" onClick={() => navigate('/signin')} className="text-xs opacity-60 mt-2 text-center w-full">remember password? sign in instead</button>
          </div>
        </RetroWindow>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-main relative overflow-hidden">
      <div className="absolute inset-0 scanlines pointer-events-none opacity-30" />

      <RetroWindow title="reset_password.exe" className="w-full max-w-sm relative z-10" onClose={() => navigate('/signin')}>
        <form onSubmit={handleResetPassword} className="flex flex-col gap-4 text-main-text">
          <div className="text-center mb-2">
            <div className="w-14 h-14 rounded-none bg-secondary text-secondary-text border-2 border-border mx-auto flex items-center justify-center mb-3 shadow-none">
              <Lock size={22} />
            </div>
            <h2 className="font-bold text-xl lowercase">create new password</h2>
            <p className="text-xs font-bold opacity-50 mt-1">enter a strong new password</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold opacity-60 flex items-center gap-1">
              <Lock size={12} />
              new password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                minLength={6}
                required
                className="p-3 border-2 border-border bg-window text-main-text focus:outline-none text-sm font-bold w-full"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold opacity-60 flex items-center gap-1">
              <Lock size={12} />
              confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                minLength={6}
                required
                className="p-3 border-2 border-border bg-window text-main-text focus:outline-none text-sm font-bold w-full"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs font-bold text-[var(--color-destructive)] text-center border-2 border-red-300 bg-red-50 p-2">
              {error}
            </p>
          )}

          <RetroButton
            type="submit"
            size="lg"
            variant="primary"
            className="w-full mt-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={16} className="animate-spin" /> resetting...
              </>
            ) : (
              <>reset password <Lock size={14} /></>
            )}
          </RetroButton>

          <button
            type="button"
            onClick={() => navigate('/signin')}
            className="text-center text-xs font-bold opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center gap-1 w-full"
          >
            remember password? sign in instead
          </button>
        </form>
      </RetroWindow>
    </div>
  );
}
