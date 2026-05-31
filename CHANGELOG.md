# IJBNet Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [v0.6.14] - 2026-05-31

### Changed
- **Resume preview now uses the same method as the candidate CV**: The "Pratinjau" button in the Resume tab previously fetched a PDF blob from the server and displayed it in a full-screen iframe. It now navigates to a dedicated route `/portal/shokumu` that renders the document as a React component in the browser — identical in approach to how `/portal/cv` works for the candidate CV.
- **New `ShokumuCV` component**: Renders the 職務経歴書 document as React/JSX with inline styles mirroring `shokumuTemplate.ts`. Reads `cv-font` and layout settings from the superadmin API. Live auto-translates missing Japanese candidate-level fields (`careerSummaryId`, `selfPrId`, `selfIntroId`) using the same `jaOverride` mechanism as `CandidateCV`.
- **New `ShokumuCVPage`** at `/portal/shokumu`: page wrapper with Back, Print (`window.print()`), and Download buttons — mirrors `CandidateCVPage`. Zoom controls (50%–150%) and print CSS that isolates the document for clean printing.

---

## [v0.6.13] - 2026-05-31

### Security
- **Zod allowlist validation on all candidate mutation endpoints**: Replaces the previous `BLOCKED_FIELDS` denylist in `PATCH /candidates/me` with an explicit `.strict()` allowlist schema. Unknown keys in request bodies now return `422 INVALID_INPUT` with field-level error details instead of being silently ignored. All 6 mutation endpoints (`PATCH /me`, `PUT /me/career`, `PUT /me/certifications`, `PUT /me/education-history`, `PUT /me/tests`, `PATCH /me/shokumu`) now have typed schemas with max-length caps and enum constraints. New `utils/candidateSchemas.ts` centralises all schemas and a `parseBody()` helper.
- **Puppeteer pool — closes PDF Denial-of-Service vector**: New `utils/browserPool.ts` implements a semaphore-based pool capping concurrent Chromium processes at 3. Excess requests queue for up to 45 seconds then receive `503 PDF_BUSY`; absent Chromium returns `503 PDF_UNAVAILABLE`. All 4 PDF routes (`/me/export`, `/me/shokumu-pdf`, `/me/merged-pdf`, `/export/candidates/:id/profile.pdf`) now call the shared `renderPdf()` instead of spawning their own browser. Previously, an authenticated user could spawn unlimited Chromium processes in parallel, causing an OOM crash.
- **Per-user PDF rate limit**: PDF export endpoints are now capped at 5 requests per user per 5 minutes as a secondary DoS guard.

### Fixed
- **PDF Japanese character rendering**: Production Docker image (`node:20-slim`) ships Chromium but no CJK fonts, causing all Japanese characters to render as tofu boxes. Fixed by adding `fonts-noto-cjk` to the `apt-get install` step in `Dockerfile.prod`. All PDF font stacks updated to list `"Noto Serif/Sans CJK JP"` first so the system font is used immediately without any CDN dependency.

### Changed
- **Shokumu settings shows active CV font**: The Resume/職務経歴書 section in Superadmin settings now shows a read-only badge with the currently active CV font name and a note that the shokumu PDF shares the CV font setting. The backend already used `cv_font` for shokumu PDF rendering — this makes the alignment visible in the UI.

---

## [v0.6.12] - 2026-05-31

### Changed
- **Translation rate limiting**: Live translation endpoint (`POST /translate`) now enforces per-user limit (15 req/min, keyed by JWT sub) and a global guard (120 req/min across all users). Both return structured `429` JSON with distinct error codes.
- **Translation request logging**: Every DeepSeek API call emits a structured JSON log line: `{ context, user (SHA-256 hashed sub, first 16 hex chars), textLen, status, latencyMs, outputLen }`. Context labels: `cv-live`, `auto-save`, `shokumu-save`, `pdf-render`.
- **user_id parameter**: All DeepSeek requests include the `user` field (hashed JWT sub) for content safety flagging and per-user isolation. Raw user ID is never sent to DeepSeek.
- **Timeout handling**: Live translate route returns `504 TRANSLATION_TIMEOUT` on timeout vs `502 TRANSLATION_FAILED` on API error. `translateId2JaDetailed()` exposes the `timedOut` flag. Background translates (save/PDF) use a 25s timeout; live route uses 20s.

