# IJBNet Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [v0.4.8] - 2026-05-25

### Fixed
- **Recruiter selection — candidate notification and timeline event silently skipped**: When a recruiter submitted a selection for the first time, neither the `RECRUITER_SELECTED` in-app notification nor the `recruiter_selected` timeline event were recorded. Root cause: `allocMap` held references to the same Sequelize model instances that were mutated in-place by `alloc.update()` inside the update loop. By the time the `wasSelected` guard was evaluated, the map already reflected the post-update value (`true`), causing the `if (!wasSelected)` block to be skipped for every candidate. Fix: snapshot `isSelected` as primitive booleans into a separate `Map<candidateId, boolean>` before the update loop runs.

---

## [v0.4.7] - 2026-05-25

### Fixed
- **Docker base image**: Switched Alpine → `node:20-slim` (Debian) to resolve `glibc` compatibility error with `rembg`/`onnxruntime`; busted stale musl pnpm cache that caused build failures after base image change.

---

## [v0.4.6] - 2026-05-25

### Added
- **AI photo background removal**: `rembg` (u2netp model) runs via Python venv inside the Docker container and automatically removes the photo background on `closeup` and `fullbody` uploads.
- **Superadmin background colour picker**: Choose the replacement background colour applied after removal; persisted in `global_settings`.

---

## [v0.4.5] - 2026-05-25

### Added
- **Superadmin configurable completeness mode**: Two modes — *Legacy* (23 fields, original set) and *CV* (24 CV-visible fields including `lpkId`); persisted in `global_settings` and restored on container startup.

---

## [v0.4.4] - 2026-05-25

### Added
- **Audit log — login events**: Password and Google OAuth login attempts now recorded in `audit_logs` with IP address, user-agent, and authentication method.

---

## [v0.4.3] - 2026-05-25

### Added
- **Monitor chart hover tooltip**: Crosshair overlay with timestamp and exact metric value; tooltip flips side when near the right edge of the chart.

---

## [v0.4.2] - 2026-05-25

### Fixed
- **CV — Skill and Promosi Diri fields swapped**: `selfPr` maps to *Keahlian* (Skill) and `selfIntro` maps to *Promosi Diri*; previously rendered in reverse order.

---

## [v0.4.1] - 2026-05-25

### Changed
- **Monitor charts — raw sampling**: Replaced AVG-bucketed snapshots with raw 1-minute stride sampling to preserve spike data. Added rolling 30-day retention for `metrics_snapshots`.

---

## [v0.4.0] - 2026-05-25

### Fixed
- **Monitor charts 1d/1w/1m permanently empty**: `metrics_snapshots` INSERT was silently failing because the `created_at` column had no default value. Fixed by supplying `NOW()` explicitly on insert.

---

## [v0.3.18] - 2026-05-25

### Fixed
- **Monitor page 1d/1w/1m charts — ORDER BY ambiguity**: Resolved MySQL 8.0 `ONLY_FULL_GROUP_BY` / ORDER BY column ambiguity by using positional `ORDER BY 1`.

---

## [v0.3.17] - 2026-05-25

### Added
- **CV layout selector in superadmin**: Choose between *Layout 1* (IJBNet logo below candidate photo) and *Layout 2* (logo at lower-right beside Promosi Diri section); persisted in `global_settings`.

---

## [v0.3.15] - 2026-05-25

### Added
- **CV zoom controls**: In/out buttons (50%–200% range) added to the CV viewer; print always resets to 100%. Shared across all four roles via a single change to `CandidateCV` component.

---

## [v0.3.14] - 2026-05-25

### Changed
- **Uppercase enforcement**: All candidate portal form fields and CV output now enforce `text-transform: uppercase` via CSS. CJK (Japanese) characters are unaffected.

---

## [v0.3.13] - 2026-05-25

### Added
- **Google Drive backup**: Automated backup script using `rclone` for off-site data protection.
- **ijbnet systemd service**: Auto-start the application on server reboot.

### Fixed
- **Docker — ulimits removed**: `ulimits` removed from `docker-compose.prod.yml`; host kernel was rejecting `RLIMIT_NOFILE=65536` after a system update.

