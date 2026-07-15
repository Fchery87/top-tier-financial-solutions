export interface MedicalRuleInput {
  accountType?: string | null;
  itemType?: string | null;
  amount?: number | null;
  state?: string | null;
  ageMonths?: number | null;
}

export interface MedicalRuleRecommendation {
  reasonCodes: string[];
  methodology: 'factual' | 'metro2_compliance' | 'method_of_verification';
  targetRecipient: 'bureau' | 'creditor';
  description: string;
}

const STATE_MEDICAL_RESTRICTIONS: Record<string, { minAmount?: number; maxAgeMonths?: number; note: string }> = {
  ny: { note: 'New York medical-debt reporting restrictions may apply.' },
  co: { note: 'Colorado medical-debt reporting restrictions may apply.' },
  ca: { note: 'California medical-debt reporting restrictions may apply.' },
  ct: { note: 'Connecticut medical-debt reporting restrictions may apply.' },
  md: { note: 'Maryland medical-debt reporting restrictions may apply.' },
  ri: { note: 'Rhode Island medical-debt reporting restrictions may apply.' },
  vt: { note: 'Vermont medical-debt reporting restrictions may apply.' },
  mn: { note: 'Minnesota medical-debt reporting restrictions may apply.' },
};

function normalize(value: string | null | undefined): string {
  return (value || '').toLowerCase().trim();
}

export function isMedicalAccountType(value: string | null | undefined): boolean {
  const v = normalize(value);
  return v.includes('medical') || v.includes('hospital') || v.includes('healthcare') || v.includes('health care') || v.includes('doctor') || v.includes('dental') || v.includes('clinic');
}

export function getMedicalRuleRecommendation(input: MedicalRuleInput): MedicalRuleRecommendation | null {
  const type = normalize(input.accountType || input.itemType);
  const isMedical = isMedicalAccountType(type);
  if (!isMedical) return null;

  const reasonCodes: string[] = [];
  const methodology: MedicalRuleRecommendation['methodology'] = 'factual';
  let targetRecipient: MedicalRuleRecommendation['targetRecipient'] = 'bureau';
  const descriptionParts: string[] = [];

  if ((input.amount ?? 0) > 0 && (input.amount ?? 0) < 50000) {
    reasonCodes.push('medical_debt_under_500');
    descriptionParts.push('Medical collection under $500');
  }

  if (normalize(input.itemType).includes('paid') || normalize(input.accountType).includes('paid')) {
    reasonCodes.push('paid_medical_collection');
    descriptionParts.push('Paid medical account still reporting as negative');
  }

  if ((input.ageMonths ?? 0) > 0 && (input.ageMonths ?? 0) < 12) {
    reasonCodes.push('medical_under_one_year');
    descriptionParts.push('Medical debt is younger than 1 year');
  }

  const state = normalize(input.state);
  if (state && STATE_MEDICAL_RESTRICTIONS[state]) {
    reasonCodes.push(`medical_state_restriction_${state}`);
    descriptionParts.push(STATE_MEDICAL_RESTRICTIONS[state].note);
  }

  if (reasonCodes.length === 0) {
    reasonCodes.push('medical_verification_required');
    descriptionParts.push('Request verification of medical reporting accuracy');
  }

  if (state === 'ny' || state === 'co') {
    targetRecipient = 'bureau';
  }

  return {
    reasonCodes,
    methodology,
    targetRecipient,
    description: descriptionParts.join('; '),
  };
}

export function listMedicalReasonCodes(): string[] {
  return [
    'medical_debt_under_500',
    'paid_medical_collection',
    'medical_under_one_year',
    'medical_state_restriction_ny',
    'medical_state_restriction_co',
    'medical_state_restriction_ca',
    'medical_state_restriction_ct',
    'medical_state_restriction_md',
    'medical_state_restriction_ri',
    'medical_state_restriction_vt',
    'medical_state_restriction_mn',
    'medical_verification_required',
  ];
}
