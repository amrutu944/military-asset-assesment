import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import API from '../api/axios';
import { ACCESS } from '../lib/constants';
import { storage } from '../lib/storage';

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const token = storage.get('token');
    const user = JSON.parse(storage.get('user') || 'null');
    return token && user ? user : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);

  const clear = useCallback(() => {
    storage.remove('token');
    storage.remove('user');
    setUser(null);
  }, []);

  useEffect(() => {
    const onExpired = () => {
      clear();
      toast.error('Session expired — please sign in again');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [clear]);

  const login = async (email, password) => {
    try {
      const res = await API.post('/auth/login', { email, password });
      storage.set('token', res.data.token);
      storage.set('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      toast.success(`Welcome, ${res.data.user.name}`);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message
        || (error.code === 'ECONNABORTED' ? 'Server is waking up — please try again' : 'Unable to reach the server');
      return { success: false, message };
    }
  };

  const logout = () => {
    clear();
    toast.success('Signed out');
  };

  const can = (section) => !!user && (ACCESS[section] || []).includes(user.role);

  const value = {
    user,
    login,
    logout,
    can,
    isLoggedIn: !!user,
    isAdmin: user?.role === 'admin',
    isCommander: user?.role === 'base_commander',
    isLogistics: user?.role === 'logistics_officer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