---

## [v0.6.11] - 2026-05-31

### Added
- **Shokumu PDF auto-translation**: `GET /candidates/me/shokumu-pdf` now translates missing Japanese fields (`careerSummaryId`, `dutiesId`, `achievementsId`, `selfPrId`, `selfIntroId`) at render time using the active translation service. Translations are saved back to DB so subsequent renders are instant.
- **Resume preview modal**: "Pratinjau / プレビュー" button in the Resume tab fetches the PDF blob and opens it in a full-screen iframe modal with a dark overlay. Modal toolbar has title, Download button, and close (✕). Object URL is revoked on close to free memory. Works for both shokumu-only and merged CV+shokumu modes.

---

## [v0.6.10] - 2026-05-31

### Added
- **Translation API key management in Superadmin**: DeepSeek API key can now be configured directly from the Superadmin settings UI without touching the server's `.env` file. Key is stored AES-256-GCM encrypted in `global_settings`. DB key takes precedence over the `DEEPSEEK_API_KEY` env var. The UI shows source badge (`DB Key` / `Env Var` / `Missing`), masked key (first 6 + last 4 chars), password input, Save button, and Clear button (reverts to env var). Saving validates the key against DeepSeek first; a "Simpan tanpa validasi →" bypass link appears after a failed save.

---

## [v0.6.9] - 2026-05-31

### Added
- **職務経歴書 (Resume) Tab 10**: New candidate profile tab (gated by superadmin toggle) for Japanese-style work history resume. Includes bilingual career summary, per-company duties/achievements/company details (companyType, employeeCount, annualSales, capitalAmount), A4 PDF export, and merged CV+職務経歴書 PDF.
- **Superadmin A/B rollout control**: Superadmin can target the Resume tab to all candidates or selected LPKs only. Eligibility is computed server-side in `GET /candidates/me/shokumu`.
- **Superadmin translation service status panel**: New section in Pengaturan Data Entri shows available translation services with API key status badge, live latency test ("Uji Koneksi"), and HTTP status + error detail on failure.

### Changed
- **CV Japanese formatting**: Date of birth formatted as `YYYY年M月D日`; age unit changed from "tahun" to "歳"; hobbies (趣味) added to the live auto-translate pipeline in the CV component.

---

## [v0.5.8] - 2026-05-26

### Changed
- **CV completeness baseline tightened**: `calcCV` now covers 21 fields — removes career history and tests/certifications (not all candidates have these at registration time). Superadmin setting description updated in both languages to reflect the new 21-field scope.
- **Submit button always visible**: The "Submit Profile" button in the candidate portal is now always rendered when `profileStatus === 'incomplete'`, but disabled (greyed, `cursor-not-allowed`) until both `pct === 100` and `consentGiven`. Previously the button was hidden entirely until both conditions were met.

---

## [v0.5.7] - 2026-05-26

### Changed
- **Image processing extracted to dedicated sidecar container**: Background removal and cropping moved from a per-request Python subprocess into a persistent `image-processor` FastAPI service (`apps/image-processor/`). RMBG-1.4 model loads once at startup and stays in memory — eliminates cold-start delay on every upload. Backend image is now significantly smaller (no Python/torch/opencv). `docker-compose.prod.yml` gains an `image-processor` service with `hf_cache` volume; backend waits for its healthcheck before starting.

