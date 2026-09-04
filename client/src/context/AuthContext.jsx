import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('whisprlive_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('whisprlive_token');
    if (!saved || saved === '[object Object]' || saved === 'undefined' || saved === 'null') {
      localStorage.removeItem('whisprlive_token');
      return null;
    }
    return saved;
  });

  // Sync auth state across multiple browser tabs automatically
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'whisprlive_token') {
        const newToken = e.newValue;
        if (!newToken || newToken === 'null' || newToken === 'undefined') {
          setToken(null);
        } else {
          setToken(newToken);
        }
      }
      if (e.key === 'whisprlive_user') {
        try {
          setUser(e.newValue ? JSON.parse(e.newValue) : null);
        } catch (err) {
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const refreshUser = async () => {
    const currentToken = localStorage.getItem('whisprlive_token');
    if (!currentToken || currentToken === '[object Object]') return;
    try {
      const res = await API.get('/api/user/me');
      if (res.data?.user) {
        localStorage.setItem('whisprlive_user', JSON.stringify(res.data.user));
        setUser(res.data.user);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
      } else {
        console.error('Failed to refresh user', err);
      }
    }
  };

  const login = (userData, authToken) => {
    const validToken = typeof authToken === 'string' ? authToken : null;
    if (validToken) {
      localStorage.setItem('whisprlive_token', validToken);
      setToken(validToken);
    }
    if (userData) {
      localStorage.setItem('whisprlive_user', JSON.stringify(userData));
      setUser(userData);
    }
  };

  const logout = () => {
    localStorage.removeItem('whisprlive_token');
    localStorage.removeItem('whisprlive_user');
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