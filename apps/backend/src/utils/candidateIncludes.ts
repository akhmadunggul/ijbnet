import {
  CandidateJapaneseTest,
  CandidateCareer,
  CandidateBodyCheck,
  CandidateWeeklyTest,
  CandidateIntroVideo,
  ToolsDictionary,
  CandidateCertification,
  CandidateEducationHistory,
} from '../db/models/index';

/**
 * Returns the full set of candidate associations needed for completeness
 * calculation and display. Called fresh each time to avoid Sequelize
 * circular-reference issues with cached model instances.
 *
 * Every route that calls calcCompleteness() MUST use this (or a superset).
 * Omitting an association here silently produces wrong completeness scores.
 */
export function candidateIncludes() {
  return [
    { model: CandidateJapaneseTest,     as: 'tests',            required: false },
    { model: CandidateCareer,           as: 'career',           required: false, separate: true, order: [['startDate', 'ASC'] as [string, string]] },
    { model: CandidateBodyCheck,        as: 'bodyCheck',        required: false },
    { model: CandidateWeeklyTest,       as: 'weeklyTests',      required: false },
    { model: CandidateIntroVideo,       as: 'videos',           required: false },
    { model: ToolsDictionary,           as: 'tools',            required: false },
    { model: CandidateCertification,    as: 'certifications',   required: false },
    { model: CandidateEducationHistory, as: 'educationHistory', required: false, separate: true, order: [['startDate', 'ASC'] as [string, string]] },
  ];
}
