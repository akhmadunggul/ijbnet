import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { ProfileStatus } from '@ijbnet/shared';

export interface CandidateAttributes {
  id: string;
  candidateCode: string;
  userId: string | null;
  lpkId: string | null;
  profileStatus: ProfileStatus;
  isLocked: boolean;
  consentGiven: boolean;
  consentGivenAt: Date | null;
  fullName: string;
  gender: 'M' | 'F' | null;
  dateOfBirth: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  nikEncrypted: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  eduLevel: string | null;
  eduLabel: string | null;
  eduMajor: string | null;
  jobCategory: string | null;
  sswKubun: 'SSW1' | 'SSW2' | null;
  sswSectorJa: string | null;
  sswFieldJa: string | null;
  sswSectorId: string | null;
  sswFieldId: string | null;
  jpStudyDuration: string | null;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | null;
  spouseInfo: string | null;
  childrenCount: number;
  accompany: 'none' | 'yes';
  workplanDuration: string | null;
  workplanGoal: string | null;
  workplanAfter: string | null;
  workplanExpectation: string | null;
  workplanUpdated: Date | null;
  closeupUrl: string | null;
  fullbodyUrl: string | null;
  interviewStatus: 'scheduled' | 'pass' | 'fail' | 'on_hold' | 'cancelled' | null;
  bankName: string | null;
  bankAccountEncrypted: string | null;
  internalNotes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CandidateCreationAttributes
  extends Optional<
    CandidateAttributes,
    | 'id'
    | 'userId'
    | 'lpkId'
    | 'profileStatus'
    | 'isLocked'
    | 'consentGiven'
    | 'consentGivenAt'
    | 'gender'
    | 'dateOfBirth'
    | 'heightCm'
    | 'weightKg'
    | 'nikEncrypted'
    | 'email'
    | 'phone'
    | 'address'
    | 'eduLevel'
    | 'eduLabel'
    | 'eduMajor'
    | 'jobCategory'
    | 'sswKubun'
    | 'sswSectorJa'
    | 'sswFieldJa'
    | 'sswSectorId'
    | 'sswFieldId'
    | 'jpStudyDuration'
    | 'maritalStatus'
    | 'spouseInfo'
    | 'childrenCount'
    | 'accompany'
    | 'workplanDuration'
    | 'workplanGoal'
    | 'workplanAfter'
    | 'workplanExpectation'
    | 'workplanUpdated'
    | 'closeupUrl'
    | 'fullbodyUrl'
    | 'interviewStatus'
    | 'bankName'
    | 'bankAccountEncrypted'
    | 'internalNotes'
  > {}

export class Candidate
  extends Model<CandidateAttributes, CandidateCreationAttributes>
  implements CandidateAttributes {
  declare id: string;
  declare candidateCode: string;
  declare userId: string | null;
  declare lpkId: string | null;
  declare profileStatus: ProfileStatus;
  declare isLocked: boolean;
  declare consentGiven: boolean;
  declare consentGivenAt: Date | null;
  declare fullName: string;
  declare gender: 'M' | 'F' | null;
  declare dateOfBirth: Date | null;
  declare heightCm: number | null;
  declare weightKg: number | null;
  declare nikEncrypted: string | null;
  declare email: string | null;
  declare phone: string | null;
  declare address: string | null;
  declare eduLevel: string | null;
  declare eduLabel: string | null;
  declare eduMajor: string | null;
  declare jobCategory: string | null;
  declare sswKubun: 'SSW1' | 'SSW2' | null;
  declare sswSectorJa: string | null;
  declare sswFieldJa: string | null;
  declare sswSectorId: string | null;
  declare sswFieldId: string | null;
  declare jpStudyDuration: string | null;
  declare maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | null;
  declare spouseInfo: string | null;
  declare childrenCount: number;
  declare accompany: 'none' | 'yes';
  declare workplanDuration: string | null;
  declare workplanGoal: string | null;
  declare workplanAfter: string | null;
  declare workplanExpectation: string | null;
  declare workplanUpdated: Date | null;
  declare closeupUrl: string | null;
  declare fullbodyUrl: string | null;
  declare interviewStatus: 'scheduled' | 'pass' | 'fail' | 'on_hold' | 'cancelled' | null;
  declare bankName: string | null;
  declare bankAccountEncrypted: string | null;
  declare internalNotes: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initCandidate(sequelize: Sequelize): void {
  Candidate.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateCode: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      lpkId: { type: DataTypes.UUID, allowNull: true },
      profileStatus: {
        type: DataTypes.ENUM('incomplete', 'submitted', 'under_review', 'approved', 'confirmed', 'rejected'),
        defaultValue: 'incomplete',
        allowNull: false,
      },
      isLocked: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      consentGiven: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      consentGivenAt: { type: DataTypes.DATE, allowNull: true },
      fullName: { type: DataTypes.STRING(255), allowNull: false },
      gender: { type: DataTypes.ENUM('M', 'F'), allowNull: true },
      dateOfBirth: { type: DataTypes.DATEONLY, allowNull: true },
      heightCm: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      weightKg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      nikEncrypted: { type: DataTypes.TEXT, allowNull: true },
      email: { type: DataTypes.STRING(255), allowNull: true },
      phone: { type: DataTypes.STRING(30), allowNull: true },
      address: { type: DataTypes.TEXT, allowNull: true },
      eduLevel: {
        type: DataTypes.ENUM('SD', 'SMP', 'SMA', 'SMK', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3'),
        allowNull: true,
      },
      eduLabel: { type: DataTypes.STRING(100), allowNull: true },
      eduMajor: { type: DataTypes.STRING(100), allowNull: true },
      jobCategory: { type: DataTypes.STRING(50), allowNull: true },
      sswKubun: { type: DataTypes.ENUM('SSW1', 'SSW2'), allowNull: true },
      sswSectorJa: { type: DataTypes.STRING(100), allowNull: true },
      sswFieldJa: { type: DataTypes.STRING(100), allowNull: true },
      sswSectorId: { type: DataTypes.STRING(100), allowNull: true },
      sswFieldId: { type: DataTypes.STRING(100), allowNull: true },
      jpStudyDuration: { type: DataTypes.STRING(50), allowNull: true },
      maritalStatus: {
        type: DataTypes.ENUM('single', 'married', 'divorced', 'widowed'),
        allowNull: true,
      },
      spouseInfo: { type: DataTypes.STRING(100), allowNull: true },
      childrenCount: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
      accompany: { type: DataTypes.ENUM('none', 'yes'), defaultValue: 'none', allowNull: false },
      workplanDuration: { type: DataTypes.STRING(50), allowNull: true },
      workplanGoal: { type: DataTypes.TEXT, allowNull: true },
      workplanAfter: { type: DataTypes.TEXT, allowNull: true },
      workplanExpectation: { type: DataTypes.TEXT, allowNull: true },
      workplanUpdated: { type: DataTypes.DATEONLY, allowNull: true },
      closeupUrl: { type: DataTypes.TEXT, allowNull: true },
      fullbodyUrl: { type: DataTypes.TEXT, allowNull: true },
      interviewStatus: {
        type: DataTypes.ENUM('scheduled', 'pass', 'fail', 'on_hold', 'cancelled'),
        allowNull: true,
      },
      bankName: { type: DataTypes.STRING(100), allowNull: true },
      bankAccountEncrypted: { type: DataTypes.TEXT, allowNull: true },
      internalNotes: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: 'candidates', timestamps: true },
  );
}
