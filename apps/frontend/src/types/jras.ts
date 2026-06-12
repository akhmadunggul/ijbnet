import type {
  JrasDimensionKey,
  JrasInstrumentType,
  JrasInstrumentStatus,
  JrasItemType,
  JrasItemOption,
  JrasItemScoring,
  JrasReviewerType,
  JrasReviewVerdict,
  JrasReviewQuota,
} from '@ijbnet/shared';

export interface JrasInstrumentSummary {
  id: string;
  dimensionKey: JrasDimensionKey;
  type: JrasInstrumentType;
  version: number;
  status: JrasInstrumentStatus;
  titleId: string;
  titleJa: string;
  descriptionId: string | null;
  descriptionJa: string | null;
  sentToReviewAt: string | null;
  activatedAt: string | null;
  itemCount: number;
  // reviewer queue
  alreadyReviewed?: boolean;
  // superadmin list
  approveCount?: number;
  changesCount?: number;
  createdAt: string;
}

export interface JrasItemData {
  id: string;
  instrumentId: string;
  orderNo: number;
  type: JrasItemType;
  promptId: string;
  promptJa: string;
  optionsJson: JrasItemOption[];
  scoringJson: JrasItemScoring;
  criticalFlag: boolean;
  sensitive: boolean;
}

export interface JrasReviewItemNote {
  itemId: string;
  verdict: 'ok' | 'needs_change';
  comment?: string;
}

export interface JrasReviewData {
  id: string;
  instrumentId: string;
  instrumentVersion: number;
  reviewerUserId: string;
  verdict: JrasReviewVerdict;
  note: string | null;
  itemNotesJson: JrasReviewItemNote[] | null;
  submittedAt: string;
  reviewerType?: JrasReviewerType | null;
  reviewer?: { id: string; name: string | null; email: string } | null;
  instrument?: Pick<JrasInstrumentSummary, 'id' | 'titleId' | 'titleJa' | 'dimensionKey' | 'type' | 'status' | 'version'>;
}

export interface JrasInstrumentDetail extends Omit<JrasInstrumentSummary, 'itemCount'> {
  items: JrasItemData[];
  myReview?: JrasReviewData | null;
  reviews?: JrasReviewData[];
  approval?: {
    quota: JrasReviewQuota;
    approvals: Record<JrasReviewerType, number>;
    quotaMet: boolean;
  };
}

export interface JrasConfigData {
  lpkIds: string[];
  weights: Record<JrasDimensionKey, number>;
  reviewQuota: JrasReviewQuota;
  thresholds: { ready: number; risk: number };
}

export interface JrasCommitteeMemberData {
  id: string;
  userId: string;
  active: boolean;
  user?: { id: string; name: string | null; email: string; role: string };
}

export interface JrasRiskRuleData {
  id: string;
  ruleKey: string;
  severity: 'yellow' | 'red';
  configJson: Record<string, unknown>;
  enabled: boolean;
  descriptionId: string | null;
  descriptionJa: string | null;
}

export interface JrasReviewerData {
  id: string;
  userId: string;
  reviewerType: JrasReviewerType;
  active: boolean;
  user?: { id: string; name: string | null; email: string; isActive: boolean };
}
