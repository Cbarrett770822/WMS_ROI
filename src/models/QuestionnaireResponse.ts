import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for question responses
interface IQuestionResponse {
  questionId: string;
  value: string | number | boolean | string[];
  notes?: string;
}

// Interface for subsection responses
interface ISubsectionResponse {
  subsectionId: string;
  questions: IQuestionResponse[];
  completedAt?: Date;
}

// Interface for section responses
interface ISectionResponse {
  sectionId: string;
  subsections: ISubsectionResponse[];
  completedAt?: Date;
}

// Main questionnaire response interface
export interface IQuestionnaireResponse extends Document {
  assessment: mongoose.Types.ObjectId;
  questionnaire: mongoose.Types.ObjectId;
  respondent: mongoose.Types.ObjectId;
  status: 'in_progress' | 'completed';
  sections: ISectionResponse[];
  startedAt: Date;
  completedAt?: Date;
  lastSavedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionResponseSchema = new Schema(
  {
    questionId: {
      type: String,
      required: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    notes: String,
  },
  { _id: false }
);

const SubsectionResponseSchema = new Schema(
  {
    subsectionId: {
      type: String,
      required: true,
    },
    questions: [QuestionResponseSchema],
    completedAt: Date,
  },
  { _id: false }
);

const SectionResponseSchema = new Schema(
  {
    sectionId: {
      type: String,
      required: true,
    },
    subsections: [SubsectionResponseSchema],
    completedAt: Date,
  },
  { _id: false }
);

const QuestionnaireResponseSchema: Schema = new Schema(
  {
    assessment: {
      type: Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
    },
    questionnaire: {
      type: Schema.Types.ObjectId,
      ref: 'Questionnaire',
      required: true,
    },
    respondent: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
    },
    sections: [SectionResponseSchema],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    lastSavedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
QuestionnaireResponseSchema.index({ assessment: 1 });
QuestionnaireResponseSchema.index({ questionnaire: 1 });
QuestionnaireResponseSchema.index({ respondent: 1 });
QuestionnaireResponseSchema.index({ status: 1 });

// Delete the model if it exists to prevent OverwriteModelError
const QuestionnaireResponse: Model<IQuestionnaireResponse> = mongoose.models.QuestionnaireResponse || mongoose.model<IQuestionnaireResponse>('QuestionnaireResponse', QuestionnaireResponseSchema);

export default QuestionnaireResponse;
