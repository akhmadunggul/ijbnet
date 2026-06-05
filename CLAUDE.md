# IJBNet — Claude Code Context

## Project
**Bilingual (Bahasa Indonesia / 日本語) SSW Candidate Placement Platform.**
Connects Indonesian LPK training centers, IJBNet staff, and Japanese recruiting companies for Specified Skilled Worker (SSW) placement.

## Stack
- **Monorepo:** `pnpm` workspaces
- **Backend:** Express + TypeScript + Sequelize + MySQL (port 3001)
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS (port 5173)
- **Cache:** Redis (token blacklist, session management)
- **Storage:** VPS filesystem via Docker named volume (`/app/uploads`)

## Current State
- P01 (Foundation)        — ✅ COMPLETE — scaffold, migrations, auth, seeder
- P02 (Candidate Portal)  — ✅ COMPLETE — 7-tab profile, consent, photo upload, data export
- P03 (Admin Portal)      — ✅ COMPLETE — candidate review, body check, videos, status transitions
- P04 (Selection UI)      — ✅ COMPLETE — recruiter batch selection, quota enforcement, interview proposals
- P05 (Workflow)          — ✅ COMPLETE — manager portal, batch management, approval, interview scheduling, emails
- P06 (Super Admin)       — ✅ COMPLETE — user management, LPK/company management, audit logs, global settings

## Roles
`candidate` | `admin` | `manager` | `recruiter` | `super_admin`

## Demo Credentials
- **Super Admin:** `superadmin@ijbnet.org` / `Demo1234!`
- **Manager:** `manager@ijbnet.org` / `Demo1234!`
- **Admin:** `admin@ijbnet.org` / `Demo1234!`
- **Recruiter:** `recruiter@yamada.co.jp` / `Demo1234!`
- **Candidate 1:** `ahmad.fauzi@candidate.ijbnet.org` / `Demo1234!` (CDT-0142)
- **Candidate 2:** `hendra.kusuma@candidate.ijbnet.org` / `Demo1234!` (CDT-0181)
- **Candidate 3:** `budi.santoso@candidate.ijbnet.org` / `Demo1234!` (CDT-0138)

---

## Rules — Follow on every task
- **Never stub:** Implement logic fully. No placeholders.
- **Data Privacy:** `serializeCandidate()` is mandatory for **all** outbound candidate data.
- **i18n First:** All UI strings must use i18n keys. Never hardcode text.
- **Security Messaging:** Login failures must always return `INVALID_CREDENTIALS`.
- **Migrations:** Use Sequelize migrations for all schema changes.
- **Type Safety:** Run `tsc --noEmit` on relevant workspaces after every change.
- **Circular refs:** Always call `.toJSON()` on Sequelize model instances before `res.json()`.
- **No stubs:** Every endpoint must be fully implemented — no `// TODO` or placeholder returns.

---

## Privacy & Compliance (UU PDP / GDPR)
- **Lawful Basis:** Every `candidate` registration must include a `consent_given: boolean` timestamped in the database.
- **Purpose Limitation:** Data is strictly for SSW placement. No third-party tracking/marketing.
- **Right to Erasure:** Deleting a candidate must trigger a "Hard Delete" of:
    1. Database records (Candidate, Applications, etc.)
    2. Physical files (`closeup` and `fullbody` WebP files) from `/app/uploads`.
- **Audit Logging:** **Mandatory.** Every read access to candidate PII by `admin`, `manager`, or `recruiter` must be logged in the `audit_logs` table (Who, Whom, When, Action). Include `targetCandidateId` on all candidate-related audit entries.
- **Data Portability:** Candidates can download their own data as JSON via `GET /api/candidates/me/export`.
- **Security:** Use `bcrypt` (12+ rounds) for passwords and TLS 1.3 for all data in transit.

---

## Image Storage & Processing
- **Utility:** `apps/backend/src/utils/storage.ts` using `sharp`.
- **Standard:** Convert all uploads to **WebP** (Quality: 80).
- **Slots:**
    1. **`closeup`**: Center-square crop, 800×800px → saved as `closeup.webp`
    2. **`fullbody`**: Maintain ratio, max-height 1920px → saved as `fullbody.webp`
