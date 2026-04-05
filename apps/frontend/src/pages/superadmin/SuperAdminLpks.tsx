import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface AdminUser { id: string; name: string; email: string }
interface LpkRow {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  assignedAdmin: string | null;
  adminUser?: AdminUser | null;
}

interface DrawerProps {
  lpk: LpkRow | null;
  adminUsers: AdminUser[];
  onClose: () => void;
}

function LpkDrawer({ lpk, adminUsers, onClose }: DrawerProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: lpk?.name ?? '',
    city: lpk?.city ?? '',
    province: lpk?.province ?? '',
    contactPerson: lpk?.contactPerson ?? '',
    email: lpk?.email ?? '',
    phone: lpk?.phone ?? '',
    assignedAdmin: lpk?.assignedAdmin ?? '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        city: form.city || null,
        province: form.province || null,
        contactPerson: form.contactPerson || null,
        email: form.email || null,
        phone: form.phone || null,
        assignedAdmin: form.assignedAdmin || null,
      };
      if (lpk) return api.put(`/superadmin/lpks/${lpk.id}`, body).then((r) => r.data);
      return api.post('/superadmin/lpks', body).then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin-lpks'] });
      onClose();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('toastError'));
    },
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">
            {lpk ? t('superadmin.lpks.edit') : t('superadmin.lpks.create')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {[
            { key: 'name', label: `${t('superadmin.lpks.colName')} *` },
            { key: 'city', label: t('superadmin.lpks.city') },
            { key: 'province', label: t('superadmin.lpks.province') },
            { key: 'contactPerson', label: t('superadmin.lpks.contactPerson') },
            { key: 'email', label: t('dpEmail') },
            { key: 'phone', label: t('superadmin.lpks.phone') },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
              <input
                type="text"
                value={form[key as keyof typeof form]}
                onChange={(e) => set(key, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.lpks.assignedAdmin')}</label>
            <select
              value={form.assignedAdmin}
              onChange={(e) => set('assignedAdmin', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— None —</option>
              {adminUsers.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
            {t('btnCancel')}
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name}
            className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {mutation.isPending ? '…' : t('btnSave')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminLpks() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState<LpkRow | null | 'new'>(null);

  const { data, isLoading } = useQuery<{ lpks: LpkRow[] }>({
    queryKey: ['superadmin-lpks'],
    queryFn: () => api.get('/superadmin/lpks').then((r) => r.data),
  });

  const { data: usersData } = useQuery<{ users: AdminUser[] }>({
    queryKey: ['superadmin-admin-users'],
    queryFn: () => api.get('/superadmin/users?role=admin&isActive=true&pageSize=100').then((r) => r.data),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/superadmin/lpks/${id}/deactivate`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['superadmin-lpks'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.lpks.title')}</h1>
        <button
          onClick={() => setDrawer('new')}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition"
        >
          + {t('superadmin.lpks.create')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">{t('loading')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.lpks.colName')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.lpks.colCity')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.lpks.colProvince')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.lpks.colContact')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.lpks.colAdmin')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.lpks.colActive')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data?.lpks ?? []).map((l) => (
                <tr key={l.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.name}</td>
                  <td className="px-4 py-3 text-gray-500">{l.city ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{l.province ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{l.contactPerson ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {(l.adminUser as AdminUser | null)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${l.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {l.isActive ? '✓' : '✗'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setDrawer(l)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        {t('btnEdit')}
                      </button>
                      {l.isActive && (
                        <button
                          onClick={() => confirm(`Deactivate ${l.name}?`) && deactivateMutation.mutate(l.id)}
                          className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                        >
                          {t('superadmin.users.deactivate')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {drawer !== null && (
        <LpkDrawer
          lpk={drawer === 'new' ? null : drawer}
          adminUsers={usersData?.users ?? []}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
