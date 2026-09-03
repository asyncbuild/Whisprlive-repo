import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import Brand from '../components/Brand';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { useToast } from '../context/ToastContext';

import AuthGoogleButton from '../components/AuthGoogleButton';

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const isSignup = mode === 'signup';
  const { user, token, login } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (token || localStorage.getItem('pulse_token')) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignup && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      if (isSignup) {
        await API.post('/signup', {
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password
        });
        toast.success('Account created successfully! Please sign in.');
        navigate('/signin');
      } else {
        const res = await API.post('/signin', {
          email: formData.email.trim(),
          password: formData.password
        });
        if (login) login(res.data.user, res.data.token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <button className="icon-btn auth-back" onClick={() => navigate('/')}>
        <ArrowRight size={16} style={{ transform: "rotate(180deg)" }} />
      </button>
      <div className="auth-card">
        <div className="auth-head">
          <Brand onClick={() => navigate('/')} />
          <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p>{isSignup ? "Start hosting live sessions in under a minute." : "Sign in to get back to your sessions."}</p>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            marginBottom: '16px',
            borderRadius: '8px',
            backgroundColor: '#FFECE5',
            color: '#FF5A36',
            fontSize: '13.5px',
            fontWeight: 500,
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <AuthGoogleButton />

        <div style={{ display: "flex", alignItems: "center", margin: "18px 0", color: "var(--text-faint)", fontSize: 12 }}>
          <div style={{ flex: 1, borderBottom: "1px solid var(--border)" }} />
          <span style={{ padding: "0 10px", fontWeight: 600 }}>OR EMAIL</span>
          <div style={{ flex: 1, borderBottom: "1px solid var(--border)" }} />
        </div>

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <div className="field">
              <label>Full name</label>
              <input
                type="text"
                placeholder="Ada Chen"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
          )}
          <div className="field">
            <label>Email</label>
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
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          {isSignup && (
            <div className="field">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={loading}>
            {loading ? (
              <>Processing... <Loader2 size={16} className="spin" /></>
            ) : (
              <>{isSignup ? "Sign up" : "Sign in"} <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div className="auth-foot" style={{ marginTop: 16 }}>
          {isSignup ? (
            <>Already have an account? <Link to="/signin">Sign in</Link></>
          ) : (
            <>New to WhisprLive? <Link to="/signup">Create an account</Link></>
          )}
        </div>
      </div>
    </div>
  );
}