- **DB fields:** `closeupUrl` and `fullbodyUrl` (NOT facePhotoUrl / bodyPhotoUrl)
- **Validation:** 5MB max upload size; `file-type` magic-byte check; **EXIF metadata stripping** via `.rotate()` is mandatory.
- **Serve path:** `GET /api/uploads/candidates/:candidateId/:filename` (JWT Auth required)

---

## Access Control (RBAC)
- `candidate`: own profile only
- `recruiter`: only candidates within their **allocated batch** (scoped by companyId)
- `admin`: only candidates within their **LPK** (scoped by lpkId)
- `manager`: **all** candidates across all LPKs (no scope restriction)
- `super_admin`: full access to everything
- All `:id` and `:candidateId` params must be validated with `isUUID(4)`
- Access to candidate photos enforces the same RBAC as the API

---

## Serializer Rules (`serializeCandidate`)
| Field | candidate | admin | manager | recruiter | super_admin |
|---|---|---|---|---|---|
| email / phone / address | shown | hidden | shown | `{ masked: true }` | shown |
| nikEncrypted | shown (decrypted) | omitted | omitted | omitted | shown (decrypted) |
| bankAccountEncrypted | omitted | omitted | omitted | omitted | shown (decrypted) |
| internalNotes | omitted | shown | shown | omitted | shown |
| visionEncrypted / tattooEncrypted | omitted | omitted | omitted | omitted | shown (decrypted) |
| completeness | shown | shown | shown | shown | shown |

---

## Key File Locations
```
apps/backend/src/
  config/index.ts          — Zod-validated env
  config/passport.ts       — Google OAuth strategy
  db/connection.ts         — Sequelize instance
  db/models/               — 16 Sequelize models
  db/migrations/           — 7 migration files (20250101000001-000007)
  db/seeders/              — demo data seeder
  middleware/auth.ts       — JWT verify + isActive guard
  middleware/requireRole.ts — role guard factory
  middleware/serialize.ts  — field-masking serializer
  middleware/auditLog.ts   — audit log writer
  routes/index.ts          — central router
  routes/auth.ts           — login, OAuth, refresh, logout, me
  routes/candidate.ts      — /api/candidates/me/*
  routes/admin.ts          — /api/admin/*
  routes/recruiter.ts      — /api/recruiter/*
  routes/uploads.ts        — /api/uploads/* (auth + RBAC scoped)
  utils/crypto.ts          — AES-256-GCM encrypt/decrypt
  utils/jwt.ts             — sign/verify tokens
  utils/storage.ts         — VPS photo save/delete (WebP via sharp)
  utils/completeness.ts    — profile completeness calculator
  utils/notify.ts          — notifyUser / notifyByRole helpers
  utils/youtube.ts         — YouTube URL validator + ID extractor

apps/frontend/src/
  store/authStore.ts       — Zustand auth (user, accessToken)
  store/selectionStore.ts  — Zustand recruiter selection state
  lib/api.ts               — Axios instance with refresh interceptor
  lib/i18n.ts              — react-i18next setup
  locales/id.json          — Bahasa Indonesia strings
  locales/ja.json          — Japanese strings
  pages/LoginPage.tsx      — login with Google + email/password + TOTP
  pages/candidate/         — /portal/* (CandidateLayout + 3 pages)
  pages/admin/             — /admin/* (AdminLayout + 6 pages)
  pages/recruiter/         — /recruiter/* (RecruiterLayout + 5 pages: requests, selection, confirmed, interviews, notifications)
  pages/manager/           — /manager/* (ManagerLayout + 7 pages: dashboard, batches, batch detail, candidates, requests, interviews, notifications)
  pages/superadmin/        — /superadmin/* (SuperAdminLayout + 7 pages: dashboard, users, candidates, companies, LPKs, audit logs, settings)
  emails/                  — transactional email templates (batchActivated, interviewScheduled, interviewResult, profileApproved, profileSubmitted)
```

