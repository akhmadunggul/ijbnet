import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClauseUser { name: string | null; email: string }
interface ClauseSuperseder { version: string }

interface ConsentClause {
  id: string;
  version: string;
  content: string;
  contentJa: string | null;
  isActive: boolean;
  publishedAt: string | null;
  supersededAt: string | null;
  sourceType: 'manual' | 'pdf';
  sourcePdfName: string | null;
  publisher: ClauseUser | null;
  creator: ClauseUser | null;
  superseder: ClauseSuperseder | null;
}

interface ClauseActiveResponse {
  clause: { id: string; version: string; content: string; contentJa: string | null; publishedAt: string | null } | null;
}

interface HistoryResponse {
  clauses: ConsentClause[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ClauseDetailResponse { clause: ConsentClause }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ clauseId, onClose }: { clauseId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ClauseDetailResponse>({
    queryKey: ['consent-clause-detail', clauseId],
    queryFn: () => api.get(`/superadmin/consent-clause/${clauseId}`).then((r) => r.data),
  });

  function copyText(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const c = data?.clause;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[480px] bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">{t('superadmin.consent.drawerTitle')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">{t('loading')}</div>
        ) : !c ? (
          <div className="flex-1 flex items-center justify-center text-sm text-red-400">{t('toastError')}</div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm">
            {/* Meta */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-gray-900">v{c.version}</span>
                {c.isActive && (
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {t('superadmin.consent.statusActive')}
                  </span>
                )}
                <span className="text-xs text-gray-400 uppercase">
                  {c.sourceType === 'pdf' ? t('superadmin.consent.sourcePdf') : t('superadmin.consent.sourceManual')}
                  {c.sourcePdfName ? ` · ${c.sourcePdfName}` : ''}
                </span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>{t('superadmin.consent.publishedAt')}: {fmtDate(c.publishedAt)} · {c.publisher?.name ?? c.publisher?.email ?? '—'}</p>
                {c.supersededAt && (
                  <p>{t('superadmin.consent.supersededAt')}: {fmtDate(c.supersededAt)}
                    {c.superseder ? ` → v${c.superseder.version}` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Content ID */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600">{t('superadmin.consent.labelContentId')}</span>
                <button
                  onClick={() => copyText(c.content, 'id')}
                  className="text-xs text-navy-700 hover:underline"
                >
                  {copiedId === 'id' ? t('superadmin.consent.copied') : t('superadmin.consent.copyText')}
                </button>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-56 overflow-y-auto text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {c.content}
              </div>
            </div>

            {/* Content JA */}
            {c.contentJa && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">{t('superadmin.consent.labelContentJa')}</span>
                  <button
                    onClick={() => copyText(c.contentJa!, 'ja')}
                    className="text-xs text-navy-700 hover:underline"
                  >
                    {copiedId === 'ja' ? t('superadmin.consent.copied') : t('superadmin.consent.copyText')}
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-56 overflow-y-auto text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {c.contentJa}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({ content, contentJa, version, onClose }: {
  content: string; contentJa: string; version: string; onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">{t('superadmin.consent.previewTitle')} — v{version}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 text-sm text-gray-700">
          {content && <p className="whitespace-pre-wrap leading-relaxed">{content}</p>}
          {contentJa && <p className="whitespace-pre-wrap leading-relaxed text-gray-500 italic border-t border-gray-100 pt-3">{contentJa}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SuperAdminConsent() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // Publish panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'pdf'>('manual');
  const [version, setVersion] = useState('');
  const [contentId, setContentId] = useState('');
  const [contentJa, setContentJa] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishError, setPublishError] = useState('');

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History
  const [historyPage, setHistoryPage] = useState(1);
  const [drawerClauseId, setDrawerClauseId] = useState<string | null>(null);

  // Queries
  const { data: activeData } = useQuery<ClauseActiveResponse>({
    queryKey: ['consent-clause-active'],
    queryFn: () => api.get('/superadmin/consent-clause/active').then((r) => r.data),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<HistoryResponse>({
    queryKey: ['consent-clause-history', historyPage],
    queryFn: () => api.get(`/superadmin/consent-clause/history?page=${historyPage}&pageSize=20`).then((r) => r.data),
  });

  const activeClause = activeData?.clause ?? null;

  // Mutations
  const publishMutation = useMutation({
    mutationFn: (body: { content: string; contentJa?: string; version: string; sourceType?: string; sourcePdfName?: string }) =>
      api.post('/superadmin/consent-clause', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['consent-clause-active'] });
      void qc.invalidateQueries({ queryKey: ['consent-clause-history'] });
      setPanelOpen(false);
      setVersion('');
      setContentId('');
      setContentJa('');
      setPdfFile(null);
      setPdfPageCount(null);
      setConfirmPublish(false);
      setPublishError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '';
      if (msg === 'VERSION_EXISTS') setPublishError(t('superadmin.consent.errorVersionExists'));
      else if (msg === 'INVALID_VERSION') setPublishError(t('superadmin.consent.errorVersionFormat'));
      else if (msg === 'MISSING_FIELDS') setPublishError(t('superadmin.consent.errorMissingFields'));
      else setPublishError(t('toastError'));
      setConfirmPublish(false);
    },
  });

  const extractMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<{ extractedText: string; pageCount: number; filename: string }>(
        '/superadmin/consent-clause/extract-pdf', form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      ).then((r) => r.data);
    },
    onSuccess: (data) => {
      setContentId(data.extractedText);
      setPdfPageCount(data.pageCount);
      setPdfError('');
    },
    onError: () => setPdfError(t('superadmin.consent.errorExtract')),
  });

  function handleFileChange(file: File | null) {
    if (!file) return;
    setPdfFile(file);
    setPdfPageCount(null);
    setContentId('');
  }

  function handlePublish() {
    setPublishError('');
    const body: Parameters<typeof publishMutation.mutate>[0] = {
      content: contentId,
      version,
      ...(contentJa.trim() ? { contentJa: contentJa.trim() } : {}),
    };
    if (activeTab === 'pdf' && pdfFile) {
      body.sourceType = 'pdf';
      body.sourcePdfName = pdfFile.name;
    }
    publishMutation.mutate(body);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-bold text-gray-900">{t('superadmin.consent.title')}</h1>

      {/* SECTION 1 — Active Clause */}
      <div className={`rounded-xl border shadow-sm p-5 ${activeClause ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-semibold text-gray-800">{t('superadmin.consent.activeClause')}</h2>
          {activeClause && (
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
              v{activeClause.version}
            </span>
          )}
        </div>
        {activeClause ? (
          <ActiveClauseCard clause={activeClause} onViewFull={() => setDrawerClauseId(activeClause.id)} />
        ) : (
          <p className="text-sm text-amber-700">{t('superadmin.consent.noActive')}</p>
        )}
      </div>

      {/* SECTION 2 — Publish New Clause */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition rounded-xl"
          onClick={() => setPanelOpen((v) => !v)}
        >
          <span>{t('superadmin.consent.publishNew')}</span>
          <span className="text-gray-400 text-lg">{panelOpen ? '▲' : '▼'}</span>
        </button>

        {panelOpen && (
          <div className="px-5 pb-6 border-t border-gray-100 pt-4">
            {/* Tabs */}
            <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
              {(['manual', 'pdf'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${
                    activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'manual' ? t('superadmin.consent.tabManual') : t('superadmin.consent.tabPdf')}
                </button>
              ))}
            </div>

            {/* PDF Tab */}
            {activeTab === 'pdf' && (
              <div className="mb-4 space-y-3">
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-navy-400 transition"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0] ?? null); }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  />
                  {pdfFile ? (
                    <div className="text-sm text-gray-700">
                      <p className="font-medium">{pdfFile.name}</p>
                      {pdfPageCount != null && <p className="text-xs text-gray-400 mt-1">{pdfPageCount} {t('superadmin.consent.pages')}</p>}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">
                      <p>{t('superadmin.consent.dropzone')}</p>
                      <p className="text-xs mt-1">{t('superadmin.consent.dropzoneLimit')}</p>
                    </div>
                  )}
                </div>
                {pdfFile && (
                  <button
                    onClick={() => extractMutation.mutate(pdfFile)}
                    disabled={extractMutation.isPending}
                    className="text-sm bg-navy-700 text-white px-4 py-2 rounded-lg hover:bg-navy-900 transition disabled:opacity-50"
                  >
                    {extractMutation.isPending ? '…' : t('superadmin.consent.extractBtn')}
                  </button>
                )}
                {pdfError && <p className="text-xs text-red-600">{pdfError}</p>}
              </div>
            )}

            {/* Version input */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('superadmin.consent.labelVersion')}</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
              <p className="text-xs text-gray-400 mt-1">{t('superadmin.consent.versionHint')}</p>
            </div>

            {/* Content ID */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('superadmin.consent.labelContentId')} *</label>
              <textarea
                rows={12}
                value={contentId}
                onChange={(e) => setContentId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-y"
              />
            </div>

            {/* Content JA */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('superadmin.consent.labelContentJa')}</label>
              <textarea
                rows={8}
                value={contentJa}
                onChange={(e) => setContentJa(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-y"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setShowPreview(true)}
                disabled={!contentId.trim()}
                className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-40"
              >
                {t('superadmin.consent.preview')}
              </button>
              <button
                onClick={() => setConfirmPublish(true)}
                disabled={!contentId.trim() || !version.trim() || publishMutation.isPending}
                className="text-sm bg-navy-700 text-white px-5 py-2 rounded-lg hover:bg-navy-900 transition disabled:opacity-50"
              >
                {publishMutation.isPending ? '…' : (activeTab === 'pdf' ? t('superadmin.consent.saveFromPdf') : t('superadmin.consent.publishBtn'))}
              </button>
            </div>

            {publishError && <p className="text-xs text-red-600 mt-2">{publishError}</p>}

            {/* Confirm dialog */}
            {confirmPublish && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800 mb-1 font-medium">{t('superadmin.consent.publishConfirm')}</p>
                <p className="text-xs text-amber-700 mb-3">{t('superadmin.consent.publishWarning')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handlePublish}
                    disabled={publishMutation.isPending}
                    className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {publishMutation.isPending ? '…' : t('superadmin.consent.publishBtn')}
                  </button>
                  <button
                    onClick={() => setConfirmPublish(false)}
                    className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50"
                  >
                    {t('btnCancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3 — History Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">{t('superadmin.consent.historyTitle')}</h2>

        {historyLoading ? (
          <p className="text-sm text-gray-400">{t('loading')}</p>
        ) : !historyData?.clauses.length ? (
          <p className="text-sm text-gray-400">{t('noResults', 'Belum ada klausul.')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                    <th className="text-left py-2 pr-4">{t('superadmin.consent.colVersion')}</th>
                    <th className="text-left py-2 pr-4">{t('superadmin.consent.colPublished')}</th>
                    <th className="text-left py-2 pr-4">{t('superadmin.consent.colSupersededBy')}</th>
                    <th className="text-left py-2 pr-4">{t('superadmin.consent.colSupersededAt')}</th>
                    <th className="text-left py-2 pr-4">{t('superadmin.consent.colSource')}</th>
                    <th className="text-left py-2">{t('superadmin.consent.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historyData.clauses.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">v{c.version}</span>
                          {c.isActive && (
                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {t('superadmin.consent.statusActive')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        <div>{fmtDate(c.publishedAt)}</div>
                        {c.publisher && <div className="text-xs text-gray-400">{c.publisher.name ?? c.publisher.email}</div>}
                      </td>
                      <td className="py-3 pr-4 text-gray-500 font-mono text-xs">
                        {c.superseder ? `v${c.superseder.version}` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-500 text-xs">
                        {c.supersededAt ? fmtDate(c.supersededAt) : (
                          <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {t('superadmin.consent.statusActive')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-gray-500">
                        {c.sourceType === 'pdf' ? (
                          <span title={c.sourcePdfName ?? ''}>PDF {c.sourcePdfName ? `· ${c.sourcePdfName.slice(0, 20)}` : ''}</span>
                        ) : t('superadmin.consent.sourceManual')}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => setDrawerClauseId(c.id)}
                          className="text-xs text-navy-700 hover:underline font-medium"
                        >
                          {t('superadmin.consent.btnView')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {historyData.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                <span>{historyData.total} total</span>
                <div className="flex gap-2">
                  <button
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => p - 1)}
                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    ←
                  </button>
                  <span className="px-3 py-1">{historyPage} / {historyData.totalPages}</span>
                  <button
                    disabled={historyPage >= historyData.totalPages}
                    onClick={() => setHistoryPage((p) => p + 1)}
                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Drawer */}
      {drawerClauseId && (
        <DetailDrawer clauseId={drawerClauseId} onClose={() => setDrawerClauseId(null)} />
      )}

      {/* Preview Modal */}
      {showPreview && (
        <PreviewModal
          content={contentId}
          contentJa={contentJa}
          version={version || '?'}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

// ── Active Clause Card ────────────────────────────────────────────────────────

function ActiveClauseCard({
  clause,
  onViewFull,
}: {
  clause: { id: string; version: string; content: string; contentJa: string | null; publishedAt: string | null };
  onViewFull: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const preview = clause.content.slice(0, 300);
  const hasMore = clause.content.length > 300;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        {t('superadmin.consent.publishedAt')}: {fmtDate(clause.publishedAt)}
      </p>
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {expanded ? clause.content : preview}
        {!expanded && hasMore && '…'}
      </div>
      <div className="flex gap-3">
        {hasMore && (
          <button onClick={() => setExpanded((v) => !v)} className="text-xs text-navy-700 hover:underline">
            {expanded ? t('superadmin.consent.collapse') : t('superadmin.consent.readMore')}
          </button>
        )}
        <button onClick={onViewFull} className="text-xs text-navy-700 hover:underline font-medium">
          {t('superadmin.consent.btnView')}
        </button>
      </div>
    </div>
  );
}
