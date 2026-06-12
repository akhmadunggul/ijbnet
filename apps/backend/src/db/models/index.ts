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
import { CandidateCertification, initCandidateCertification } from './CandidateCertification';
import { CandidateEducationHistory, initCandidateEducationHistory } from './CandidateEducationHistory';
import { SswSectorField, initSswSectorField } from './SswSectorField';
import { CandidateTimeline, initCandidateTimeline } from './CandidateTimeline';
import { RecruitmentRequest, initRecruitmentRequest } from './RecruitmentRequest';
import { GlobalSettings, initGlobalSettings } from './GlobalSettings';
import { CandidateGakkenResume, initCandidateGakkenResume } from './CandidateGakkenResume';
import { CandidateGakkenCompany, initCandidateGakkenCompany } from './CandidateGakkenCompany';
import { JpTopic, initJpTopic } from './JpTopic';
import { JpLesson, initJpLesson } from './JpLesson';
import { JpExercise, initJpExercise } from './JpExercise';
import { JpCandidateProgress, initJpCandidateProgress } from './JpCandidateProgress';
import { JrasInstrument, initJrasInstrument } from './JrasInstrument';
import { JrasItem, initJrasItem } from './JrasItem';
import { JrasReviewer, initJrasReviewer } from './JrasReviewer';
import { JrasReview, initJrasReview } from './JrasReview';
import { JrasCommitteeMember, initJrasCommitteeMember } from './JrasCommitteeMember';
import { JrasAttempt, initJrasAttempt } from './JrasAttempt';
import { JrasAnswer, initJrasAnswer } from './JrasAnswer';
import { JrasAppeal, initJrasAppeal } from './JrasAppeal';
import { JrasDimensionScore, initJrasDimensionScore } from './JrasDimensionScore';
import { JrasRiskRule, initJrasRiskRule } from './JrasRiskRule';
import { JrasRiskFlag, initJrasRiskFlag } from './JrasRiskFlag';
import { JrasIntervention, initJrasIntervention } from './JrasIntervention';
import { JrasLearningPath, initJrasLearningPath } from './JrasLearningPath';
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
initCandidateCertification(sequelize);
initCandidateEducationHistory(sequelize);
initSswSectorField(sequelize);
initCandidateTimeline(sequelize);
initRecruitmentRequest(sequelize);
initGlobalSettings(sequelize);
initCandidateGakkenResume(sequelize);
initCandidateGakkenCompany(sequelize);
initJpTopic(sequelize);
initJpLesson(sequelize);
initJpExercise(sequelize);
initJpCandidateProgress(sequelize);
initJrasInstrument(sequelize);
initJrasItem(sequelize);
initJrasReviewer(sequelize);
initJrasReview(sequelize);
initJrasCommitteeMember(sequelize);
initJrasAttempt(sequelize);
initJrasAnswer(sequelize);
initJrasAppeal(sequelize);
initJrasDimensionScore(sequelize);
initJrasRiskRule(sequelize);
initJrasRiskFlag(sequelize);
initJrasIntervention(sequelize);
initJrasLearningPath(sequelize);
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

// Candidate timeline
Candidate.hasMany(CandidateTimeline, {
  foreignKey: 'candidateId',
  as: 'timeline',
  onDelete: 'CASCADE',
});
CandidateTimeline.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });
CandidateTimeline.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

// RecruitmentRequest
Company.hasMany(RecruitmentRequest, { foreignKey: 'companyId', as: 'recruitmentRequests' });
RecruitmentRequest.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
RecruitmentRequest.belongsTo(User, { foreignKey: 'requestedBy', as: 'requester' });
RecruitmentRequest.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

// Candidate Gakken Resume / Companies
Candidate.hasOne(CandidateGakkenResume, {
  foreignKey: 'candidateId',
  as: 'gakkenResume',
  onDelete: 'CASCADE',
});
CandidateGakkenResume.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

Candidate.hasMany(CandidateGakkenCompany, {
  foreignKey: 'candidateId',
  as: 'gakkenCompanies',
  onDelete: 'CASCADE',
});
CandidateGakkenCompany.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

// JP Learning
JpTopic.hasMany(JpLesson, { foreignKey: 'topicId', as: 'lessons', onDelete: 'CASCADE' });
JpLesson.belongsTo(JpTopic, { foreignKey: 'topicId', as: 'topic' });
JpLesson.hasMany(JpExercise, { foreignKey: 'lessonId', as: 'exercises', onDelete: 'CASCADE' });
JpExercise.belongsTo(JpLesson, { foreignKey: 'lessonId', as: 'lesson' });
Candidate.hasMany(JpCandidateProgress, { foreignKey: 'candidateId', as: 'jpProgress', onDelete: 'CASCADE' });
JpCandidateProgress.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });
JpCandidateProgress.belongsTo(JpLesson, { foreignKey: 'lessonId', as: 'lesson' });