---

## Prompt Series
- **P01 — Foundation:** ✅ Scaffold, DB models, migrations, auth
- **P02 — Candidate Portal:** ✅ Profile editor, consent, photo upload, data export
- **P03 — Admin Portal:** ✅ Candidate review, body check, videos, status transitions
- **P04 — Selection UI:** ✅ Recruiter batch selection, quota, interview proposals
- **P05 — Workflow:** ✅ Manager portal, batch management, approvals, interview scheduling, emails
- **P06 — Super Admin:** ✅ User management, LPK/company management, audit logs, global settings

---

## Known Issues / Tech Debt
- Sequelize model instances must always call `.toJSON()` before `res.json()` — circular ref bug
- `multer` 1.x deprecation warning — upgrade to 2.x when needed
- `pnpm approve-builds` required for bcrypt, esbuild, sharp on fresh installs


## Version
- v0.1.0 — First working deployment
- v0.1.1 — Fix Google OAuth new user infinite loading
- v0.1.2 — Fix Caddyfile POST 405, Google OAuth fully working
- v0.1.3 — Unlock NIK field: candidates can now self-enter encrypted NIK
- v0.1.4 — Fix candidate photo upload (file-type ESM/CJS, multipart boundary, locked profile UX)
- v0.1.5 — Bug fixes: recruiter page empty after batch approval, manager candidate detail blank, Google OAuth candidates invisible to admins (lpkId null)
- v0.2.0 — Full CV form update: 9-tab candidate profile, certifications, education history, bilingual PR/motivation fields, extended personal tab
- v0.2.1 — SSW sector/field lookup table with cascading dropdowns; sswFieldFilter dropdown in batch creation
- v0.2.2 — Fix SSW dropdowns empty: move base data from seeder into migrations (000018, 000019); add 7 new SSW1 sectors and expand SSW2 to 11 sectors
- v0.2.3 — Candidate data export: formatted PDF via puppeteer-core (10 sections, IJBNet branding); fix export button loading state + Chromium in Docker
- v0.2.4 — CV bilingual labels consolidated to single line (・ separator); print fix; login page Powered By logos; root package.json version sync
- v0.2.5 — Version-aware consent: consentUpToDate field, superadmin push-to-all-users, ConsentModal loads real clause from DB
- v0.2.6 — Add Trainee as third kubun category; ENUM migration, model/type/UI updates across all roles
- v0.2.7 — Rename SSW column/tab to Program across admin, manager, candidate, and recruiter portals
- v0.2.8 — Candidate status timeline: full process stepper, per-stage duration tracking (hours stored, days displayed)
- v0.2.9 — Add 仮内定 (provisional acceptance) as final timeline step; manager can issue from candidate detail page
- v0.2.10 — Timeline stepper shows all 14 steps (completed + current + upcoming); duration display i18n (hari/日)
- v0.2.11 — Trainee sector/field data (7 sectors, 33 fields); auto-migrate on container startup; Docker pnpm cache mounts
- v0.2.12 — Recruitment request workflow: recruiter submits request → manager confirms + auto-creates batch (1.5× quota); full bilingual UI
- v0.2.13 — Full end-to-end recruitment flow: manager selects candidates (2×) from pool on confirm; candidate picks preferred interview date on dashboard; manager sees candidate preference when finalising; menu renamed to Permintaan Kandidat
- v0.3.0 — Recruiter Permintaan Kandidat page redesign: always-visible form, correct 候補者依頼 Japanese translation, fix invisible submit button (navy-800 undefined in Tailwind palette)
- v0.3.1 — Superadmin Pengaturan Data Entri: control which candidate profile tabs are active/hidden; global_settings DB table; public GET + superadmin PUT API; candidate portal respects config
- v0.3.2 — Security hardening: HTML-escape PDF exports, blacklist refresh token on logout with rotation, MFA backup code login, per-endpoint login rate limit, LIKE wildcard escaping, consent clause validation, allowlist BLOCKED_FIELDS
- v0.3.3 — Remove Alasan Melamar field from candidate profile; auto-translate CV fields (Skill, Motivasi, Promosi Diri) to Japanese via self-hosted LibreTranslate when Japanese version is absent
- v0.3.4 — Superadmin toggle to enable/disable auto-translation; CV Japanese fields fall back to Indonesian when disabled; PDF always falls back to Indonesian when Japanese is empty
- v0.3.5 — Monitoring: trust-proxy fix, per-email login rate limit, alert module (email + Telegram), enhanced /health, system monitor dashboard with active-user and DB req/min time-series charts
- v0.3.6 — Monitor charts: configurable timeline (1h/1d/1w/1m) with DB-persisted snapshots; fix MySQL ONLY_FULL_GROUP_BY error on metrics-history; DB pool 25→35
- v0.3.7 — Grafana-style monitor dashboard: dark theme, smooth bezier curves, gradient fills, Min/Avg/Max/Now stats row, Grafana color palette, glowing status dots
- v0.3.8 — Manager broadcast notifications: send email + in-app notification to All / By LPK / By Program / By Batch with recipient preview
- v0.3.9 — CV enhancements: configurable Japanese font (5 options) from superadmin; auto-translate fallback to Indonesian when disabled and Japanese field is empty; IJBNet logo inserted below candidate photo; superadmin column visibility control for recruiter Dalam Seleksi table (incl. new Foto Badan column); fullbody photo display fix (object-contain)
- v0.3.10 — CV layout: move Tinggi/Berat/Level JP into info table to efficiently fill vertical space beside IJBNet logo; remove standalone one-row table
- v0.3.11 — CV fix: reduce IJBNet logo size for better proportion with candidate photo
- v0.3.12 — Deploy fix: remove ulimits from docker-compose.prod.yml; host kernel rejecting RLIMIT_NOFILE=65536 after system update
- v0.3.13 — Deploy fix: remove ulimits; add Google Drive backup script (rclone); add ijbnet systemd service for auto-start on reboot
- v0.3.14 — Enforce uppercase on all candidate portal form fields and CV (CSS text-transform; CJK characters unaffected)
- v0.3.15 — CV zoom in/out controls (50%–200%, print always resets to 100%); shared across all four roles via single CandidateCV component change
- v0.3.16 — CV zoom in/out controls (50%–200%, print always resets to 100%); shared across all four roles via single CandidateCV component change
- v0.3.17 — CV layout selector in superadmin: Layout 1 (logo below photo) vs Layout 2 (logo at lower-right beside Promosi Diri); persisted in global_settings
- v0.3.18 — Fix monitor page 1d/1w/1m charts: resolve ORDER BY ts ambiguity in MySQL 8.0 (positional ORDER BY 1)
- v0.4.0 — Fix monitor charts 1d/1w/1m permanently empty: metrics_snapshots INSERT was silently failing due to missing created_at default; supply NOW() explicitly
- v0.4.1 — Monitor: replace AVG bucketing with raw 1-min stride sampling (no data loss on spikes); rolling 30-day table retention
- v0.4.2 — Fix CV: Skill and Promosi Diri fields were swapped (selfPr=Keahlian, selfIntro=Promosi Diri)
- v0.4.3 — Monitor charts: hover tooltip with crosshair, timestamp, and exact value; flips side near right edge
- v0.4.4 — Audit log: record login events (password and Google OAuth) with IP, user agent, and method
- v0.4.5 — Superadmin configurable completeness mode: Legacy (23 fields) vs CV (24 CV-visible fields); persisted in global_settings; restored on startup
- v0.4.6 — AI photo background removal: rembg (u2netp) via Python venv in Docker; superadmin colour picker; applies to closeup + fullbody on upload
- v0.4.7 — Fix Docker base image: switch Alpine→node:20-slim (Debian) for rembg/onnxruntime glibc compat; bust stale musl pnpm cache
- v0.4.8 — Fix recruiter selection: candidate notification and timeline event skipped due to Sequelize in-place mutation of isSelected before wasSelected guard
- v0.4.9 — Fix completeness: calcLegacy checked admin-only heightCm/weightKg instead of selfReportedHeight/selfReportedWeight; fix manager approval mutations silently swallowing errors (added onError handlers + error banner)
- v0.5.0 — Fix recruiter ConfirmDialog: buttons unreachable when many candidates selected (no max-height); add full navy/gold Tailwind palette (was missing 200/300/400/600/800 navy and 50/200/600/700 gold — root cause of recurring invisible-button class of bug)
- v0.5.1 — Fix recruiter selection: batch in 'approved'/'closed' status caused consistent 404 on every Konfirmasi attempt; add canSelect gate (read-only mode for non-selectable batches); typed onError with code-specific messages
- v0.5.2 — Remove recruiter_selected timeline step: unreliable (batch already approved by the time recruiter confirms); removed from PROCESS_STEPS, RECRUITER_EVENTS filter, and recordTimelineEvent call; RECRUITER_SELECTED in-app notification retained; DB ENUM preserved for backward compat
- v0.5.3 — Fix photo background removal: pre-flatten input alpha to white; resize to final dimensions before rembg (reduces mask upscale from 12× to 2.5×); erode alpha mask (blur σ=1 + threshold 100) to eliminate hairline colour fringe around subject
- v0.5.4 — Fix photo background hairline (take 2): raise alpha threshold from 100 to 230; boundary pixels with rembg alpha 100–229 were promoted to fully opaque but retained blended face+background colour; threshold 230 keeps only ≥90%-confidence foreground pixels
- v0.5.5 — Fix photo background hairline (take 3): threshold alone cannot fix RGB contamination baked in by camera optics; two-step: threshold(250) hard-cuts all contaminated boundary pixels, blur(0.5) re-feathers the clean edge for natural anti-aliasing
- v0.5.6 — Replace background removal engine: rembg/u2netp → briaai/RMBG-1.4 (HuggingFace); OpenCV Haar Cascade face-centred crop for closeup; Gaussian blur alpha compositing for fringe-free edges; Python script at apps/backend/src/python/remove_bg.py
- v0.5.7 — Extract image processing into dedicated sidecar container (apps/image-processor/ FastAPI); model loads once at startup; backend calls HTTP instead of spawning subprocess; fix consent modal stuck open when audit/timeline write fails
- v0.5.8 — CV completeness: 21-field baseline (removes career + tests/certs not required at registration); superadmin setting descriptions updated; Submit Profile button always visible but disabled until profile 100% complete + consent given
- v0.5.9 — Node.js cluster mode: master forks os.cpus() workers; dead workers auto-restart; SET_COMPLETENESS_MODE IPC broadcast keeps in-memory state consistent; snapshotMetrics() runs on worker 1 only to prevent duplicate DB writes; CLUSTER_WORKERS env override
- v0.6.0 — Prometheus + Grafana monitoring stack: prom-client metrics (HTTP req/s, latency histogram, DB queries, 429 hits, 5xx errors, active users, Node.js heap/event loop); /api/metrics scrape endpoint (internal only); Grafana served at /grafana subpath via Caddy; auto-provisioned datasource + IJBNet overview dashboard; superadmin monitor page replaced with health cards + Grafana link; DB pool max raised 35→50; k6 load test expanded to 50 VUs / 50 candidate accounts
- v0.6.1 — Fix Grafana "no data": Prometheus now scrapes backend:3001/api/metrics (not port 9464); IPv4-mapped IPv6 IP allowlist fix (strip ::ffff: prefix before checking); CLUSTER_WORKERS=1 in prod compose to ensure stable single worker
- v0.6.2 — Monitoring stack confirmed operational: Prometheus target UP, all ijbnet_* metrics flowing, Grafana IJBNet Overview dashboard live at /grafana
- v0.6.3 — Fix closeup photo processing: validate passport framing before cropping; if the frame is already square (±10%) and the computed crop window covers ≥90% of the original frame, skip coordinate-shifting entirely and run only background removal on the full frame; no-face fallback applies the same square-aspect check before centre-cropping
- v0.6.4 — Bump version: sync all package.json versions (root, backend, frontend) to match CLAUDE.md version track
- v0.6.5 — Fix closeup photo processing (take 2): rewrite _passport_ok with three-condition logic (square aspect, horizontal symmetry, face-fills-frame); add clamped-square-crop path for portrait photos where face is large (crop formula exceeds frame), preserving 21% face-top headroom without padding; fix Sharp fallback to use fit:fill instead of fit:cover for already-square inputs
- v0.6.6 — Recruiter portal Japanese UX improvements: localize Trainee→研修生 in forms and filters; translate gender M/F to 男性/女性 in table rows; SSW field filter dropdown now shows Japanese field names; add submission date and sector columns to request history; append 名 unit to all candidate counts; selection tray shows candidate name alongside code; katakana (フリガナ) shown below candidate names across Selection/Confirmed/Interviews pages; body-check tooltip changed from hover to click (touch-compatible); full-body photo link relabelled to 全身写真; video button shows count label; interview date proposal uses progressive add/remove slots instead of three fixed inputs; replace emoji sidebar icons with SVG icons; language toggle label clarified to インドネシア語; proposed dates visible on mobile; nameKatakana added to interviews backend sub-query and frontend type; sswKubun type corrected to include Trainee
- v0.6.7 — Recruiter selection: convert Japanese exam result from right-side drawer to centered modal (consistent with video/profile modals); enlarge fullbody photo from constrained white card to full-screen dark-canvas viewer (flex-1 min-h-0 layout, image fills remaining viewport height)
- v0.6.8 — Replace LibreTranslate with DeepSeek API for Indonesian→Japanese auto-translation; DEEPSEEK_API_KEY in .env; remove libretranslate container + lt_models volume from all compose files; auto-translate extended to shokumu fields (careerSummaryId→Ja, dutiesId→dutiesJa, achievementsId→achievementsJa)
- v0.6.9 — 職務経歴書 (Resume) tab: new candidate profile Tab 10 with bilingual career summary, per-company duties/achievements, A4 PDF export, and merged CV+shokumu PDF; superadmin A/B rollout control (all users vs selected LPKs); CV Japanese formatting (DOB→年月日, age→歳, hobbies auto-translated); superadmin translation service status panel with live latency test
- v0.6.10 — Superadmin translation API key management: configure DeepSeek API key from UI (stored AES-256-GCM encrypted in DB); DB key takes precedence over .env; masked key display with source badge (DB/Env/Missing); clear button reverts to env fallback
- v0.6.11 — Shokumu PDF: auto-translate missing Japanese fields (careerSummaryId, dutiesId, achievementsId, selfPrId, selfIntroId) at render time via active translation service, saved back to DB; resume preview modal (full-screen iframe with toolbar, download + close)
- v0.6.12 — Translation hardening: per-user (15/min) + global (120/min) rate limiting; structured JSON request logging with context/user-hash/latency; user_id (SHA-256 hashed JWT sub) sent to DeepSeek for content safety; 504 timeout vs 502 API error distinction; 20s live / 25s background timeouts
- v0.6.13 — Security hardening (threat model top-2): (1) Zod allowlist validation on all 6 candidate mutation endpoints — replaces BLOCKED_FIELDS denylist, .strict() schemas reject unknown keys with 422; (2) Puppeteer pool caps concurrent Chromium processes at 3 with 45s queue timeout + per-user PDF rate limit (5/5min); PDF Japanese font fix (fonts-noto-cjk in Docker, Noto CJK JP in all font stacks); shokumu settings shows active CV font
- v0.6.14 — Resume preview adopts CV method: new ShokumuCV React component renders 職務経歴書 in-browser (mirrors shokumuTemplate.ts); ShokumuCVPage at /portal/shokumu with back/print/download toolbar; live auto-translate for missing Japanese fields; zoom controls; window.print() support — replaces iframe PDF blob preview
- v0.6.15 — Align ShokumuCV preview UI exactly with CandidateCV: −/[pct%]/+ zoom controls (right-aligned, 50–200% in 10% steps); print CSS via dangerouslySetInnerHTML inside container; <> fragment wrapper
- v0.6.16 — Fix ShokumuCV preview: add A4 page border (2px solid #000), white background, print-margin padding, boxSizing to S.doc so the preview accurately shows where the A4 boundary is
- v0.6.17 — Two resume templates: Generic (existing modern layout) and Gakken Template (standard Japanese table-based form with 職歴/学歴 tables, navy section headers); superadmin template selector; candidate tab shows active template badge and hides 経歴要約 for Gakken; preview and PDF both respect the selected template
- v0.6.18 — Fix Gakken template: rewrite to faithfully follow reference document structure — spread title (職　務　経　歴　書) with date right-aligned, name row with bottom border, 職務要約 boxed section, per-company 職務経歴 blocks (company sub-header + 事業内容/資本金/売上高/従業員数 info line + TH/TD table for 期間/部署/担当業務/実績・成果), 経験・知識・技術 section, bordered 資格 and 自己ＰＲ boxes, 以上 footer; remove photo, 学歴, and navy section-bar styling
- v0.6.19 — Gakken template: 5-column 職務経歴 table (機関/担当製品/業務タイトル/担当業務/メンバー・役割); centered title, right-aligned date and 氏名; add 3 new bilingual career fields (productId/Ja, jobTitleId/Ja, memberRoleId/Ja) with DB migration 000032; ShokumuTab shows new fields only when Gakken template is active; auto-translate extended to all 5 ID→JA field pairs on save and PDF render; i18n keys added to id.json and ja.json
- v0.6.20 — Security: add Content-Security-Policy header (ZAP pentest finding); Caddy was serving the React SPA without CSP — added to all three Caddyfiles (prod uses @csp_routes matcher to exclude Grafana); policy covers Google Fonts, Google OAuth, YouTube embeds, 'unsafe-inline' styles (required for CV print CSS injection); Helmet CSP made explicit with strict API-only policy
- v0.6.21 — Security: ZAP findings 2 + 4 — add explicit HTTP→HTTPS permanent redirect block to Caddyfile.prod (plain HTTP was serving content without CSP or redirect); add Cache-Control: no-cache, no-store, must-revalidate for / and *.html across all three Caddyfiles (SPA shell was uncached; hashed static assets retain immutable cache)
- v0.6.22 — Security: ZAP findings 3 + 1 — self-host DM Serif Display and Inter WOFF2 fonts (public/fonts/); replace Google Fonts <link> tags in index.html with local fonts.css eliminating SRI gap; extract CV print CSS from dangerouslySetInnerHTML into static files (public/css/candidate-cv-print.css, shokumu-print.css, gakken-print.css) loaded via useEffect <link> injection; drop 'unsafe-inline' from style-src in all Caddyfiles; CSP now allows fonts.googleapis.com/fonts.gstatic.com only for dynamically loaded Noto JP CV fonts
- v0.6.23 — Fix Data Utama Simpan button always staying dirty: personalSchema included email and nik but patchMeSchema's .strict() (v0.6.13) rejects unknown keys — every save silently returned 422, reset(data) was never reached, isDirty stayed true; fix strips email+nik before calling onSave (nik uses /me/nik separately; email is not patchable); adds visible error on save failure; also resolves marital status update failure for LPK Humaira candidates
- v0.6.24 — Fix stale JP certification gate on profile submit: submit button checked candidate.tests.length === 0 and showed "belum memenuhi kelayakan sertifikasi bahasa Jepang" warning instead of submitting — blocking candidates who fulfilled all 21 fields; Japanese tests were removed from completeness requirements so this gate was obsolete; removed check, showJpWarning state, and dialog entirely
- v0.6.25 — Auto-translate Uraian Pekerjaan (division/skillGroup) in Pengalaman Kerja to Japanese on career save; divisionJa + skillGroupJa stored in DB (migration 000033); CandidateCV renders Japanese text with Indonesian fallback; candidatePdf.ts uses Japanese text for career columns
- v0.6.26 — chore: bump version; verify career translation logic — no regressions found
- v0.6.27 — Fix career save silently failing since v0.6.13: defaultValues spread (…c) included id + shokumu fields not in the .strict() schema — every save returned 422, career data was never updated; mutationFn now strips entries to only the 5 expected fields; adds visible onError banner
- v0.6.28 — Gakken resume redesign: new candidate_gakken_resumes + candidate_gakken_companies DB tables (migrations 000034, 000035); dedicated GET/PATCH /api/candidates/me/gakken-resume routes with auto-translate; Gakken ShokumuTab shows structured form (職務要約, 現在経歴 company info, variable per-company rows, 経験・知識・技術, 自己PR); GakkenCV renders from new tables; gakkenTemplate.ts updated; generic template unchanged
- v0.6.29 — Fix Gakken form: remove (自己PR) from 職務要約 Japanese field label; Japanese fields greyed and locked when auto-translate is enabled; superadmin shokumu section shows auto-translate status badge when Gakken template is active
- v0.6.30 — Fix Gakken resume auto-translate: (1) wrong DB key auto_translate→auto_translate_enabled; (2) stale JA value in payload blocked re-translation — backend now discards client JA values when auto-translate is on and always re-translates ID fields; same fix for per-company entries
- v0.6.31 — Manager batch CV download: checkboxes on ManagerCandidates table (select-all per page + individual), "Download CV (n)" button POSTs candidateIds to POST /api/export/candidates/batch-cv.pdf; backend concatenates HTML for all selected candidates with page breaks and renders as one PDF; max 50 per batch; audit log per candidate
- v0.6.32 — Fix batch CV to use formatted CandidateCV style (bilingual, IJBNet logo, photo) instead of data export: new candidateCvHtml.ts mirrors CandidateCV.tsx as pure HTML; logo embedded as base64; closeup photo embedded per candidate; reads cv_layout + cv_font settings
- v0.6.33 — Fix batch CV issues: (1) logo base64 was corrupted on write — replaced with correct bytes; (2) 2-page overflow fixed by matching print CSS values (TD padding 3px 4px, container width 100%, row heights 18/24/32px, margins 4px, renderPdf 5mm margins); (3) K6 users included — clear selectedIds via useEffect when any filter changes
- v0.6.34 — Fix batch CV date of birth (Sequelize DATEONLY returns Date object on some rows — toDateStr() normalises both Date objects and strings); auto-translate selfPrJa/motivationJa/selfIntroJa/divisionJa/skillGroupJa for all candidates in batch before rendering — Promise.allSettled ensures single failure never aborts batch; translations saved to DB for caching; combined translate+render in single per-candidate loop so mutated fields are used in HTML
- v0.7.0 — Fix completeness score mismatch: superadmin list and manager batch detail computed calcCompleteness() on candidate data missing educationHistory/career/tests associations → always showed 95% (20/21 in CV mode) while candidate portal correctly showed 100%; extract shared candidateIncludes() utility (utils/candidateIncludes.ts) used by all four routes so association set is guaranteed identical
- v0.7.1 — Superadmin toggle to enable/disable Resume (職務経歴書) download for recruiters (shokumu_recruiter_enabled); new GET /api/recruiter/candidates/:id/shokumu-pdf endpoint (batch-RBAC + feature gate + audit log); gold Resume button on recruiter CV page shown only when enabled; recruiter.ts migrated to shared candidateIncludes()
- v0.7.2 — Recruiter Resume in-browser display (mirrors CV viewer): RecruiterShokumuPage at /recruiter/candidates/:id/shokumu; GET /api/recruiter/candidates/:id/gakken-resume endpoint (batch-RBAC); fix ShokumuResume internal query (was calling candidate-only /me/shokumu → 403 for recruiters, now uses public /superadmin/shokumu-config); GakkenResume accepts optional gakkenEndpoint prop; Resume button navigates to display page instead of triggering PDF download

Current: v0.7.2
Live at: https://jinzai.jobagus.id