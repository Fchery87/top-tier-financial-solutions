/**
 * Medical Debt State Rules and the bureaus' medical-debt Bureau Reporting Policy.
 *
 * The state rules cite each statute but have not been reviewed by counsel yet.
 * Change their wording only with counsel's approval.
 */

export type MedicalDebtClassification = 'medical' | 'possible' | 'not_medical';

export interface MedicalDebtFinding {
  code: 'medical_state_rule' | 'medical_bureau_policy';
  text: string;
}

export interface MedicalDebtAssessment {
  classification: MedicalDebtClassification;
  findings: MedicalDebtFinding[];
}

export interface MedicalDebtInput {
  accountType?: string | null;
  creditorName: string;
  originalCreditor?: string | null;
  itemType: string;
  accountStatus?: string | null;
  /** Reported amount in cents. */
  amount?: number | null;
  dateOfFirstDelinquency?: string | null;
  /** The Client's current state of residence. */
  clientState?: string | null;
  now?: Date;
}

interface StateRuleFacts {
  creditorName: string;
  isPaid: boolean;
  amount: number | null;
}

interface MedicalDebtStateRule {
  citation: string;
  counselReviewed: false;
  findings: (facts: StateRuleFacts) => string[];
}

const HEALTHCARE_KEYWORDS = [
  'medical', 'hospital', 'health', 'doctor', 'dental', 'dentist', 'clinic', 'physician',
  'radiology', 'anesthesia', 'ambulance', 'emergency', 'surgical', 'surgery', 'orthopedic',
  'pediatric', 'urgent care', 'pathology', 'imaging', 'cardiology', 'oncology',
];

// The state laws exclude medical debt charged to a general-purpose credit card.
const GENERAL_PURPOSE_CARD_TYPES = ['credit_card', 'credit card', 'revolving', 'charge_card', 'charge card'];

const PAID_STATUSES = ['paid', 'paid_collection', 'paid collection', 'settled'];

const UNDER_500_CENTS = 50000;

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export const MEDICAL_DEBT_STATE_RULES: Record<'ny' | 'nj' | 'ct', MedicalDebtStateRule> = {
  ny: {
    citation: 'N.Y. Gen. Bus. Law § 380-j',
    counselReviewed: false,
    findings: () => [
      'This account is medical debt and I live in New York. New York General Business Law § 380-j bars consumer reporting agencies from reporting medical debt.',
    ],
  },
  nj: {
    citation: "New Jersey's Louisa Carman Medical Debt Relief Act (2024)",
    counselReviewed: false,
    findings: ({ creditorName, isPaid, amount }) => {
      const findings = [
        `This account is medical debt and I live in New Jersey. New Jersey's Louisa Carman Medical Debt Relief Act (2024) bars medical creditors and collection agencies such as ${creditorName} from reporting medical debt to consumer reporting agencies.`,
      ];
      if (isPaid) {
        findings.push("This medical debt is reported as paid, and New Jersey's Louisa Carman Medical Debt Relief Act (2024) bars consumer reporting agencies from reporting paid medical debt.");
      } else if (amount !== null && amount > 0 && amount < UNDER_500_CENTS) {
        findings.push(`This medical debt is reported at ${formatCents(amount)}, and New Jersey's Louisa Carman Medical Debt Relief Act (2024) bars consumer reporting agencies from reporting medical debt under $500.`);
      }
      return findings;
    },
  },
  ct: {
    citation: 'Conn. Public Act 24-6',
    counselReviewed: false,
    findings: ({ creditorName }) => [
      `This account is medical debt and I live in Connecticut. Connecticut Public Act 24-6 bars health care providers and collection agencies such as ${creditorName} from reporting medical debt to consumer reporting agencies.`,
    ],
  },
};

function normalize(value: string | null | undefined): string {
  return (value || '').toLowerCase().trim();
}

const STATE_NAMES: Record<string, keyof typeof MEDICAL_DEBT_STATE_RULES> = {
  ny: 'ny', 'new york': 'ny',
  nj: 'nj', 'new jersey': 'nj',
  ct: 'ct', connecticut: 'ct',
};

function mentionsHealthcare(value: string | null | undefined): boolean {
  const text = normalize(value);
  return text !== '' && HEALTHCARE_KEYWORDS.some(keyword => text.includes(keyword));
}

/**
 * A bureau's own medical account type or a healthcare original creditor makes a debt
 * medical. A healthcare word in the furnisher's name alone needs staff confirmation.
 */
export function classifyMedicalDebt(input: Pick<MedicalDebtInput, 'accountType' | 'creditorName' | 'originalCreditor'>): MedicalDebtClassification {
  const accountType = normalize(input.accountType);
  if (GENERAL_PURPOSE_CARD_TYPES.includes(accountType)) return 'not_medical';
  if (mentionsHealthcare(accountType) || mentionsHealthcare(input.originalCreditor)) return 'medical';
  if (mentionsHealthcare(input.creditorName)) return 'possible';
  return 'not_medical';
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

function bureauPolicyFindings(input: MedicalDebtInput, isPaid: boolean, now: Date): MedicalDebtFinding[] {
  const isCollection = normalize(input.itemType) === 'collection' || normalize(input.accountStatus) === 'collection';
  if (!isCollection) return [];

  const findings: string[] = [];
  if (isPaid) {
    findings.push("This is a paid medical collection. Under the credit bureaus' own published medical debt policy, paid medical collections are not reported.");
  }
  const amount = input.amount ?? 0;
  if (!isPaid && amount > 0 && amount < UNDER_500_CENTS) {
    findings.push(`This medical collection is reported at ${formatCents(amount)}. Under the credit bureaus' own published medical debt policy, medical collections under $500 are not reported.`);
  }
  const dofd = input.dateOfFirstDelinquency ? new Date(input.dateOfFirstDelinquency) : null;
  if (dofd && !Number.isNaN(dofd.getTime()) && monthsBetween(dofd, now) < 12) {
    findings.push(`This medical collection's date of first delinquency is ${dofd.getUTCMonth() + 1}/${dofd.getUTCFullYear()}, less than a year ago. Under the credit bureaus' own published medical debt policy, medical collections are not reported until a year after the delinquency.`);
  }
  return findings.map(text => ({ code: 'medical_bureau_policy', text }));
}

export function assessMedicalDebt(input: MedicalDebtInput): MedicalDebtAssessment {
  const classification = classifyMedicalDebt(input);
  if (classification !== 'medical') return { classification, findings: [] };

  const isPaid = PAID_STATUSES.includes(normalize(input.accountStatus)) || normalize(input.itemType).includes('paid');
  const stateKey = STATE_NAMES[normalize(input.clientState)];
  const stateRule = stateKey ? MEDICAL_DEBT_STATE_RULES[stateKey] : undefined;
  const stateFindings: MedicalDebtFinding[] = stateRule
    ? stateRule.findings({ creditorName: input.creditorName, isPaid, amount: input.amount ?? null })
      .map(text => ({ code: 'medical_state_rule', text }))
    : [];

  return {
    classification,
    findings: [...stateFindings, ...bureauPolicyFindings(input, isPaid, input.now ?? new Date())],
  };
}
