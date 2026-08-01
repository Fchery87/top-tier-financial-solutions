import type {
  AIAnalysisResult,
  AIAnalysisSummary,
  DisputeItemKind,
  DisputeItemPayload,
  GenerationMethod,
  InquiryItem,
  NegativeItem,
  PersonalInfoItem,
  TargetRecipient,
} from '../types';

export interface SelectedDisputeItemEntry {
  kind: DisputeItemKind;
  raw: NegativeItem | PersonalInfoItem | InquiryItem;
  payload: DisputeItemPayload;
}

export interface LetterGenerationBuilderInput {
  selectedClientId: string;
  negativeItems: NegativeItem[];
  selectedItems: string[];
  personalInfoItems: PersonalInfoItem[];
  selectedPersonalItems: string[];
  inquiryItems: InquiryItem[];
  selectedInquiryItems: string[];
  generationMethod: GenerationMethod;
  selectedReasonCodes: string[];
  effectiveAnalyses: AIAnalysisResult[];
  effectiveSummary: AIAnalysisSummary | null;
  selectedMethodology: string;
  selectedBureaus: string[];
  targetRecipient: TargetRecipient;
  selectedDisputeType: string;
  disputeRound: number;
  customReason: string;
  combineItemsPerBureau: boolean;
  selectedEvidenceIds: string[];
  requestManualReview: boolean;
  getInstructionText: (itemId: string) => string;
  hasItemInstruction: (itemId: string) => boolean;
  itemAppearsOnBureau: (item: NegativeItem, bureau: string) => boolean;
}

export interface LetterGenerationRequestBody {
  clientId: string;
  disputeItems: DisputeItemPayload[];
  bureau: string;
  disputeType: string;
  round: number;
  targetRecipient: TargetRecipient;
  reasonCodes: string[];
  customReason?: string;
  combineItems?: boolean;
  methodology: string;
  perItemInstructions?: Record<string, string>;
  metro2Violations?: string[];
  evidenceDocumentIds?: string[];
  requestManualReview: boolean;
  creditorName?: string;
  itemType?: string;
  amount?: number | null;
  disputeInstruction?: string;
}

export interface LetterGenerationRequestPlan {
  key: string;
  bureau: string;
  combined: boolean;
  itemKind?: DisputeItemKind;
  itemId: string;
  itemIds?: string[];
  items: DisputeItemPayload[];
  body: LetterGenerationRequestBody;
}

export interface LetterGenerationPayloadPlan {
  selectedDisputeItems: SelectedDisputeItemEntry[];
  reasonCodesToUse: string[];
  methodologyToUse: string;
  requests: LetterGenerationRequestPlan[];
}
