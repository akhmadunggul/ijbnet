import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: { row: number; email: string; error: string }[];
}

export default function AdminImportPage() {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(f: File | null) {
    setFile(f);
    setResult(null);
    setApiError(null);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setApiError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post<ImportResult>('/admin/candidates/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Terjadi kesalahan saat import.';
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadTemplate() {
    api
      .get('/admin/candidates/import/template', { responseType: 'blob' })
      .then(({ data, headers }) => {
        const mime =
          headers['content-type'] ??
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const url = URL.createObjectURL(new Blob([data], { type: mime }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'template-import-kandidat.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{t('navImport')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload file Excel (.xlsx) untuk membuat atau memperbarui profil kandidat secara massal.
          Kandidat yang sudah terdaftar akan di-update, yang belum akan dibuat baru.
        </p>
      </div>

      {/* Template download */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <div className="text-2xl mt-0.5">📄</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-blue-900 text-sm">Unduh Template Excel</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Template berisi sheet <strong>Petunjuk</strong> (panduan lengkap), 4 sheet data
            (Kandidat, Pendidikan, Pengalaman_Kerja, Tes_JP), dan sheet{' '}
            <strong>Referensi_Bidang_SSW</strong> berisi daftar nilai valid untuk kolom{' '}
            <code className="mx-1 bg-blue-100 px-1 rounded">bidang_ssw</code>.
            Baris contoh (hijau) boleh dibiarkan — sistem mengabaikannya jika email tidak valid.
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="shrink-0 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          Unduh Template
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0] ?? null);
        }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
          dragging ? 'border-navy-500 bg-navy-50' : 'border-gray-300 hover:border-navy-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div>
            <p className="text-lg">📊</p>
            <p className="font-medium text-navy-800 mt-1">{file.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        ) : (
          <div>
            <p className="text-3xl mb-2">📂</p>
            <p className="text-sm font-medium text-gray-600">
              Drag &amp; drop file .xlsx di sini, atau klik untuk memilih
            </p>
            <p className="text-xs text-gray-400 mt-1">Maks. 10 MB</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {file && (
          <button
            onClick={() => { setFile(null); setResult(null); setApiError(null); if (fileRef.current) fileRef.current.value = ''; }}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Hapus File
          </button>
        )}
        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="px-6 py-2 text-sm bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
        >
          {loading ? 'Mengimpor…' : 'Import Sekarang'}
        </button>
      </div>

      {/* API error */}
      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-700">{result.created}</p>
              <p className="text-xs text-green-600 mt-1">Profil Baru</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">{result.updated}</p>
              <p className="text-xs text-blue-600 mt-1">Profil Diperbarui</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-red-700">{result.errors.length}</p>
              <p className="text-xs text-red-600 mt-1">Error</p>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Total baris diproses: <strong>{result.total}</strong>
          </p>

          {/* Error table */}
          {result.errors.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-700 mb-2">Baris Bermasalah</h2>
              <div className="overflow-x-auto rounded-xl border border-red-200">
                <table className="w-full text-xs">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-red-800 w-16">Baris</th>
                      <th className="px-3 py-2 text-left font-semibold text-red-800">Email</th>
                      <th className="px-3 py-2 text-left font-semibold text-red-800">Keterangan Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/40'}>
                        <td className="px-3 py-2 text-red-700 font-mono">{e.row}</td>
                        <td className="px-3 py-2 text-gray-700">{e.email || '—'}</td>
                        <td className="px-3 py-2 text-red-600">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.errors.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 font-medium">
              ✅ Import selesai tanpa error.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
