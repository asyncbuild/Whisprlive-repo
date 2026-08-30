import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('pulse_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('pulse_token');
    if (!saved || saved === '[object Object]' || saved === 'undefined' || saved === 'null') {
      localStorage.removeItem('pulse_token');
      return null;
    }
    return saved;
  });

  const refreshUser = async () => {
    const currentToken = localStorage.getItem('pulse_token');
    if (!currentToken || currentToken === '[object Object]') return;
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
    const validToken = typeof authToken === 'string' ? authToken : null;
    if (validToken) {
      localStorage.setItem('pulse_token', validToken);
      setToken(validToken);
    }
    if (userData) {
      localStorage.setItem('pulse_user', JSON.stringify(userData));
      setUser(userData);
    }
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