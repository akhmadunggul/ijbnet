import { buildCandidateCvHtmlV1 } from './candidateCvHtmlV1';
import { buildCandidateCvHtmlV2 } from './candidateCvHtmlV2';
import { buildCandidateCvHtmlV3 } from './candidateCvHtmlV3';

export type CvHtmlSettings = {
  font: string;
  layout: string;
  photoBase64?: string | null;
  variant?: string;
};

export function buildCandidateCvHtml(
  cj: Record<string, unknown>,
  settings: CvHtmlSettings,
): string {
  if (settings.variant === 'v3') return buildCandidateCvHtmlV3(cj, settings);
  if (settings.variant === 'v2') return buildCandidateCvHtmlV2(cj, settings);
  return buildCandidateCvHtmlV1(cj, settings);
}
