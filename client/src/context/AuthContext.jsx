import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('pulse_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('pulse_token') || null);

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await API.get('/api/user/me');
      if (res.data?.user) {
        localStorage.setItem('pulse_user', JSON.stringify(res.data.user));
        setUser(res.data.user);
      }
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  };

  const login = (userData, authToken) => {
    localStorage.setItem('pulse_token', authToken);
    localStorage.setItem('pulse_user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('pulse_token');
    localStorage.removeItem('pulse_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);