import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import AuthImage from '../../components/AuthImage';
import { useSelectionStore } from '../../store/selectionStore';
import type {
  RecruiterBatchResponse,
  RecruiterBatchCandidate,
  RecruiterCandidate,
  RecruiterTest,
} from '../../types/recruiter';

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function getHighestJlpt(tests: RecruiterTest[]): { level: string; score: number | null } | null {
  const LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5', 'JFT-Basic'];
  for (const level of LEVELS) {
    const t = tests.find((x) => x.testName?.includes(level) && x.pass);
    if (t) return { level, score: t.score };
  }
  // No passing test — return highest attempted
  for (const level of LEVELS) {
    const t = tests.find((x) => x.testName?.includes(level));
    if (t) return { level, score: t.score };
  }
  return null;
}

function isShorts(url: string | null): boolean {
  return !!url && url.includes('/shorts/');
}

// ── Filter types ─────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  sswKubun: string;
  sswFieldId: string;
  jpLevel: string;
  bodyCheck: string;
  gender: string;
}

function applyFilters(candidates: RecruiterBatchCandidate[], filters: Filters): RecruiterBatchCandidate[] {
  return candidates.filter((bc) => {
    const c = bc.candidate;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!c.fullName.toLowerCase().includes(q) && !c.candidateCode.toLowerCase().includes(q)) return false;
    }
    if (filters.sswKubun && filters.sswKubun !== 'ALL') {
      if (c.sswKubun !== filters.sswKubun) return false;
    }
    if (filters.sswFieldId && filters.sswFieldId !== 'ALL') {
      if (c.sswFieldId !== filters.sswFieldId) return false;
    }
    if (filters.bodyCheck && filters.bodyCheck !== 'ALL') {
      if ((c.bodyCheck?.overallResult ?? null) !== filters.bodyCheck.toLowerCase()) return false;
    }
    if (filters.gender && filters.gender !== 'ALL') {
      if (c.gender !== filters.gender) return false;
    }
    if (filters.jpLevel && filters.jpLevel !== 'ALL') {
      const hasLevel = c.tests?.some(
        (t) => t.testName?.includes(filters.jpLevel) && t.pass,
      );
      if (!hasLevel) return false;
    }
    return true;
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuotaBar({ selected, limit, lang }: { selected: number; limit: number; lang: string }) {
  const pct = limit > 0 ? Math.round((selected / limit) * 100) : 0;
  const full = selected >= limit;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 min-w-48">
      <p className="text-xs text-gray-400 mb-1">
        {lang === 'ja' ? '選択済み' : 'Dipilih'}: <strong className={full ? 'text-gold-600' : 'text-navy-700'}>{selected}</strong> / {limit}
      </p>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${full ? 'bg-gold-400' : 'bg-navy-600'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function BodyCheckCard({ c, lang }: { c: RecruiterCandidate; lang: string }) {
  const bc = c.bodyCheck;
  if (!bc) return <span className="text-gray-300 text-xs">—</span>;
  const resultColor =
    bc.overallResult === 'pass' ? 'text-green-600' :
    bc.overallResult === 'fail' ? 'text-red-500' : 'text-amber-600';
  return (
    <div className="relative group inline-block">
      <span className={`text-xs font-medium cursor-default ${resultColor}`}>
        {bc.overallResult === 'pass' ? (lang === 'ja' ? '合格' : 'Lulus') :
         bc.overallResult === 'fail' ? (lang === 'ja' ? '不合格' : 'Gagal') :
         bc.overallResult === 'hold' ? (lang === 'ja' ? '保留' : 'Tahan') : '—'}
      </span>
      {/* Hover card */}
      <div className="absolute bottom-6 left-0 z-50 hidden group-hover:block w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-2">{lang === 'ja' ? '体力検査結果' : 'Hasil Cek Fisik'}</p>
        <div className="space-y-1 text-gray-600">
          {bc.verifiedHeight && <p>{lang === 'ja' ? '身長' : 'Tinggi'}: {bc.verifiedHeight} cm</p>}
          {bc.verifiedWeight && <p>{lang === 'ja' ? '体重' : 'Berat'}: {bc.verifiedWeight} kg</p>}
          {bc.carrySeconds != null && <p>{lang === 'ja' ? '持ち上げ' : 'Angkat'}: {bc.carrySeconds}s</p>}
          <p className={`font-semibold ${resultColor}`}>
            {lang === 'ja' ? '総合' : 'Hasil'}: {bc.overallResult?.toUpperCase() ?? '—'}
          </p>
          {bc.checkedDate && <p className="text-gray-400">{bc.checkedDate}</p>}
        </div>
      </div>
    </div>
  );
}

function JapaneseDrawer({
  bc,
  lang,
  onClose,
}: {
  bc: RecruiterBatchCandidate | null;
  lang: string;
  onClose: () => void;
}) {
  if (!bc) return null;
  const c = bc.candidate;
  const highest = getHighestJlpt(c.tests ?? []);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-50 w-[480px] max-w-full bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-navy-900">{c.fullName}</p>
            <p className="text-xs text-gray-400">{c.candidateCode}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* JLPT tests */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {lang === 'ja' ? '語学テスト' : 'Tes Bahasa Jepang'}
            </p>
            {(c.tests ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">{lang === 'ja' ? 'データなし' : 'Tidak ada data'}</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-400">
                    <th className="px-2 py-1.5 text-left">{lang === 'ja' ? 'テスト名' : 'Nama Tes'}</th>
                    <th className="px-2 py-1.5 text-center">{lang === 'ja' ? 'スコア' : 'Nilai'}</th>
                    <th className="px-2 py-1.5 text-center">{lang === 'ja' ? '合否' : 'Lulus'}</th>
                    <th className="px-2 py-1.5 text-right">{lang === 'ja' ? '日付' : 'Tanggal'}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.tests.map((t) => (
                    <tr key={t.id} className="border-t border-gray-50">
                      <td className="px-2 py-1.5 font-medium">{t.testName ?? '—'}</td>
                      <td className="px-2 py-1.5 text-center">{t.score ?? '—'}</td>
                      <td className="px-2 py-1.5 text-center">
                        {t.pass === true ? (
                          <span className="text-green-600">✓</span>
                        ) : t.pass === false ? (
                          <span className="text-red-500">✗</span>
                        ) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-400">{t.testDate ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Weekly tests */}
          {(c.weeklyTests ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {lang === 'ja' ? '週次テスト' : 'Tes Mingguan'}
              </p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-400">
                    <th className="px-2 py-1.5 text-left">{lang === 'ja' ? 'コース' : 'Kursus'}</th>
                    <th className="px-2 py-1.5 text-center">{lang === 'ja' ? '週' : 'Minggu'}</th>
                    <th className="px-2 py-1.5 text-center">{lang === 'ja' ? 'スコア' : 'Nilai'}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.weeklyTests.map((w) => (
                    <tr key={w.id} className="border-t border-gray-50">
                      <td className="px-2 py-1.5">{w.courseName ?? '—'}</td>
                      <td className="px-2 py-1.5 text-center">{w.weekNumber ?? '—'}</td>
                      <td className="px-2 py-1.5 text-center font-medium">{w.score ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Videos preview */}
          {(c.videos ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {lang === 'ja' ? '動画' : 'Video'}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {c.videos.map((v) => (
                  <div key={v.id} className="bg-gray-50 rounded-lg overflow-hidden">
                    {v.youtubeId && (
                      <img
                        src={`https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg`}
                        alt={v.label ?? v.youtubeId}
                        className="w-full h-16 object-cover"
                      />
                    )}
                    <p className="text-xs text-gray-500 px-1 py-0.5 truncate">{v.label ?? v.youtubeId}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highest level summary */}
          {highest && (
            <div className="bg-navy-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{lang === 'ja' ? '最高レベル' : 'Level Tertinggi'}</p>
              <p className="text-xl font-bold text-navy-700">{highest.level}</p>
              {highest.score != null && <p className="text-xs text-gray-500">{highest.score} pt</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function VideoModal({ bc, lang, onClose }: { bc: RecruiterBatchCandidate | null; lang: string; onClose: () => void }) {
  const [activeIdx, setActiveIdx] = useState(0);
  if (!bc) return null;
  const videos = bc.candidate.videos ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-navy-900">{bc.candidate.fullName}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        {videos.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-12">
            {lang === 'ja' ? '動画未登録' : 'Video belum tersedia'}
          </div>
        ) : (
          <>
            {/* Tab list */}
            {videos.length > 1 && (
              <div className="flex gap-2 px-5 py-3 border-b border-gray-100 overflow-x-auto">
                {videos.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => setActiveIdx(i)}
                    className={`text-xs px-3 py-1.5 rounded-full shrink-0 transition ${
                      activeIdx === i ? 'bg-navy-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {v.label ?? `Video ${i + 1}`}
                    {v.videoDate && <span className="ml-1 text-gray-400">· {v.videoDate}</span>}
                  </button>
                ))}
              </div>
            )}
            {/* Embed */}
            {videos[activeIdx]?.youtubeId && (
              <div className={`flex-1 overflow-hidden ${isShorts(videos[activeIdx].youtubeUrl) ? 'flex justify-center' : ''}`}>
                <div className={isShorts(videos[activeIdx].youtubeUrl) ? 'aspect-[9/16] h-full max-h-96' : 'aspect-video w-full'}>
                  <iframe
                    src={`https://www.youtube.com/embed/${videos[activeIdx].youtubeId}`}
                    className="w-full h-full"
                    allowFullScreen
                    title={videos[activeIdx].label ?? 'Video'}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProfileModal({ bc, lang, onClose }: { bc: RecruiterBatchCandidate | null; lang: string; onClose: () => void }) {
  if (!bc) return null;
  const c = bc.candidate;
  const age = calcAge(c.dateOfBirth);
  const highest = getHighestJlpt(c.tests ?? []);

  function MaskedVal({ label }: { label: { id: string; ja: string } }) {
    return <span className="text-gray-400 italic text-xs">{lang === 'ja' ? label.ja : label.id}</span>;
  }

  function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex gap-2 text-sm py-1.5 border-b border-gray-50">
        <span className="text-gray-400 w-36 shrink-0 text-xs">{label}</span>
        <span className="text-gray-800">{value ?? '—'}</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100">
          <AuthImage
            src={c.closeupUrl}
            alt={c.fullName}
            className="w-14 h-14 rounded-lg object-cover border border-gray-100"
            fallback={<div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 text-2xl">👤</div>}
          />
          <div>
            <p className="font-semibold text-navy-900">{c.fullName}</p>
            <p className="text-xs text-gray-400 font-mono">{c.candidateCode}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Personal */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {lang === 'ja' ? '個人情報' : 'Data Pribadi'}
            </p>
            <Row label={lang === 'ja' ? '性別' : 'Gender'} value={
              c.gender === 'M' ? (lang === 'ja' ? '男性' : 'Laki-laki') :
              c.gender === 'F' ? (lang === 'ja' ? '女性' : 'Perempuan') : null
            } />
            <Row label={lang === 'ja' ? '年齢' : 'Umur'} value={age != null ? `${age} ${lang === 'ja' ? '歳' : 'thn'}` : null} />
            <Row label={lang === 'ja' ? '身長' : 'Tinggi'} value={c.heightCm ? `${c.heightCm} cm` : null} />
            <Row label={lang === 'ja' ? '体重' : 'Berat'} value={c.weightKg ? `${c.weightKg} kg` : null} />
            <Row label={lang === 'ja' ? '婚姻' : 'Status Nikah'} value={c.maritalStatus} />
            <Row label={lang === 'ja' ? '電話' : 'Telepon'} value={<MaskedVal label={c.phone.label} />} />
            <Row label="Email" value={<MaskedVal label={c.email.label} />} />
            <Row label={lang === 'ja' ? '住所' : 'Alamat'} value={<MaskedVal label={c.address.label} />} />
          </div>

          {/* SSW */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">SSW</p>
            <Row label={lang === 'ja' ? '区分' : 'Tipe'} value={c.sswKubun} />
            <Row label={lang === 'ja' ? '分野' : 'Bidang'} value={lang === 'ja' ? c.sswSectorJa : c.sswSectorId} />
            <Row label={lang === 'ja' ? '職種' : 'Pekerjaan'} value={lang === 'ja' ? c.sswFieldJa : c.sswFieldId} />
          </div>

          {/* Education */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {lang === 'ja' ? '学歴' : 'Pendidikan'}
            </p>
            <Row label={lang === 'ja' ? '学歴' : 'Jenjang'} value={c.eduLevel} />
            <Row label={lang === 'ja' ? '学校' : 'Institusi'} value={c.eduLabel} />
            <Row label={lang === 'ja' ? '専攻' : 'Jurusan'} value={c.eduMajor} />
          </div>

          {/* Career */}
          {(c.career ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {lang === 'ja' ? '職歴' : 'Riwayat Kerja'}
              </p>
              {c.career.map((entry, i) => (
                <div key={entry.id ?? i} className="text-sm py-1.5 border-b border-gray-50">
                  <p className="font-medium text-gray-800">{entry.companyName}</p>
                  <p className="text-xs text-gray-400">{entry.division} · {entry.period}</p>
                </div>
              ))}
            </div>
          )}

          {/* Japanese */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {lang === 'ja' ? '日本語レベル' : 'Bahasa Jepang'}
            </p>
            {highest ? (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-navy-700">{highest.level}</span>
                {highest.score != null && <span className="text-sm text-gray-500">{highest.score} pt</span>}
              </div>
            ) : (
              <p className="text-xs text-gray-400">—</p>
            )}
          </div>

          {/* Work plan */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {lang === 'ja' ? '就労計画' : 'Rencana Kerja'}
            </p>
            <Row label={lang === 'ja' ? '期間' : 'Durasi'} value={c.workplanDuration} />
            <Row label={lang === 'ja' ? '目標' : 'Tujuan'} value={c.workplanGoal} />
          </div>

          {/* Body check */}
          {c.bodyCheck && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {lang === 'ja' ? '体力検査' : 'Cek Fisik'}
              </p>
              <Row label={lang === 'ja' ? '身長確認' : 'Tinggi Verif.'} value={c.bodyCheck.verifiedHeight ? `${c.bodyCheck.verifiedHeight} cm` : null} />
              <Row label={lang === 'ja' ? '体重確認' : 'Berat Verif.'} value={c.bodyCheck.verifiedWeight ? `${c.bodyCheck.verifiedWeight} kg` : null} />
              <Row label={lang === 'ja' ? '結果' : 'Hasil'} value={
                <span className={c.bodyCheck.overallResult === 'pass' ? 'text-green-600 font-semibold' : c.bodyCheck.overallResult === 'fail' ? 'text-red-500 font-semibold' : 'text-amber-600 font-semibold'}>
                  {c.bodyCheck.overallResult?.toUpperCase() ?? '—'}
                </span>
              } />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectionTray({
  selectedIds,
  candidateMap,
  lang,
  onRemove,
  onConfirm,
}: {
  selectedIds: Set<string>;
  candidateMap: Map<string, RecruiterBatchCandidate>;
  lang: string;
  onRemove: (id: string) => void;
  onConfirm: () => void;
}) {
  if (selectedIds.size === 0) return null;
  const selected = [...selectedIds].map((id) => candidateMap.get(id)).filter(Boolean) as RecruiterBatchCandidate[];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg px-4 py-3 flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-navy-900 shrink-0">
        {selectedIds.size} {lang === 'ja' ? '名選択中' : 'kandidat dipilih'}
      </span>
      <div className="flex gap-2 flex-wrap flex-1">
        {selected.map((bc) => (
          <span
            key={bc.candidateId}
            className="flex items-center gap-1 bg-gold-50 border border-gold-200 rounded-full px-2.5 py-1 text-xs font-medium text-gold-700"
          >
            {bc.candidate.candidateCode}
            <button
              onClick={() => onRemove(bc.candidateId)}
              className="hover:text-red-500 ml-0.5"
            >×</button>
          </span>
        ))}
      </div>
      <button
        onClick={onConfirm}
        className="bg-navy-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-navy-900 transition shrink-0"
      >
        {lang === 'ja' ? '選択を確定' : 'Konfirmasi Pilihan'}
      </button>
    </div>
  );
}

function ConfirmDialog({
  selectedIds,
  candidateMap,
  lang,
  isPending,
  onConfirm,
  onCancel,
}: {
  selectedIds: Set<string>;
  candidateMap: Map<string, RecruiterBatchCandidate>;
  lang: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const selected = [...selectedIds].map((id) => candidateMap.get(id)).filter(Boolean) as RecruiterBatchCandidate[];
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-navy-900">
          {lang === 'ja' ? '選択確定' : 'Konfirmasi Pilihan'}
        </h2>
        <p className="text-sm text-gray-500">
          {lang === 'ja'
            ? `以下の ${selected.length} 名を選択します：`
            : `Anda akan memilih ${selected.length} kandidat berikut:`}
        </p>
        <ul className="space-y-1">
          {selected.map((bc) => (
            <li key={bc.candidateId} className="text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-navy-400 rounded-full" />
              <span className="text-gray-400 font-mono text-xs">{bc.candidate.candidateCode}</span>
              <span className="text-gray-800">{bc.candidate.fullName}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-amber-600">
          {lang === 'ja' ? '確定後は変更できません。' : 'Setelah dikonfirmasi, pilihan tidak dapat diubah.'}
        </p>
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {lang === 'ja' ? 'キャンセル' : 'Batal'}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-sm bg-navy-700 text-white hover:bg-navy-900 transition disabled:opacity-50"
          >
            {isPending ? '…' : (lang === 'ja' ? '確定' : 'Konfirmasi')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecruiterSelection() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<Filters>({
    search: '', sswKubun: 'ALL', sswFieldId: 'ALL',
    jpLevel: 'ALL', bodyCheck: 'ALL', gender: 'ALL',
  });
  const [drawerBc, setDrawerBc] = useState<RecruiterBatchCandidate | null>(null);
  const [videoBc, setVideoBc] = useState<RecruiterBatchCandidate | null>(null);
  const [profileBc, setProfileBc] = useState<RecruiterBatchCandidate | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const initRef = useRef(false);

  const { initialize, toggleSelect, selectedIds, limit, isAtLimit, clearAll } = useSelectionStore();

  const { data, isLoading } = useQuery<RecruiterBatchResponse>({
    queryKey: ['recruiter-batch'],
    queryFn: () => api.get('/recruiter/batch').then((r) => r.data),
  });

  // Initialize selection store from batch data
  useEffect(() => {
    if (data?.batch && !initRef.current) {
      initRef.current = true;
      const preSelected = (data.candidates ?? [])
        .filter((bc) => bc.isSelected && !bc.isConfirmed)
        .map((bc) => bc.candidateId);
      clearAll();
      initialize(
        data.batch.id,
        preSelected,
        data.batch.interviewCandidateLimit ?? data.batch.quotaTotal ?? 999,
        data.batch.quotaTotal ?? 0,
      );
    }
  }, [data, initialize]);

  const confirmMutation = useMutation({
    mutationFn: (candidateIds: string[]) =>
      api.post(`/recruiter/batches/${data!.batch.id}/select`, { candidateIds }),
    onSuccess: () => {
      setShowConfirm(false);
      clearAll();
      queryClient.invalidateQueries({ queryKey: ['recruiter-batch'] });
      initRef.current = false; // allow re-init on next load
    },
  });

  const allCandidates = data?.candidates ?? [];

  // Build lookup map
  const candidateMap = useMemo(
    () => new Map(allCandidates.map((bc) => [bc.candidateId, bc])),
    [allCandidates],
  );

  // Distinct SSW fields for filter dropdown
  const sswFields = useMemo(() => {
    const fields = new Set<string>();
    allCandidates.forEach((bc) => {
      if (bc.candidate.sswFieldId) fields.add(bc.candidate.sswFieldId);
    });
    return [...fields];
  }, [allCandidates]);

  const filtered = useMemo(() => applyFilters(allCandidates, filters), [allCandidates, filters]);

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;
  if (!data?.batch) return (
    <div className="text-center py-16 text-gray-400 text-sm">
      {lang === 'ja' ? 'アクティブなバッチが見つかりません' : 'Tidak ada batch aktif'}
    </div>
  );

  const batch = data.batch;
  const atLimit = isAtLimit();

  return (
    <div className="space-y-4 pb-20">
      {/* Header row */}
      <div className="flex items-start gap-4 flex-wrap">
        {/* Company card */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex-1 min-w-64">
          <p className="font-semibold text-navy-900" style={{ fontFamily: 'system-ui, sans-serif' }}>
            {lang === 'ja' && batch.company.nameJa ? batch.company.nameJa : batch.company.name}
          </p>
          {batch.company.nameJa && lang !== 'ja' && (
            <p className="text-xs text-gray-400" style={{ fontFamily: 'system-ui, sans-serif' }}>{batch.company.nameJa}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {batch.batchCode}
            {batch.expiryDate && ` · ${lang === 'ja' ? '有効期限' : 'Exp'}: ${batch.expiryDate}`}
          </p>
        </div>
        <QuotaBar
          selected={selectedIds.size}
          limit={batch.interviewCandidateLimit ?? batch.quotaTotal ?? 0}
          lang={lang}
        />
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 flex flex-wrap gap-2">
        {/* Search */}
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder={lang === 'ja' ? '氏名・コードで検索…' : 'Cari nama atau kode…'}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm min-w-48 flex-1 focus:outline-none focus:ring-2 focus:ring-navy-300"
        />
        {/* SSW kubun */}
        {(['ALL', 'SSW1', 'SSW2'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilters((f) => ({ ...f, sswKubun: v }))}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filters.sswKubun === v ? 'bg-navy-700 text-white border-navy-700' : 'text-gray-600 border-gray-200 hover:border-navy-300'
            }`}
          >
            {v === 'ALL' ? (lang === 'ja' ? '全て' : 'Semua') : v}
          </button>
        ))}
        {/* SSW field */}
        {sswFields.length > 0 && (
          <select
            value={filters.sswFieldId}
            onChange={(e) => setFilters((f) => ({ ...f, sswFieldId: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
          >
            <option value="ALL">{lang === 'ja' ? '職種: 全て' : 'Bidang: Semua'}</option>
            {sswFields.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}
        {/* JP level */}
        <select
          value={filters.jpLevel}
          onChange={(e) => setFilters((f) => ({ ...f, jpLevel: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
        >
          <option value="ALL">{lang === 'ja' ? '日本語: 全て' : 'JP Level: Semua'}</option>
          {['N1', 'N2', 'N3', 'N4', 'N5', 'JFT-Basic'].map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        {/* Body check */}
        {(['ALL', 'pass', 'hold', 'fail'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilters((f) => ({ ...f, bodyCheck: v.toUpperCase() === 'ALL' ? 'ALL' : v }))}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filters.bodyCheck === (v === 'ALL' ? 'ALL' : v)
                ? 'bg-navy-700 text-white border-navy-700'
                : 'text-gray-600 border-gray-200 hover:border-navy-300'
            }`}
          >
            {v === 'ALL' ? (lang === 'ja' ? '体力: 全て' : 'Cek: Semua') :
             v === 'pass' ? (lang === 'ja' ? '合格' : 'Lulus') :
             v === 'hold' ? (lang === 'ja' ? '保留' : 'Tahan') :
             (lang === 'ja' ? '不合格' : 'Gagal')}
          </button>
        ))}
        {/* Gender */}
        {(['ALL', 'M', 'F'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilters((f) => ({ ...f, gender: v }))}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filters.gender === v ? 'bg-navy-700 text-white border-navy-700' : 'text-gray-600 border-gray-200 hover:border-navy-300'
            }`}
          >
            {v === 'ALL' ? (lang === 'ja' ? '性別: 全て' : 'Gender: Semua') : v === 'M' ? (lang === 'ja' ? '男' : 'L') : (lang === 'ja' ? '女' : 'P')}
          </button>
        ))}
        {/* Clear */}
        <button
          onClick={() => setFilters({ search: '', sswKubun: 'ALL', sswFieldId: 'ALL', jpLevel: 'ALL', bodyCheck: 'ALL', gender: 'ALL' })}
          className="text-xs text-gray-400 hover:text-gray-600 px-2"
        >
          {lang === 'ja' ? 'クリア' : 'Reset'}
        </button>
        <span className="text-xs text-gray-400 self-center ml-auto">
          {filtered.length} / {allCandidates.length}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-400">#</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400">{lang === 'ja' ? '写真' : 'Foto'}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400">{lang === 'ja' ? '氏名' : 'Nama'}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400">{lang === 'ja' ? '性別/年齢' : 'J/U'}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400">{lang === 'ja' ? '学歴' : 'Pendidikan'}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400">{lang === 'ja' ? 'SSW分野' : 'Bidang SSW'}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400">{lang === 'ja' ? '日本語' : 'Bahasa JP'}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400">{lang === 'ja' ? '体力検査' : 'Cek Fisik'}</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-400">{lang === 'ja' ? '動画' : 'Video'}</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-400">{lang === 'ja' ? 'プロフィール' : 'Profil'}</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-400">{lang === 'ja' ? '選択' : 'Pilih'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-xs text-gray-400">{t('noData')}</td>
                </tr>
              )}
              {filtered.map((bc, idx) => {
                const c = bc.candidate;
                const age = calcAge(c.dateOfBirth);
                const highest = getHighestJlpt(c.tests ?? []);
                const isSelected = selectedIds.has(bc.candidateId);
                const rowBg = bc.isConfirmed
                  ? 'bg-green-50'
                  : isSelected
                  ? 'bg-amber-50 border-l-2 border-gold-400'
                  : '';

                return (
                  <tr key={bc.id} className={`transition ${rowBg}`}>
                    <td className="px-3 py-3 text-center text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <AuthImage
                        src={c.closeupUrl}
                        alt={c.fullName}
                        className="w-10 h-10 rounded-lg object-cover border border-gray-100"
                        fallback={<div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300">👤</div>}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900 text-xs leading-none">{c.fullName}</p>
                      <p className="text-gray-400 font-mono text-[10px] mt-0.5">{c.candidateCode}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {c.gender ?? '—'} {age != null ? `· ${age}${lang === 'ja' ? '歳' : 'thn'}` : ''}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">{c.eduLabel ?? c.eduLevel ?? '—'}</td>
                    <td className="px-3 py-3">
                      {c.sswKubun && (
                        <span className="text-xs bg-navy-100 text-navy-700 px-1.5 py-0.5 rounded font-medium">
                          {c.sswKubun}
                        </span>
                      )}
                      {(lang === 'ja' ? c.sswFieldJa : c.sswFieldId) && (
                        <p className="text-[10px] text-gray-400 mt-0.5 max-w-24 truncate">
                          {lang === 'ja' ? c.sswFieldJa : c.sswFieldId}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setDrawerBc(bc)}
                        className="text-left hover:underline"
                      >
                        {highest ? (
                          <span className="text-xs font-semibold text-navy-700">{highest.level}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <BodyCheckCard c={c} lang={lang} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      {(c.videos ?? []).length > 0 ? (
                        <button
                          onClick={() => setVideoBc(bc)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          ▶ {c.videos.length}
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => setProfileBc(bc)}
                        className="text-xs text-navy-600 hover:underline"
                      >
                        {lang === 'ja' ? '詳細' : 'Detail'}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={bc.isConfirmed || (atLimit && !isSelected)}
                        onChange={() => toggleSelect(bc.candidateId, bc.isConfirmed)}
                        className="w-4 h-4 accent-navy-700 disabled:opacity-40 cursor-pointer"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawers / Modals */}
      <JapaneseDrawer bc={drawerBc} lang={lang} onClose={() => setDrawerBc(null)} />
      <VideoModal bc={videoBc} lang={lang} onClose={() => setVideoBc(null)} />
      <ProfileModal bc={profileBc} lang={lang} onClose={() => setProfileBc(null)} />

      {/* Confirmation dialog */}
      {showConfirm && (
        <ConfirmDialog
          selectedIds={selectedIds}
          candidateMap={candidateMap}
          lang={lang}
          isPending={confirmMutation.isPending}
          onConfirm={() => confirmMutation.mutate([...selectedIds])}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Selection tray */}
      <SelectionTray
        selectedIds={selectedIds}
        candidateMap={candidateMap}
        lang={lang}
        onRemove={(id) => toggleSelect(id, false)}
        onConfirm={() => setShowConfirm(true)}
      />
    </div>
  );
}
