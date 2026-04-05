import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  company?: { id: string; name: string } | null;
  lpk?: { id: string; name: string } | null;
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface Company { id: string; name: string }
interface Lpk { id: string; name: string }

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  manager: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  recruiter: 'bg-indigo-100 text-indigo-700',
  candidate: 'bg-gray-100 text-gray-700',
};

const ROLES = ['candidate', 'admin', 'manager', 'recruiter', 'super_admin'];

function TempPasswordModal({ password, onClose }: { password: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(password);
    setCopied(true);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">{t('superadmin.users.tempPassword')}</h3>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2 mb-4">
          {t('superadmin.users.savePassword')}
        </p>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">
          <code className="flex-1 font-mono text-sm text-gray-900 select-all">{password}</code>
          <button
            onClick={copy}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {copied ? t('superadmin.users.passwordCopied') : 'Copy'}
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition"
        >
          {t('btnCancel')} — Close
        </button>
      </div>
    </div>
  );
}

interface DrawerProps {
  user: UserRow | null;
  companies: Company[];
  lpks: Lpk[];
  onClose: () => void;
  onSuccess: (tempPassword?: string) => void;
}

function UserDrawer({ user, companies, lpks, onClose, onSuccess }: DrawerProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    email: user?.email ?? '',
    name: user?.name ?? '',
    role: user?.role ?? 'admin',
    password: '',
    companyId: user?.company?.id ?? '',
    lpkId: user?.lpk?.id ?? '',
  });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: form.name,
        role: form.role,
        companyId: form.companyId || undefined,
        lpkId: form.lpkId || undefined,
      };
      if (!user) {
        body['email'] = form.email;
        if (form.password) body['password'] = form.password;
      }
      if (user) {
        const r = await api.put(`/superadmin/users/${user.id}`, body);
        return r.data;
      } else {
        const r = await api.post('/superadmin/users', body);
        return r.data;
      }
    },
    onSuccess: (data: { tempPassword?: string }) => {
      void qc.invalidateQueries({ queryKey: ['superadmin-users'] });
      onSuccess(data?.tempPassword);
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
            {user ? t('superadmin.users.edit') : t('superadmin.users.create')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!user && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">{t('dpEmail')} *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('dpFullName')} *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.users.colRole')} *</label>
            <select
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {form.role === 'recruiter' && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.companies.title')}</label>
              <select
                value={form.companyId}
                onChange={(e) => set('companyId', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select company —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {form.role === 'admin' && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">{t('superadmin.lpks.title')}</label>
              <select
                value={form.lpkId}
                onChange={(e) => set('lpkId', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select LPK —</option>
                {lpks.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
          {!user && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">{t('loginPassword')}</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={t('superadmin.users.autoPassword')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
            {t('btnCancel')}
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
          >
            {mutation.isPending ? '…' : t('btnSave')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminUsers() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [drawerUser, setDrawerUser] = useState<UserRow | null | 'new'>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['superadmin-users', page, search, roleFilter, activeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (activeFilter !== '') params.set('isActive', activeFilter);
      return api.get(`/superadmin/users?${params.toString()}`).then((r) => r.data);
    },
  });

  const { data: companies } = useQuery<{ companies: Company[] }>({
    queryKey: ['superadmin-companies-list'],
    queryFn: () => api.get('/superadmin/companies').then((r) => r.data),
  });

  const { data: lpks } = useQuery<{ lpks: Lpk[] }>({
    queryKey: ['superadmin-lpks-list'],
    queryFn: () => api.get('/superadmin/lpks').then((r) => r.data),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/superadmin/users/${id}/deactivate`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['superadmin-users'] }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/superadmin/users/${id}/activate`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['superadmin-users'] }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/superadmin/users/${id}/reset-password`).then((r) => r.data),
    onSuccess: (data: { tempPassword: string }) => {
      setTempPassword(data.tempPassword);
    },
  });

  const handleDrawerSuccess = (pw?: string) => {
    setDrawerUser(null);
    if (pw) setTempPassword(pw);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.users.title')}</h1>
        <button
          onClick={() => setDrawerUser('new')}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition"
        >
          + {t('superadmin.users.create')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('filterSearch')}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All status</option>
          <option value="true">{t('superadmin.users.active')}</option>
          <option value="false">{t('superadmin.users.inactive')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">{t('loading')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.users.colName')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.users.colRole')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.users.colCompanyLpk')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.users.colStatus')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.users.colLastLogin')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data?.users ?? []).map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.name}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u.company?.name ?? u.lpk?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.isActive ? t('superadmin.users.active') : t('superadmin.users.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDrawerUser(u)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {t('btnEdit')}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(u.isActive ? `Deactivate ${u.name}?` : `Activate ${u.name}?`)) {
                            if (u.isActive) deactivateMutation.mutate(u.id);
                            else activateMutation.mutate(u.id);
                          }
                        }}
                        className={`text-xs font-medium ${u.isActive ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {u.isActive ? t('superadmin.users.deactivate') : t('superadmin.users.activate')}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Reset password for ${u.name}?`)) {
                            resetPasswordMutation.mutate(u.id);
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        {t('superadmin.users.resetPassword')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {t('paginationRange', {
              from: (page - 1) * data.pageSize + 1,
              to: Math.min(page * data.pageSize, data.total),
              total: data.total,
            })}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="border border-gray-200 rounded px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              disabled={page * data.pageSize >= data.total}
              onClick={() => setPage((p) => p + 1)}
              className="border border-gray-200 rounded px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerUser !== null && (
        <UserDrawer
          user={drawerUser === 'new' ? null : drawerUser}
          companies={companies?.companies ?? []}
          lpks={lpks?.lpks ?? []}
          onClose={() => setDrawerUser(null)}
          onSuccess={handleDrawerSuccess}
        />
      )}

      {/* Temp password modal */}
      {tempPassword && (
        <TempPasswordModal password={tempPassword} onClose={() => setTempPassword(null)} />
      )}
    </div>
  );
}
