# IJBNet Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