### Fixed
- **Consent modal stays open when audit/timeline write fails**: If `recordTimelineEvent` or `AuditLog.create` threw after `candidate.update` succeeded, the API returned 500 even though consent was saved. Audit log and timeline writes are now fire-and-forget. Also fixed consent modal showing for users with no candidate record (new users).

---

## [v0.5.6] - 2026-05-26

### Changed
- **Photo background removal — replace engine with RMBG-1.4**: Switched from rembg/u2netp to `briaai/RMBG-1.4` (HuggingFace Transformers) for background removal. The hairline colour fringe was unfixable via downstream alpha manipulation because boundary pixel RGB is contaminated by camera optics before the model ever runs; only a higher-quality model can produce clean-boundary masks. New pipeline: (1) OpenCV Haar Cascade face detection for passport-style face-centred crop on closeup photos; (2) RMBG-1.4 segmentation via Python subprocess; (3) Gaussian blur alpha compositing (`img × α + bg × (1−α)`) for smooth, fringe-free edges. Python script at `apps/backend/src/python/remove_bg.py`; Node.js `storage.ts` simplified to EXIF-strip + WebP conversion only. Docker image updated with CPU-only PyTorch, Transformers, OpenCV; RMBG-1.4 weights pre-downloaded at build time.

---

## [v0.5.5] - 2026-05-25

### Fixed
- **Photo background hairline (take 3 — correct fix)**: The colour fringe is a colour problem, not a transparency problem. Boundary pixels in the rembg output carry the original photo's physically blended subject+background RGB (camera optics). Raising the threshold could never fix RGB that is already contaminated. Fix: two-step process — `threshold(250)` hard-cuts all contaminated boundary pixels to transparent (only near-100%-confidence foreground pixels survive), then `blur(0.5)` re-feathers the clean tight mask so the new edge composites as natural anti-aliasing against the white fill with zero tint.

---

## [v0.5.4] - 2026-05-25

### Fixed
- **Photo background removal — hairline colour fringe around subject (take 2)**: The previous `threshold(100)` fix removed fully-transparent fringe pixels but promoted boundary pixels with rembg alpha 100–229 to fully opaque — those pixels still carry the original photo's blended subject+background colour, so the ring remained visible. Fix: raise to `threshold(230)`, keeping only pixels where rembg had ≥90% foreground confidence (≤10% background colour contamination, imperceptible on the white fill). Also remove the `blur(1)` pre-step; the pure threshold is simpler and more predictable without the blur causing unintended over-erosion at the edge.

---

## [v0.5.3] - 2026-05-25

### Fixed
- **Photo background removal — hairline fringe around subject**: rembg's soft alpha mask leaves semi-transparent edge pixels that blend the original background colour into the fill colour, producing a visible fringe around the face/subject. Fix: after `removeBackground`, extract the alpha channel, apply Gaussian blur (σ=1) to diffuse the soft boundary, then snap to binary with `threshold(100)`. Every edge pixel is now either fully opaque or fully transparent before `flatten` runs — eliminating colour contamination entirely.
- **Photo background removal — pre-existing alpha not normalised**: if a candidate uploaded a PNG with a pre-existing transparency channel, `sharp().png()` preserved it and rembg received an RGBA input the model was not designed for. Fix: flatten the input to white before the PNG conversion to ensure rembg always receives a clean RGB image.
- **Photo background removal — large-image mask upscaling artefacts**: u2netp runs segmentation at 320×320 then upscales the mask to the original image size. For a 4K phone photo the upscale ratio was 12×, creating wide semi-opaque boundary fringes that retained the original (often warm/red) background colour. Fix: resize to final output dimensions (800×800 closeup / 1920px fullbody) *before* rembg so the mask upscale is at most 2.5×.

---

## [v0.5.2] - 2026-05-25