---

## [v0.3.12] - 2026-05-25

### Fixed
- **Docker — ulimits removed**: Same as v0.3.13 (initial fix); `RLIMIT_NOFILE=65536` caused container start failure after host system update.

---

## [v0.3.11] - 2026-05-25

### Fixed
- **CV — IJBNet logo oversized**: Reduced logo size for better visual proportion alongside the candidate photo.

---

## [v0.3.10] - 2026-05-25

### Changed
- **CV layout — info table**: Moved Tinggi/Berat/Level JP fields into the main info table to efficiently fill vertical space beside the IJBNet logo; removed the standalone single-row table.

---

## [v0.3.9] - 2026-05-25

### Added
- **Configurable Japanese font in superadmin**: Choose from 5 font options for Japanese text in generated CVs; persisted in `global_settings`.
- **IJBNet logo in CV**: Logo inserted below the candidate photo in the PDF output.
- **Superadmin column visibility for recruiter Dalam Seleksi table**: Toggle individual columns including the new *Foto Badan* (full-body photo) column.

### Fixed
- **CV — auto-translate fallback**: When auto-translation is disabled and the Japanese field is empty, the CV now falls back to the Indonesian text.
- **Fullbody photo display**: Fixed `object-contain` rendering so the full-body image is not cropped.

---

## [v0.3.8] - 2026-05-25

### Added
- **Manager broadcast notifications**: Send email + in-app notification to all candidates, or filter by LPK, Program (SSW field), or Batch. Recipient preview shown before sending.

---

## [v0.3.7] - 2026-05-25

### Changed
- **Monitor dashboard — Grafana-style redesign**: Dark theme, smooth Bezier curves, gradient area fills, Min/Avg/Max/Now stats row, Grafana colour palette, glowing status indicator dots.

---

## [v0.3.6] - 2026-05-25

### Added
- **Monitor charts — configurable timeline**: 1h / 1d / 1w / 1m zoom levels with DB-persisted snapshots for historical views.

### Fixed
- **Monitor — MySQL ONLY_FULL_GROUP_BY error**: Resolved `metrics-history` query failure on strict MySQL 8.0 mode.

### Changed
- **DB connection pool**: Increased from 25 → 35 connections.

---

## [v0.3.5] - 2026-05-25

### Added
- **System monitor dashboard**: Real-time active-user count and DB requests/min time-series charts accessible to super admins.
- **Alert module**: Email and Telegram alerts for critical system events.
- **Enhanced `/health` endpoint**: Additional DB and service health checks.
- **Per-email login rate limit**: Rate limiting scoped to email address in addition to IP.

### Fixed
- **trust-proxy**: Configured correctly so client IPs are read from `X-Forwarded-For` behind the Caddy reverse proxy.

---

## [v0.3.4] - 2026-05-25

### Added
- **Superadmin auto-translation toggle**: Enable or disable automatic Indonesian→Japanese CV field translation globally.

### Changed
- **CV Japanese fields**: Fall back to Indonesian text when auto-translation is disabled and the Japanese field is empty. PDF always uses Indonesian as fallback when Japanese is absent.

---

## [v0.3.3] - 2026-05-25

### Added
- **Auto-translate CV fields**: *Skill*, *Motivasi*, and *Promosi Diri* are automatically translated to Japanese via a self-hosted LibreTranslate instance when the Japanese version is absent.

### Removed
- **Alasan Melamar field**: Removed from the candidate profile editor and CV output.

---

## [v0.3.2] - 2026-05-25

### Security
- **HTML-escaped PDF exports**: Prevent XSS via candidate-supplied text in generated CVs.
- **Refresh token blacklisting on logout**: Tokens are invalidated in Redis on logout with rotation to prevent reuse.
- **MFA backup code login**: Candidates can authenticate with one-time backup codes when TOTP device is unavailable.
- **Per-endpoint login rate limit**: Login attempts rate-limited per IP and per endpoint.
- **LIKE wildcard escaping**: Escaped `%` and `_` in search queries to prevent SQL injection via wildcard abuse.
- **Consent clause validation**: Server validates that the submitted consent clause ID matches the current active clause.
- **BLOCKED_FIELDS allowlist**: Hardened the candidate self-edit endpoint to reject writes to sensitive system fields via an explicit allowlist.

