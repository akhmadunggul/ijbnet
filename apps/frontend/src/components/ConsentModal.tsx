import { useState } from 'react';
import { api } from '../lib/api';

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function ConsentModal({ onAccept }: ConsentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [declined, setDeclined] = useState(false);

  async function handleAccept() {
    setLoading(true);
    setError('');
    try {
      await api.patch('/candidates/me/consent');
      onAccept();
    } catch (err) {
      console.error('[ConsentModal] failed to record consent:', err);
      setError('Failed to record consent. Please try again.');
      setLoading(false);
    }
  }

  function handleDecline() {
    setDeclined(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-xl font-semibold text-navy-900 mb-2">Data Consent</h2>
        <div className="text-sm text-gray-600 leading-relaxed space-y-3 mb-6">
          <p>
            IJBNet mengumpulkan dan memproses data pribadi Anda semata-mata untuk keperluan
            penempatan SSW ke Jepang, sesuai UU PDP 2022 (Indonesia) dan APPI (Jepang).
          </p>
          <p className="text-xs text-gray-400 italic">
            IJBNetはSSW就労目的のみでお客様の個人情報を収集・処理します（インドネシアUU PDP 2022・日本APPI準拠）。
          </p>
          <p>
            Data Anda tidak akan dibagikan kepada pihak ketiga di luar proses rekrutmen yang
            telah Anda setujui.
          </p>
          <p>
            Anda berhak untuk mengakses, mengoreksi, dan menghapus data Anda kapan saja
            melalui pengaturan akun.
          </p>
        </div>
        {declined && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            You must agree to the data consent to use IJBNet.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium bg-navy-700 hover:bg-navy-900 text-white rounded-lg transition disabled:opacity-60"
          >
            {loading ? '…' : 'Agree'}
          </button>
        </div>
      </div>
    </div>
  );
}
