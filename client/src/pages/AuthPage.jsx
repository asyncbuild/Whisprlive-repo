import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import Brand from '../components/Brand';
import { ArrowRight, Loader2, ShieldCheck, RefreshCw, Eye, EyeOff, Check } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Compute password strength metrics for signup
  const passwordStrength = useMemo(() => {
    const pass = formData.password || '';
    if (!pass) {
      return {
        score: 0,
        label: '',
        color: '',
        bars: 0,
        tip: '',
        isStrong: false,
        criteria: { minLength: false, hasUpper: false, hasLower: false, hasNumber: false, hasSpecial: false }
      };
    }

    const criteria = {
      minLength: pass.length >= 8,
      hasUpper: /[A-Z]/.test(pass),
      hasLower: /[a-z]/.test(pass),
      hasNumber: /\d/.test(pass),
      hasSpecial: /[^a-zA-Z0-9]/.test(pass)
    };

    let metCount = 0;
    if (criteria.minLength) metCount++;
    if (criteria.hasUpper && criteria.hasLower) metCount++;
    if (criteria.hasNumber) metCount++;
    if (criteria.hasSpecial) metCount++;

    const isStrong = criteria.minLength && criteria.hasUpper && criteria.hasLower && criteria.hasNumber && criteria.hasSpecial;

    if (!criteria.minLength || metCount <= 1) {
      return { score: 1, label: 'Weak', color: '#EF4444', bars: 1, tip: 'Requires 8+ chars & variety', isStrong: false, criteria };
    }
    if (metCount === 2) {
      return { score: 2, label: 'Fair', color: '#F59E0B', bars: 2, tip: 'Add missing requirements below', isStrong: false, criteria };
    }
    if (metCount === 3 || !isStrong) {
      return { score: 3, label: 'Good', color: '#3B82F6', bars: 3, tip: 'Almost strong! Fulfill all rules below', isStrong: false, criteria };
    }
    return { score: 4, label: 'Strong', color: '#10B981', bars: 4, tip: 'Strong password!', isStrong: true, criteria };
  }, [formData.password]);

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
      if (!passwordStrength.isStrong) {
        setError('Please create a strong password that fulfills all requirements below before continuing.');
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
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{ paddingRight: '40px', width: '100%' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'var(--text-faint)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {isSignup && formData.password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, height: 4, marginBottom: 6 }}>
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          style={{
                            flex: 1,
                            height: '100%',
                            borderRadius: 2,
                            backgroundColor:
                              bar <= passwordStrength.bars ? passwordStrength.color : 'var(--border)',
                            transition: 'background-color 0.25s ease'
                          }}
                        />
                      ))}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11,
                        color: 'var(--text-faint)',
                        marginBottom: 8
                      }}
                    >
                      <span>
                        Strength:{' '}
                        <span style={{ color: passwordStrength.color, fontWeight: 600 }}>
                          {passwordStrength.label}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: passwordStrength.isStrong ? 'var(--success)' : 'var(--text-faint)'
                        }}
                      >
                        {passwordStrength.isStrong ? '✓ Ready to continue' : 'Strong password required'}
                      </span>
                    </div>

                    {/* Requirements checklist */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '6px',
                        background: 'var(--surface-2)',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11
                      }}
                    >
                      {[
                        { met: passwordStrength.criteria.minLength, label: '8+ characters' },
                        { met: passwordStrength.criteria.hasUpper, label: 'Uppercase (A-Z)' },
                        { met: passwordStrength.criteria.hasLower, label: 'Lowercase (a-z)' },
                        { met: passwordStrength.criteria.hasNumber, label: 'Number (0-9)' },
                        { met: passwordStrength.criteria.hasSpecial, label: 'Symbol (!@#$...)' }
                      ].map((req, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            color: req.met ? 'var(--success)' : 'var(--text-faint)',
                            transition: 'color 0.2s ease',
                            fontWeight: req.met ? 600 : 400
                          }}
                        >
                          {req.met ? (
                            <Check size={13} strokeWidth={2.5} style={{ color: 'var(--success)' }} />
                          ) : (
                            <span style={{ display: 'inline-block', width: 13, textAlign: 'center', fontSize: 10 }}>•</span>
                          )}
                          <span>{req.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isSignup && (
                <div className="field">
                  <label>Confirm password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      style={{ paddingRight: '40px', width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex="-1"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--text-faint)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                      Passwords do not match
                    </div>
                  )}
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
