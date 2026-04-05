import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CandidateIntroVideoAttributes {
  id: string;
  candidateId: string;
  label: string | null;
  youtubeUrl: string | null;
  youtubeId: string | null;
  videoDate: string | null;
  uploadedBy: string | null;
  sortOrder: number;
  createdAt?: Date;
}

export interface CandidateIntroVideoCreationAttributes
  extends Optional<
    CandidateIntroVideoAttributes,
    'id' | 'label' | 'youtubeUrl' | 'youtubeId' | 'videoDate' | 'uploadedBy' | 'sortOrder'
  > {}

export class CandidateIntroVideo
  extends Model<CandidateIntroVideoAttributes, CandidateIntroVideoCreationAttributes>
  implements CandidateIntroVideoAttributes {
  declare id: string;
  declare candidateId: string;
  declare label: string | null;
  declare youtubeUrl: string | null;
  declare youtubeId: string | null;
  declare videoDate: string | null;
  declare uploadedBy: string | null;
  declare sortOrder: number;
  declare readonly createdAt: Date;
}

export function initCandidateIntroVideo(sequelize: Sequelize): void {
  CandidateIntroVideo.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      label: { type: DataTypes.STRING(100), allowNull: true },
      youtubeUrl: { type: DataTypes.TEXT, allowNull: true },
      youtubeId: { type: DataTypes.STRING(50), allowNull: true },
      videoDate: { type: DataTypes.STRING(50), allowNull: true },
      uploadedBy: { type: DataTypes.UUID, allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
    },
    { sequelize, tableName: 'candidate_intro_videos', timestamps: true, updatedAt: false },
  );
}
