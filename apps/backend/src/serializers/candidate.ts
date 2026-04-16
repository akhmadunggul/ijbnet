import type { UserRole } from '@ijbnet/shared';
import { decryptNullable } from '../utils/crypto';

const MASKED_FIELD = { masked: true, label: { id: '🔒 Dilindungi', ja: '🔒 保護中' } };

/**
 * Strip sensitive/internal fields before sending candidate data to clients.
 * MANDATORY for all outbound candidate data per CLAUDE.md.
 */
export function serializeCandidate(
  candidate: Record<string, unknown>,
  requestingRole?: UserRole,
): Record<string, unknown> {
  const {
    // Always strip raw encrypted fields from candidate
    nikEncrypted: _nik,
    visionEncrypted: _vision,    // kept for safety even if not on Candidate directly
    tattooEncrypted: _tattoo,    // same
    bankAccountEncrypted: _bank,
    // Conditionally included fields
    internalNotes,
    bankName,
    // Fields that require masking for recruiter
    email,
    phone,
    address,
    // Nested bodyCheck needs its own encrypted-field stripping
    bodyCheck,
    ...rest
  } = candidate as {
    nikEncrypted?: unknown;
    visionEncrypted?: unknown;
    tattooEncrypted?: unknown;
    bankAccountEncrypted?: unknown;
    internalNotes?: unknown;
    bankName?: unknown;
    email?: unknown;
    phone?: unknown;
    address?: unknown;
    bodyCheck?: unknown;
  } & Record<string, unknown>;

  const base: Record<string, unknown> = { ...rest };

  // ── email / phone / address ──────────────────────────────────────────────
  // Recruiter sees masked placeholders; all other roles see plaintext.
  if (requestingRole === 'recruiter') {
    base['email'] = MASKED_FIELD;
    base['phone'] = MASKED_FIELD;
    base['address'] = MASKED_FIELD;
  } else {
    base['email'] = email ?? null;
    base['phone'] = phone ?? null;
    base['address'] = address ?? null;
  }

  // ── bodyCheck — strip visionEncrypted + tattooEncrypted for all roles ────
  if (bodyCheck != null && typeof bodyCheck === 'object') {
    const { visionEncrypted: _bv, tattooEncrypted: _bt, ...bcRest } = bodyCheck as Record<string, unknown>;
    base['bodyCheck'] = bcRest;
  } else {
    base['bodyCheck'] = bodyCheck ?? null;
  }

  // ── super_admin: bank name ────────────────────────────────────────────────
  if (requestingRole === 'super_admin') {
    base['bankName'] = bankName ?? null;
  }

  // ── admin/manager/super_admin: internal notes ─────────────────────────────
  if (
    requestingRole === 'admin' ||
    requestingRole === 'manager' ||
    requestingRole === 'super_admin'
  ) {
    base['internalNotes'] = internalNotes ?? null;
  }

  // ── candidate/super_admin: decrypted NIK ──────────────────────────────────
  if (requestingRole === 'candidate' || requestingRole === 'super_admin') {
    base['nik'] = decryptNullable((candidate as Record<string, unknown>)['nikEncrypted'] as string | null);
  }

  return base;
}

export function serializeUser(user: Record<string, unknown>): Record<string, unknown> {
  const { passwordHash: _ph, mfaSecret: _mfa, googleId: _gid, ...safe } = user as {
    passwordHash?: unknown;
    mfaSecret?: unknown;
    googleId?: unknown;
  } & Record<string, unknown>;
  return safe;
}
