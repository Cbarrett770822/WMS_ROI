import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for question options
interface IQuestionOption {
  value: string;
  label: string;
  score?: number;
}

// Interface for questions
interface IQuestion {
  id: string;
  text: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'scale';
  required: boolean;
  options?: IQuestionOption[];
  dependsOn?: {
    questionId: string;
    value: string | number | boolean | string[];
  };
  helpText?: string;
  validations?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// Interface for subsections
interface ISubsection {
  id: string;
  title: string;
  description?: string;
  questions: IQuestion[];
}

// Interface for sections
interface ISection {
  id: string;
  title: string;
  description?: string;
  subsections: ISubsection[];
}

// Main questionnaire interface
export interface IQuestionnaire extends Document {
  title: string;
  description: string;
  version: string;
  isActive: boolean;
  sections: ISection[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionOptionSchema = new Schema(
  {
    value: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
    },
  },
  { _id: false }
);

const QuestionSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'number', 'select', 'multiselect', 'radio', 'checkbox', 'scale'],
      required: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: [QuestionOptionSchema],
    dependsOn: {
      questionId: String,
      value: Schema.Types.Mixed,
    },
    helpText: String,
    validations: {
      min: Number,
      max: Number,
      pattern: String,
    },
  },
  { _id: false }
);

const SubsectionSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    questions: [QuestionSchema],
  },
  { _id: false }
);

const SectionSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    subsections: [SubsectionSchema],
  },
  { _id: false }
);

const QuestionnaireSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    version: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sections: [SectionSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
QuestionnaireSchema.index({ isActive: 1 });
QuestionnaireSchema.index({ version: 1 });

// Delete the model if it exists to prevent OverwriteModelError
const Questionnaire: Model<IQuestionnaire> = mongoose.models.Questionnaire || mongoose.model<IQuestionnaire>('Questionnaire', QuestionnaireSchema);

export default Questionnaire;