---

## [v0.3.1] - 2026-05-25

### Added
- **Superadmin — Pengaturan Data Entri**: Control which candidate profile tabs are active or hidden platform-wide. Settings stored in the new `global_settings` DB table. Public `GET` endpoint returns active configuration; candidate portal respects the setting.

---

## [v0.3.0] - 2026-05-25

### Changed
- **Recruiter Permintaan Kandidat page redesign**: Always-visible request form (no modal). Corrected Japanese label to 候補者依頼.

### Fixed
- **Invisible submit button**: `navy-800` colour token is not defined in Tailwind; replaced with `navy-700`.

---

## [v0.2.13] - 2026-05-25

### Added
- **Full end-to-end recruitment flow**: Manager selects 2× quota candidates from the approved pool when confirming a request. Candidate picks their preferred interview date slot on the candidate dashboard. Manager sees the candidate's preference when finalising the interview schedule.

### Changed
- **Menu label**: "Permintaan" renamed to "Permintaan Kandidat" across recruiter and manager portals.

---

## [v0.2.12] - 2026-05-25

### Added
- **Recruitment request workflow**: Recruiter submits a candidate placement request (kubun, SSW field, count, notes) → Manager reviews and confirms → Batch auto-created at 1.5× quota. Full bilingual UI for both recruiter and manager sides.

---

## [v0.2.11] - 2026-05-25

### Added
- **Trainee sector/field data**: 7 sectors and 33 fields seeded for the Trainee kubun.
- **Auto-migrate on container startup**: Pending Sequelize migrations now run automatically when the backend container starts.
- **Docker pnpm cache mounts**: BuildKit cache mounts for `pnpm install` to speed up image builds.

---

## [v0.2.10] - 2026-05-25

### Changed
- **Timeline stepper — all 14 steps visible**: Shows completed steps, the current step, and all upcoming steps in one view. Duration display uses i18n keys (`hari` / `日`).

---

## [v0.2.9] - 2026-05-25

### Added
- **仮内定 (Provisional Acceptance)**: Final timeline step representing the provisional job offer. Manager can issue it from the candidate detail page.

---

## [v0.2.8] - 2026-05-25

### Added
- **Candidate status timeline**: Full process stepper visible on the candidate dashboard showing all recruitment stages. Per-stage duration tracked in hours (stored in DB) and displayed in days.

---

## [v0.2.7] - 2026-05-25

### Changed
- **"SSW" renamed to "Program"**: The SSW column/tab label is now "Program" across the admin, manager, candidate, and recruiter portals for clarity.

---

## [v0.2.6] - 2026-05-25

### Added
- **Trainee kubun**: Added *Trainee* as a third placement category alongside SSW1 and SSW2. Includes ENUM migration, model update, and UI changes across all roles.

---

## [v0.2.5] - 2026-05-25

### Added
- **Version-aware consent**: `consentUpToDate` field on candidates tracks whether they have accepted the current consent clause version. Superadmin can push a new clause to all users, triggering the consent modal on next login. `ConsentModal` loads the real clause text from the DB instead of hardcoded copy.

---

## [v0.2.4] - 2026-05-25

### Changed
- **CV — bilingual labels on a single line**: Indonesian and Japanese labels consolidated with a `・` separator for a cleaner layout.

### Fixed
- **CV print layout**: Fixed page-break and font rendering issues in printed output.
- **Login page**: Added *Powered By* logos to the login card footer.
- **Root package.json version**: Synced root version to match CLAUDE.md release version.

---

## [v0.2.3] - 2026-05-25

### Added
- **Candidate data export — formatted PDF**: `GET /api/candidates/me/export` now generates a 10-section PDF with IJBNet branding via `puppeteer-core`.

### Fixed
- **Export button loading state**: Button correctly shows a spinner while the PDF is being generated.
- **Chromium in Docker**: Resolved Chromium binary path detection for containerised Puppeteer.

