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
  pages/recruiter/         — /recruiter/* (RecruiterLayout + 4 pages)
  pages/manager/           — /manager/* (ManagerLayout + 6 pages: dashboard, batches, batch detail, candidates, interviews, notifications)
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

Current: v0.1.5
Live at: https://jinzai.aup.my.id