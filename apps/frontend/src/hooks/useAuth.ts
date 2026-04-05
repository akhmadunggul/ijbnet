import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

export function useAuth() {
  const store = useAuthStore();
  const navigate = useNavigate();

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore — server may be unreachable
    }
    store.logout();
    navigate('/auth/login');
  }

  return { ...store, logout };
}
