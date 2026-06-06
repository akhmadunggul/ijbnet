import type { AbVariant, AbTargeting } from '../db/models/AbExperiment';

// FNV-1a 32-bit — fast, deterministic, no external deps
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

// Returns a stable bucket 0–99 for a given user+experiment pair
export function deterministicBucket(userId: string, experimentId: string): number {
  return fnv1a(`${userId}:${experimentId}`) % 100;
}

// Returns the variant key the user is assigned to
export function pickVariant(userId: string, experimentId: string, variants: AbVariant[]): string {
  const bucket = deterministicBucket(userId, experimentId);
  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.weight;
    if (bucket < cumulative) return v.key;
  }
  return variants[variants.length - 1].key;
}

// Checks whether a user qualifies for this experiment based on targeting rules
export function isEligible(
  user: { id: string; role: string; lpkId?: string | null },
  targeting: AbTargeting,
): boolean {
  switch (targeting.scope) {
    case 'all':        return true;
    case 'role':       return !!(targeting.roles?.includes(user.role));
    case 'lpk':        return !!(user.lpkId && targeting.lpkIds?.includes(user.lpkId));
    case 'percentage': return (fnv1a(`${user.id}:eligibility`) % 100) < (targeting.percentage ?? 100);
    default:           return false;
  }
}
