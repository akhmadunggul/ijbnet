import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import type { LoginResponse, MfaRequiredResponse, User } from '@ijbnet/shared';

type LoginStep = 'credentials' | 'mfa';

export const ROLE_REDIRECTS: Record<string, string> = {
  candidate: '/portal/dashboard',
  admin: '/admin/dashboard',
  manager: '/manager/candidates',
  recruiter: '/recruiter/selection',
  super_admin: '/superadmin/dashboard',
};

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: { email: string; password: string; totpCode?: string } = { email, password };
      if (step === 'mfa') payload.totpCode = totpCode;

      const res = await api.post<LoginResponse | MfaRequiredResponse>('/auth/login', payload);

      if ('requiresMfa' in res.data && res.data.requiresMfa) {
        setStep('mfa');
        setLoading(false);
        return;
      }

      const { accessToken, user } = res.data as LoginResponse;
      login(accessToken, user as User);
      navigate(ROLE_REDIRECTS[user.role] ?? '/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const code = axiosErr.response?.data?.error;
      setError(code === 'INVALID_CREDENTIALS' ? t('loginError') : t('loginError'));
    } finally {
      setLoading(false);
    }
  }

  function toggleLang() {
    i18n.changeLanguage(i18n.language === 'id' ? 'ja' : 'id');
  }

  return (
    <div className="min-h-screen bg-navy-50 flex items-center justify-center p-4">
      {/* Language toggle */}
      <button
        onClick={toggleLang}
        className="fixed top-4 right-4 text-sm font-medium text-navy-700 bg-white border border-navy-100 rounded-full px-3 py-1 hover:bg-navy-50 transition"
      >
        {i18n.language === 'id' ? '日本語' : 'Indonesia'}
      </button>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl text-navy-900">IJBNet</h1>
          <p className="text-sm text-navy-500 mt-1">SSW Placement Platform</p>
        </div>

        {/* Google OAuth */}
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-3 w-full border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 transition text-sm font-medium text-gray-700"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          {t('loginGoogle')}
        </a>

        {/* Divider */}
        <div className="flex items-center my-6 gap-3">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400">{t('loginDivider')}</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 'credentials' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('loginEmail')}</label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="admin@ijbnet.org"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('loginPassword')}</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
            </>
          )}

          {step === 'mfa' && (
            <div>
              <p className="text-sm text-gray-600 mb-3">{t('loginTotp')}</p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                required
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-navy-500"
                placeholder="000000"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-navy-700 hover:bg-navy-900 text-white font-medium rounded-lg py-2.5 text-sm transition disabled:opacity-60"
          >
            {loading ? t('loggingIn') : t('loginSubmit')}
          </button>
        </form>
      </div>
    </div>
  );
}

// Handles the redirect from Google OAuth: /auth/callback?token=...
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    const oauthError = searchParams.get('error');

    if (oauthError || !token) {
      navigate('/auth/login?error=oauth_failed', { replace: true });
      return;
    }

    // Fetch user profile using the access token received from Google OAuth
    axios
      .get<{ user: User }>('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      })
      .then(({ data }) => {
        login(token, data.user);
        navigate(ROLE_REDIRECTS[data.user.role] ?? '/auth/login', { replace: true });
      })
      .catch(() => {
        navigate('/auth/login?error=oauth_failed', { replace: true });
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
      Completing sign-in…
    </div>
  );
}