---

## [v0.2.2] - 2026-05-25

### Fixed
- **SSW dropdowns empty on fresh install**: Moved SSW sector/field base data from the seeder into permanent migrations (000018, 000019) so the data is always present regardless of whether the seeder has run.

### Added
- 7 new SSW1 sectors.
- SSW2 expanded to 11 sectors.

---

## [v0.2.1] - 2026-05-04

### In Progress
- CV page implementation for all portals (Stage 1-4)
- Missing CV fields added to database schema

---

## [v0.2.0] - 2026-05-04

### Added
- **Candidate profile — 9 tabs**: Two new tabs added to the candidate profile editor:
  - **Tab 8 — Sertifikasi / 資格**: Full CRUD for `candidate_certifications` (certName, certLevel, issuedDate, issuedBy) via `PUT /api/candidates/me/certifications`
  - **Tab 9 — PR & Motivasi / PRと志望動機**: Bilingual text fields for selfPrId/Ja, motivationId/Ja, applyReasonId/Ja, selfIntroId/Ja saved via `PATCH /api/candidates/me`
- **Extended Personal tab (Tab 1)**:
  - nameKatakana, bloodType (enum), religion (enum)
  - hasVisitedJapan / hasPassport (boolean checkboxes)
  - selfReportedHeight / selfReportedWeight
  - hobbies
- **Extended Education tab (Tab 3)**:
  - Full education history CRUD (fieldArray with sortOrder) via `PUT /api/candidates/me/education-history`
  - Existing single-level edu fields retained above the history list
- **Backend CRUD endpoints**:
  - `PUT /api/candidates/me/certifications` — bulk replace certifications
  - `PUT /api/candidates/me/education-history` — bulk replace education history
- **Admin & Manager candidate includes**: `certifications` and `educationHistory` now included in `findScopedCandidate` (admin) and `candidateIncludes()` (manager)
- **i18n coverage**: All new fields keyed in both `id.json` and `ja.json`

### Notes
- Career labels in Tab 4 now use i18n keys (previously hardcoded English)
- Japanese tab uses i18n keys for labels (previously hardcoded)
- Workplan tab now uses i18n keys for marital status options

---

## [v0.1.5] - 2026-05-04

### Added
- **nameKatakana** field — Japanese name in katakana
- **bloodType** field — golongan darah (A/B/AB/O/A+/B+/AB+/O+/Unknown)
- **religion** field — agama (Islam/Kristen/Katolik/Budha/Hindu/Lainnya)
- **hasVisitedJapan** boolean — pengalaman ke Jepang
- **hasPassport** boolean — kepemilikan paspor
- **hobbies** text field — hobi
- **selfPrId / selfPrJa** fields — keahlian / 得意
- **motivationId / motivationJa** fields — motivasi / 志望理由
- **applyReasonId / applyReasonJa** fields — alasan melamar / 応募の動機
- **selfIntroId / selfIntroJa** fields — promosi diri / 自己PR
- **selfReportedHeight / selfReportedWeight** — tinggi/berat badan mandiri
- **candidate_certifications** table — sertifikasi / 認定
- **candidate_education_history** table — riwayat pendidikan lengkap / 学歴

### Fixed
- **Recruiter pages empty after batch approval**: `getActiveBatch` now includes
  `approved` status so recruiters can still see confirmed candidates and
  interview proposals after a manager approves the batch.
- **Manager candidate detail blank page**: `useQuery` was returning the full
  `{ candidate: {} }` wrapper instead of unwrapping `.candidate`, causing all
  fields to be undefined. Fixed `queryFn` and moved notes initialisation from
  `select` (render-phase state update) to `useEffect`.
- **Google OAuth candidates invisible to admins**: Candidates registered via
  Google OAuth were created with `lpkId = null`, making them invisible to all
  admins whose list filters by `lpkId`. Added a one-time LPK picker to the
  candidate profile personal-data tab and a `GET /api/candidates/lpks` endpoint.
  `lpkId` can now be set by the candidate once (locked after first save).

### Notes
- All new columns are nullable — no impact on existing data
- Frontend form updates planned for v0.2.0