### Removed
- **`recruiter_selected` timeline step**: Removed the intermediate "Dipilih Rekruter / 採用担当者に選択済み" step from the candidate journey. The step was structurally unreliable (batch is typically already in `approved` state by the time a recruiter clicks Konfirmasi, so the event was never recorded) and added noise without actionable meaning for the candidate. Removed from: `PROCESS_STEPS` in both `CandidateTimeline` and `CandidateJourney` frontend components; `RECRUITER_EVENTS` filter in the recruiter candidate-timeline API endpoint; `recordTimelineEvent` call in `POST /batches/:batchId/select`. The `RECRUITER_SELECTED` in-app notification is retained. The `recruiter_selected` ENUM value is preserved in the DB model and migration to avoid a disruptive ALTER TABLE and to remain compatible with any existing rows.

---

## [v0.5.1] - 2026-05-25

### Fixed
- **Recruiter Konfirmasi — consistent 404 on every attempt (batch status mismatch)**: `GET /recruiter/batch` returns batches with status `approved` (so the recruiter can still view them), but `POST /batches/:batchId/select` only accepts status `active` or `selection`. Once a manager advances the batch to `approved`, every Konfirmasi click returned a 404 — a structurally guaranteed, non-retryable failure that looked like the button doing nothing. Fix: derive `canSelect = batch.status === 'active' || 'selection'` from the query response already in hand. When `!canSelect`: amber banner explains the batch is approved/closed; checkboxes are hidden (`—`); `SelectionTray` and `ConfirmDialog` are not rendered, so the state machine cannot be entered.
- **Generic error message replaced with code-specific messages**: The `onError` handler now decodes the backend error code (`NOT_FOUND` / `QUOTA_EXCEEDED` / `INVALID_CANDIDATE`) and shows a bilingual, actionable message for each case instead of a single generic retry prompt.

---

## [v0.5.0] - 2026-05-25

### Fixed
- **Recruiter Konfirmasi button unreachable (dialog overflow)**: `ConfirmDialog` had no `max-height`, so when enough candidates were in the selection list the white card grew beyond the viewport and the action buttons were pushed below the visible area — invisible and unclickable. Fix: `max-h-[90vh] flex flex-col` on the dialog card; the candidate list section is `flex-1 overflow-y-auto` (scrolls independently); header and footer are `shrink-0` so the Batal / Konfirmasi buttons are always on screen regardless of how many candidates are listed.
- **ConfirmDialog silent failure on API error**: `confirmMutation` had no `onError` handler. When the backend rejected the request (network error, quota exceeded, etc.) the dialog stayed open with no feedback and the button appeared frozen. Fix: added `onError` with an inline bilingual error message and cleared the error on success or cancel.
- **Recurring invisible/missing-button bug class (Tailwind palette gaps)**: `tailwind.config.js` only defined `navy-50/100/500/700/900` and `gold-400/500`. The codebase uses `navy-200/300/400/600/800` (42+ navy-300 usages alone) and `gold-50/200/600/700` across many components. Tailwind silently drops undefined classes, causing transparent backgrounds and invisible text — the same root cause as the v0.3.0 "navy-800 invisible button" incident. Fix: complete both scales (`navy-200` through `navy-800`, `gold-50/200/600/700`) so any future component can use any shade without triggering this bug.

---

## [v0.4.9] - 2026-05-25

### Fixed
- **Completeness stuck at 92% for candidates without body check**: `calcLegacy` was checking `heightCm` and `weightKg` (admin-verified fields set only during body check, never fillable by candidates) instead of `selfReportedHeight` / `selfReportedWeight` (the candidate-visible input fields). Candidates who had not had a body check were permanently blocked from reaching 100% and the Submit button never appeared. Fix aligns `calcLegacy` with the existing `calcCV` fallback pattern (`selfReportedHeight ?? heightCm`).
- **Manager approval errors invisible**: `approveOneMutation` and `approveAllMutation` in the manager batch-detail page had no `onError` handlers. When the backend returned an error the mutation failed silently — no query invalidation, no feedback to the manager. Fix adds `onError` handlers and a dismissable red error banner above the approval action row.

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
