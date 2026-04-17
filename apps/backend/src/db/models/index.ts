import { sequelize } from '../connection';

import { Company, initCompany } from './Company';
import { Lpk, initLpk } from './Lpk';
import { User, initUser } from './User';
import { Candidate, initCandidate } from './Candidate';
import { CandidateJapaneseTest, initCandidateJapaneseTest } from './CandidateJapaneseTest';
import { CandidateIntroVideo, initCandidateIntroVideo } from './CandidateIntroVideo';
import { CandidateCareer, initCandidateCareer } from './CandidateCareer';
import { ToolsDictionary, initToolsDictionary } from './ToolsDictionary';
import { CandidateTool, initCandidateTool } from './CandidateTool';
import { CandidateBodyCheck, initCandidateBodyCheck } from './CandidateBodyCheck';
import { CandidateWeeklyTest, initCandidateWeeklyTest } from './CandidateWeeklyTest';
import { Batch, initBatch } from './Batch';
import { BatchCandidate, initBatchCandidate } from './BatchCandidate';
import { InterviewProposal, initInterviewProposal } from './InterviewProposal';
import { Notification, initNotification } from './Notification';
import { AuditLog, initAuditLog } from './AuditLog';
import { UserMfaBackupCode, initUserMfaBackupCode } from './UserMfaBackupCode';
import { ConsentClause, initConsentClause } from './ConsentClause';

// Initialize all models
initCompany(sequelize);
initLpk(sequelize);
initUser(sequelize);
initCandidate(sequelize);
initCandidateJapaneseTest(sequelize);
initCandidateIntroVideo(sequelize);
initCandidateCareer(sequelize);
initToolsDictionary(sequelize);
initCandidateTool(sequelize);
initCandidateBodyCheck(sequelize);
initCandidateWeeklyTest(sequelize);
initBatch(sequelize);
initBatchCandidate(sequelize);
initInterviewProposal(sequelize);
initNotification(sequelize);
initAuditLog(sequelize);
initUserMfaBackupCode(sequelize);
initConsentClause(sequelize);

// ── Associations ─────────────────────────────────────────────────────────────

// User ↔ Company / Lpk
Company.hasMany(User, { foreignKey: 'companyId', as: 'users' });
User.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Lpk.hasMany(User, { foreignKey: 'lpkId', as: 'users' });
User.belongsTo(Lpk, { foreignKey: 'lpkId', as: 'lpk' });

// Lpk ↔ Lpk (assignedAdmin → User) — plain FK, no Sequelize association needed for simple FK
Lpk.belongsTo(User, { foreignKey: 'assignedAdmin', as: 'adminUser' });

// User ↔ Candidate
User.hasOne(Candidate, { foreignKey: 'userId', as: 'candidate' });
Candidate.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Lpk ↔ Candidate
Lpk.hasMany(Candidate, { foreignKey: 'lpkId', as: 'candidates' });
Candidate.belongsTo(Lpk, { foreignKey: 'lpkId', as: 'lpk' });

// Candidate sub-resources
Candidate.hasMany(CandidateJapaneseTest, {
  foreignKey: 'candidateId',
  as: 'tests',
  onDelete: 'CASCADE',
});
CandidateJapaneseTest.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

Candidate.hasMany(CandidateIntroVideo, {
  foreignKey: 'candidateId',
  as: 'videos',
  onDelete: 'CASCADE',
});
CandidateIntroVideo.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

Candidate.hasMany(CandidateCareer, {
  foreignKey: 'candidateId',
  as: 'career',
  onDelete: 'CASCADE',
});
CandidateCareer.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

Candidate.hasOne(CandidateBodyCheck, {
  foreignKey: 'candidateId',
  as: 'bodyCheck',
  onDelete: 'CASCADE',
});
CandidateBodyCheck.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

Candidate.hasMany(CandidateWeeklyTest, {
  foreignKey: 'candidateId',
  as: 'weeklyTests',
  onDelete: 'CASCADE',
});
CandidateWeeklyTest.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

Candidate.belongsToMany(ToolsDictionary, {
  through: CandidateTool,
  foreignKey: 'candidateId',
  as: 'tools',
});
ToolsDictionary.belongsToMany(Candidate, {
  through: CandidateTool,
  foreignKey: 'toolId',
  as: 'candidates',
});

// Batch
Company.hasMany(Batch, { foreignKey: 'companyId', as: 'batches' });
Batch.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Batch.hasMany(BatchCandidate, {
  foreignKey: 'batchId',
  as: 'allocations',
  onDelete: 'CASCADE',
});
BatchCandidate.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });
BatchCandidate.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });
Candidate.hasMany(BatchCandidate, { foreignKey: 'candidateId', as: 'batchAllocations' });

BatchCandidate.hasOne(InterviewProposal, {
  foreignKey: 'batchCandidateId',
  as: 'proposal',
  onDelete: 'CASCADE',
});
InterviewProposal.belongsTo(BatchCandidate, {
  foreignKey: 'batchCandidateId',
  as: 'batchCandidate',
});

// Notifications / Audit
User.hasMany(Notification, {
  foreignKey: 'userId',
  as: 'notifications',
  onDelete: 'CASCADE',
});
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(UserMfaBackupCode, { foreignKey: 'userId', as: 'mfaBackupCodes', onDelete: 'CASCADE' });
UserMfaBackupCode.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ConsentClause associations
ConsentClause.belongsTo(User, { as: 'publisher', foreignKey: 'publishedBy' });
ConsentClause.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
ConsentClause.belongsTo(ConsentClause, { as: 'superseder', foreignKey: 'supersededBy' });
Candidate.belongsTo(ConsentClause, { as: 'consentClause', foreignKey: 'consentClauseId' });

export {
  sequelize,
  Company,
  Lpk,
  User,
  Candidate,
  CandidateJapaneseTest,
  CandidateIntroVideo,
  CandidateCareer,
  ToolsDictionary,
  CandidateTool,
  CandidateBodyCheck,
  CandidateWeeklyTest,
  Batch,
  BatchCandidate,
  InterviewProposal,
  Notification,
  AuditLog,
  UserMfaBackupCode,
  ConsentClause,
};
