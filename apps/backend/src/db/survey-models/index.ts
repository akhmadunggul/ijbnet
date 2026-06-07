import { surveySequelize } from '../survey-connection';
import { Survey, initSurvey } from '../models/Survey';
import { SurveyQuestion, initSurveyQuestion } from '../models/SurveyQuestion';
import { SurveyResponse, initSurveyResponse } from '../models/SurveyResponse';
import { SurveyAnswer, initSurveyAnswer } from '../models/SurveyAnswer';

initSurvey(surveySequelize);
initSurveyQuestion(surveySequelize);
initSurveyResponse(surveySequelize);
initSurveyAnswer(surveySequelize);

// Associations on the survey connection
Survey.hasMany(SurveyQuestion, { foreignKey: 'surveyId', as: 'questions', onDelete: 'CASCADE' });
SurveyQuestion.belongsTo(Survey, { foreignKey: 'surveyId', as: 'survey' });

Survey.hasMany(SurveyResponse, { foreignKey: 'surveyId', as: 'responses', onDelete: 'CASCADE' });
SurveyResponse.belongsTo(Survey, { foreignKey: 'surveyId', as: 'survey' });

SurveyResponse.hasMany(SurveyAnswer, { foreignKey: 'responseId', as: 'answers', onDelete: 'CASCADE' });
SurveyAnswer.belongsTo(SurveyResponse, { foreignKey: 'responseId', as: 'response' });

SurveyAnswer.belongsTo(SurveyQuestion, { foreignKey: 'questionId', as: 'question' });

export { Survey, SurveyQuestion, SurveyResponse, SurveyAnswer };
