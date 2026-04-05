import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface MeResponse {
  user: { id: string; email: string; mfaEnabled?: boolean };
}

interface MfaSetupResponse {
  secret: string;
  otpAuthUrl: string;
  qrCodeBase64: string;
}

const ENV_VARS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'ENCRYPTION_KEY',
  'JWT_SECRET',
  'SMTP_HOST',
  'YOUTUBE_API_KEY',
  'REDIS_URL',
];

export default function SuperAdminSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // MFA setup flow
  const [mfaSetup, setMfaSetup] = useState<MfaSetupResponse | null>(null);
  const [totpInput, setTotpInput] = useState('');
  const [disableTotpInput, setDisableTotpInput] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');

  const { data: meData } = useQuery<MeResponse>({
    queryKey: ['auth-me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
  });

  const mfaActive = Boolean((meData?.user as Record<string, unknown> | undefined)?.['mfaEnabled'] ?? (meData?.user as Record<string, unknown> | undefined)?.['mfaSecret']);

  const setupMutation = useMutation({
    mutationFn: (): Promise<MfaSetupResponse> => api.get('/auth/mfa/setup').then((r) => r.data),
    onSuccess: (d) => { setMfaSetup(d); setMfaError(''); },
    onError: () => setMfaError(t('toastError')),
  });

  const verifyMutation = useMutation({
    mutationFn: () => api.post('/auth/mfa/verify', { secret: mfaSetup?.secret, totp: totpInput }),
    onSuccess: (r) => {
      setBackupCodes((r.data as { backupCodes: string[] }).backupCodes);
      setMfaSetup(null);
      setTotpInput('');
      setMfaSuccess(t('superadmin.settings.mfaSuccess'));
      void qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: () => setMfaError('Invalid TOTP code.'),
  });

  const disableMutation = useMutation({
    mutationFn: () => api.delete('/auth/mfa', { data: { totp: disableTotpInput } }),
    onSuccess: () => {
      setDisableTotpInput('');
      setMfaSuccess('MFA disabled.');
      void qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: () => setMfaError('Invalid TOTP code.'),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900">{t('superadmin.settings.title')}</h1>

      {/* Env config status (read-only) */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('superadmin.settings.envStatus')}</h2>
        <div className="space-y-2">
          {ENV_VARS.map((varName) => (
            <div key={varName} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-sm font-mono text-gray-700">{varName}</span>
              <span className="text-xs font-medium text-gray-400 italic">
                {t('superadmin.settings.envMissing')} — check server environment
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Environment variable status is managed server-side. Check your .env file or container environment.
        </p>
      </div>

      {/* MFA Setup */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">{t('superadmin.settings.mfaSetup')}</h2>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
              mfaActive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {mfaActive ? '✓' : '⚠'} {mfaActive ? t('superadmin.settings.mfaActive') : t('superadmin.settings.mfaInactive')}
          </span>
        </div>

        {mfaSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg mb-4">
            ✓ {mfaSuccess}
          </div>
        )}

        {backupCodes && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-xs font-medium text-amber-700 mb-3">
              ⚠️ {t('superadmin.settings.backupCodesWarning')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code) => (
                <code key={code} className="text-sm font-mono bg-white border border-amber-200 rounded px-2 py-1 text-center">
                  {code}
                </code>
              ))}
            </div>
            <button
              onClick={() => setBackupCodes(null)}
              className="mt-3 text-xs text-amber-700 underline"
            >
              I have saved these codes
            </button>
          </div>
        )}

        {!mfaActive && !mfaSetup && (
          <button
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
          >
            {setupMutation.isPending ? '…' : `+ ${t('superadmin.settings.mfaSetup')}`}
          </button>
        )}

        {mfaSetup && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('superadmin.settings.mfaScanQr')}</p>
            <img
              src={mfaSetup.qrCodeBase64}
              alt="MFA QR Code"
              className="w-44 h-44 border border-gray-200 rounded-lg"
            />
            <div className="text-xs font-mono bg-gray-50 border border-gray-200 rounded p-2 break-all">
              {mfaSetup.secret}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                {t('superadmin.settings.mfaEnterCode')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpInput}
                  onChange={(e) => setTotpInput(e.target.value)}
                  placeholder="000000"
                  className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => verifyMutation.mutate()}
                  disabled={totpInput.length !== 6 || verifyMutation.isPending}
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {verifyMutation.isPending ? '…' : t('superadmin.settings.mfaVerify')}
                </button>
                <button
                  onClick={() => { setMfaSetup(null); setTotpInput(''); }}
                  className="border border-gray-200 text-sm px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  {t('btnCancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {mfaActive && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">{t('superadmin.settings.mfaDisableConfirm')}</p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableTotpInput}
                onChange={(e) => setDisableTotpInput(e.target.value)}
                placeholder="000000"
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button
                onClick={() => disableMutation.mutate()}
                disabled={disableTotpInput.length !== 6 || disableMutation.isPending}
                className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {disableMutation.isPending ? '…' : t('superadmin.settings.mfaDisable')}
              </button>
            </div>
          </div>
        )}

        {mfaError && <p className="text-xs text-red-600 mt-2">{mfaError}</p>}
      </div>
    </div>
  );
}
