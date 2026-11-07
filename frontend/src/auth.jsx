import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'tracker.user';

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStored);
  const [checking, setChecking] = useState(() => Boolean(readStored()));

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setUser(null);
  }, []);

  const save = useCallback((value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {}
    setUser(value);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
  }, [clear]);

  useEffect(() => {
    if (!readStored()) return;
    api.projects
      .list()
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(
    async ({ email, password }) => {
      const data = await api.auth.login({ email, password });
      save({ id: data.id, name: data.name, email: data.email, role: data.role });
    },
    [save],
  );

  const register = useCallback(
    async ({ name, email, password, role }) => {
      await api.auth.register({ name, email, password, role });
      await login({ email, password });
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo(
    () => ({ user, checking, login, register, logout }),
    [user, checking, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
