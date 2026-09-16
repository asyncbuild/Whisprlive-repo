import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import Brand from '../components/Brand';
import { ArrowRight, Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthGoogleButton from '../components/AuthGoogleButton';

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const isSignup = mode === 'signup';
  const { token, login } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (token || localStorage.getItem('whisprlive_token')) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, navigate]);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Reset error and step when mode changes between signin and signup
  useEffect(() => {
    setStep('form');
    setOtp('');
    setError('');
  }, [mode]);

  // Submit handler: Form step (Signin OR Step 1 of Signup)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignup) {
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignup) {
        // Send OTP to user's email via Resend
        await API.post('/api/auth/send-signup-otp', {
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password
        });
        setStep('otp');
        setResendCooldown(60);
        toast.info('Verification code sent! Please check your email inbox.');
      } else {
        // Direct Email & Password Signin (Option 1)
        const res = await API.post('/signin', {
          email: formData.email.trim(),
          password: formData.password
        });
        if (login) login(res.data.user, res.data.token);
        toast.success(`Welcome back, ${res.data.user?.username || 'Host'}!`);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Action failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Submit handler: OTP Verification step for Signup
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await API.post('/api/auth/verify-signup-otp', {
        email: formData.email.trim(),
        otp: otp.trim()
      });

      if (login) login(res.data.user, res.data.token);
      toast.success('🎉 Account verified and created successfully!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Verification failed. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP code handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError('');

    try {
      await API.post('/api/auth/send-signup-otp', {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password
      });
      setResendCooldown(60);
      toast.success('A fresh verification code has been sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <button className="icon-btn auth-back" onClick={() => navigate('/')} title="Back to home">
        <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} />
      </button>

      <div className="auth-card">
        {/* STEP 1: FORM (SIGNIN or SIGNUP FORM) */}
        {step === 'form' ? (
          <>
            <div className="auth-head">
              <Brand onClick={() => navigate('/')} />
              <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
              <p>
                {isSignup
                  ? 'Start hosting live sessions in under a minute.'
                  : 'Sign in to get back to your sessions.'}
              </p>
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  borderRadius: '8px',
                  backgroundColor: '#FFECE5',
                  color: '#FF5A36',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  textAlign: 'center'
                }}
              >
                {error}
              </div>
            )}

            {/* Google OAuth Button */}
            <AuthGoogleButton />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                margin: '18px 0',
                color: 'var(--text-faint)',
                fontSize: 12
              }}
            >
              <div style={{ flex: 1, borderBottom: '1px solid var(--border)' }} />
              <span style={{ padding: '0 10px', fontWeight: 600 }}>OR EMAIL</span>
              <div style={{ flex: 1, borderBottom: '1px solid var(--border)' }} />
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleSubmit}>
              {isSignup && (
                <div className="field">
                  <label>Full name</label>
                  <input
                    type="text"
                    placeholder="e.g. Alex Rivera"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
              )}

              <div className="field">
                <label>Email address</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              {isSignup && (
                <div className="field">
                  <label>Confirm password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-block"
                style={{ marginTop: 14 }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    Processing... <Loader2 size={16} className="spin" />
                  </>
                ) : (
                  <>
                    {isSignup ? 'Continue to Verify Email' : 'Sign in'} <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-foot" style={{ marginTop: 18 }}>
              {isSignup ? (
                <>
                  Already have an account? <Link to="/signin">Sign in</Link>
                </>
              ) : (
                <>
                  New to WhisprLive? <Link to="/signup">Create an account</Link>
                </>
              )}
            </div>
          </>
        ) : (
          /* STEP 2: EMAIL OTP VERIFICATION (FOR SIGNUP) */
          <>
            <div className="auth-head" style={{ marginBottom: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'rgba(255, 90, 54, 0.12)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px'
                }}
              >
                <ShieldCheck size={28} />
              </div>
              <h1 style={{ fontSize: 22 }}>Verify your email</h1>
              <p style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>
                We sent a 6-digit verification code to:
                <br />
                <strong style={{ color: 'var(--text)' }}>{formData.email}</strong>
              </p>
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  borderRadius: '8px',
                  backgroundColor: '#FFECE5',
                  color: '#FF5A36',
                  fontSize: '13px',
                  fontWeight: 500,
                  textAlign: 'center'
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              <div className="field">
                <label style={{ textAlign: 'center', display: 'block', fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 8 }}>
                  ENTER 6-DIGIT CODE
                </label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  placeholder="------"
                  autoFocus
                  style={{
                    textAlign: 'center',
                    letterSpacing: '10px',
                    fontSize: '24px',
                    fontWeight: '700',
                    fontFamily: 'monospace',
                    height: '52px',
                    borderColor: otp.length === 6 ? 'var(--primary)' : undefined
                  }}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                style={{ marginTop: 16 }}
                disabled={otp.length !== 6 || loading}
              >
                {loading ? (
                  <>
                    Verifying... <Loader2 size={16} className="spin" />
                  </>
                ) : (
                  <>
                    Verify & Create Account <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div
              style={{
                marginTop: 22,
                paddingTop: 16,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                alignItems: 'center',
                fontSize: 13
              }}
            >
              <div style={{ color: 'var(--text-dim)' }}>
                {resendCooldown > 0 ? (
                  <span>Resend code in <strong>{resendCooldown}s</strong></span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 13
                    }}
                  >
                    <RefreshCw size={12} /> Resend verification code
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setOtp('');
                  setError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  textDecoration: 'underline'
                }}
              >
                Wrong email address? Change details
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
