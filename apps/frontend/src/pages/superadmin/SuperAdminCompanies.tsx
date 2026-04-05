import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface CompanyRow {
  id: string;
  name: string;
  nameJa: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  recruiterCount?: number;
}

interface DrawerProps {
  company: CompanyRow | null;
  onClose: () => void;
}

function CompanyDrawer({ company, onClose }: DrawerProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: company?.name ?? '',
    nameJa: company?.nameJa ?? '',
    contactPerson: company?.contactPerson ?? '',
    email: company?.email ?? '',
    phone: company?.phone ?? '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        nameJa: form.nameJa || null,
        contactPerson: form.contactPerson || null,
        email: form.email || null,
        phone: form.phone || null,
      };
      if (company) {
        return api.put(`/superadmin/companies/${company.id}`, body).then((r) => r.data);
      }
      return api.post('/superadmin/companies', body).then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin-companies'] });
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
            {company ? t('superadmin.companies.edit') : t('superadmin.companies.create')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {[
            { key: 'name', label: `${t('superadmin.companies.colName')} *` },
            { key: 'nameJa', label: t('superadmin.companies.nameJa') },
            { key: 'contactPerson', label: t('superadmin.companies.contactPerson') },
            { key: 'email', label: t('dpEmail') },
            { key: 'phone', label: t('superadmin.companies.phone') },
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

export default function SuperAdminCompanies() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState<CompanyRow | null | 'new'>(null);

  const { data, isLoading } = useQuery<{ companies: CompanyRow[] }>({
    queryKey: ['superadmin-companies'],
    queryFn: () => api.get('/superadmin/companies').then((r) => r.data),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/superadmin/companies/${id}/deactivate`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['superadmin-companies'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.companies.title')}</h1>
        <button
          onClick={() => setDrawer('new')}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition"
        >
          + {t('superadmin.companies.create')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">{t('loading')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.companies.colName')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.companies.colNameJa')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.companies.colContact')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.companies.colEmail')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.companies.colRecruiters')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.companies.colActive')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data?.companies ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.nameJa ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.contactPerson ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-center">{c.recruiterCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {c.isActive ? '✓' : '✗'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setDrawer(c)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        {t('btnEdit')}
                      </button>
                      {c.isActive && (
                        <button
                          onClick={() => confirm(`Deactivate ${c.name}?`) && deactivateMutation.mutate(c.id)}
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
        <CompanyDrawer
          company={drawer === 'new' ? null : drawer}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