---

## [v0.1.3] - 2026-04-20

### Fixed
- **Consent Modal — Agree button silent fail**: The agree button now correctly
  calls PATCH /api/candidates/me/consent with a valid auth token and closes
  the modal on success.
- **Consent Modal — Decline button redirect**: Clicking Decline no longer
  redirects to the login page. It now shows an inline warning message keeping
  the modal open.
- **Consent Modal — auth middleware missing**: Added authenticate +
  requireRole('candidate') middleware to PATCH /api/candidates/me/consent
  endpoint which was previously unauthenticated.
- **Consent Modal — token not sent**: ConsentModal now reads the access token
  directly from authStore and passes it explicitly in the Authorization header,
  fixing silent failures for Google OAuth users.
- **Google OAuth — candidate record not created**: New users authenticating
  via Google OAuth now automatically get a Candidate profile record created
  in the database (profileStatus: incomplete, consentGiven: false).
- **Google OAuth — fullName missing**: Candidate auto-creation now includes
  fullName from Google profile display name.
- **Google OAuth — existing users missing candidate record**: Added check to
  create candidate record for existing users who have a user account but no
  candidate profile.
- **Caddyfile — POST 405 Method Not Allowed**: Rewrote Caddyfile using
  handle blocks to properly separate API proxy from SPA file serving,
  fixing all POST/PATCH/DELETE requests being rejected.
- **Consent Modal — i18n keys displayed as text**: Fixed button labels and
  title showing raw i18n keys (candidate.consent.agree, candidate.consent.title)
  instead of translated text.
- **Consent Modal — error messages in English**: Translated error messages
  to Bahasa Indonesia:
  - "Failed to record consent. Please try again."
    → "Gagal menyimpan persetujuan. Silakan coba lagi."
  - "You must agree to the data consent to use IJBNet."
    → "Anda harus menyetujui penggunaan data untuk menggunakan IJBNet."
- **Japanese text encoding**: Fixed garbled Japanese text in consent modal body.
- **DB migration — consentClauseId missing column**: Added missing migrations
  (000010 create-consent-clauses, 000011 add-consent-clause-id-to-candidates)
  to production database.

### Added
- **Version display on login page**: App version (e.g. v0.1.3) now displayed
  at the bottom of the login card.

---

## [v0.1.2] - 2026-04-08

### Fixed
- **Caddyfile — handle block order**: Moved reverse_proxy before file_server
  and try_files to fix POST requests returning 405 Method Not Allowed.
- **Google OAuth — error logging**: Added console.error logging to Google
  OAuth callback for easier debugging.
- **Google OAuth callback — custom authenticate handler**: Rewrote callback
  route to use custom passport.authenticate() handler with explicit error
  and no-user logging.

---

## [v0.1.1] - 2026-04-08

### Fixed
- **Google OAuth — new user infinite loading**: New Google OAuth users now
  land on a welcome screen instead of an infinite loading spinner when they
  have no candidate profile yet.
- **useSearchParams**: OAuthCallbackPage now uses useSearchParams from
  react-router-dom instead of window.location.search to reliably read the
  token from the callback URL.

---

## [v0.1.0] - 2026-04-07

### Added
- Initial production deployment
- Full platform P01-P06 complete:
  - Candidate portal (profile, consent, photo upload, data export)
  - Admin portal (candidate review, body check, video management)
  - Recruiter portal (batch selection, quota enforcement, interview proposals)
  - Manager portal (batch management, approvals, interview scheduling)
  - Super Admin portal (user management, audit log, data export)
- HTTPS via Caddy + Let's Encrypt (auto-renewal)
- Dual-stack IPv4/IPv6 deployment
- Live at https://jinzai.aup.my.id
- Demo credentials for all 5 roles

---

## Known Issues (as of v0.1.3)
- Google OAuth login on dev server requires localhost callback URL registered
  in Google Cloud Console
- Consent clause management (Super Admin) not yet implemented — clause text
  is currently hardcoded in ConsentModal.tsx
- PDF export requires Puppeteer which may need additional setup in production
- SMTP not configured — email notifications log to console only