// JRAS
JrasInstrument.hasMany(JrasItem, { foreignKey: 'instrumentId', as: 'items', onDelete: 'CASCADE' });
JrasItem.belongsTo(JrasInstrument, { foreignKey: 'instrumentId', as: 'instrument' });

JrasInstrument.hasMany(JrasReview, { foreignKey: 'instrumentId', as: 'reviews', onDelete: 'CASCADE' });
JrasReview.belongsTo(JrasInstrument, { foreignKey: 'instrumentId', as: 'instrument' });
JrasReview.belongsTo(User, { foreignKey: 'reviewerUserId', as: 'reviewer' });

User.hasOne(JrasReviewer, { foreignKey: 'userId', as: 'jrasReviewer', onDelete: 'CASCADE' });
JrasReviewer.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(JrasCommitteeMember, { foreignKey: 'userId', as: 'jrasCommitteeMember', onDelete: 'CASCADE' });
JrasCommitteeMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Candidate.hasMany(JrasAttempt, { foreignKey: 'candidateId', as: 'jrasAttempts', onDelete: 'CASCADE' });
JrasAttempt.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });
JrasAttempt.belongsTo(JrasInstrument, { foreignKey: 'instrumentId', as: 'instrument' });
JrasAttempt.belongsTo(User, { foreignKey: 'observerUserId', as: 'observer' });

JrasAttempt.hasMany(JrasAnswer, { foreignKey: 'attemptId', as: 'answers', onDelete: 'CASCADE' });
JrasAnswer.belongsTo(JrasAttempt, { foreignKey: 'attemptId', as: 'attempt' });
JrasAnswer.belongsTo(JrasItem, { foreignKey: 'itemId', as: 'item' });

Candidate.hasMany(JrasAppeal, { foreignKey: 'candidateId', as: 'jrasAppeals', onDelete: 'CASCADE' });
JrasAppeal.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });
JrasAppeal.belongsTo(JrasInstrument, { foreignKey: 'instrumentId', as: 'instrument' });
JrasAppeal.belongsTo(JrasAttempt, { foreignKey: 'attemptId', as: 'attempt' });

Candidate.hasMany(JrasDimensionScore, { foreignKey: 'candidateId', as: 'jrasScores', onDelete: 'CASCADE' });
JrasDimensionScore.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

Candidate.hasMany(JrasRiskFlag, { foreignKey: 'candidateId', as: 'jrasFlags', onDelete: 'CASCADE' });
JrasRiskFlag.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

JrasRiskFlag.hasMany(JrasIntervention, { foreignKey: 'flagId', as: 'interventions', onDelete: 'CASCADE' });
JrasIntervention.belongsTo(JrasRiskFlag, { foreignKey: 'flagId', as: 'flag' });
JrasIntervention.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });
JrasIntervention.belongsTo(User, { foreignKey: 'assignedToUserId', as: 'assignedTo' });

Candidate.hasMany(JrasLearningPath, { foreignKey: 'candidateId', as: 'jrasLearningPaths', onDelete: 'CASCADE' });
JrasLearningPath.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });
JrasLearningPath.belongsTo(JpLesson, { foreignKey: 'lessonId', as: 'lesson' });

// Candidate certifications & education history
Candidate.hasMany(CandidateCertification, {
  foreignKey: 'candidateId',
  as: 'certifications',
  onDelete: 'CASCADE',
});
CandidateCertification.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

Candidate.hasMany(CandidateEducationHistory, {
  foreignKey: 'candidateId',
  as: 'educationHistory',
  onDelete: 'CASCADE',
});
CandidateEducationHistory.belongsTo(Candidate, { foreignKey: 'candidateId', as: 'candidate' });

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
  CandidateCertification,
  CandidateEducationHistory,
  SswSectorField,
  CandidateTimeline,
  RecruitmentRequest,
  GlobalSettings,
  CandidateGakkenResume,
  CandidateGakkenCompany,
  JpTopic,
  JpLesson,
  JpExercise,
  JpCandidateProgress,
  JrasInstrument,
  JrasItem,
  JrasReviewer,
  JrasReview,
  JrasCommitteeMember,
  JrasAttempt,
  JrasAnswer,
  JrasAppeal,
  JrasDimensionScore,
  JrasRiskRule,
  JrasRiskFlag,
  JrasIntervention,
  JrasLearningPath,
};
