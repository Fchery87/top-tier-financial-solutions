import { describe, expect, it } from 'vitest';
import { assessMedicalDebt, classifyMedicalDebt, MEDICAL_DEBT_STATE_RULES } from '@/lib/medical-dispute-rules';

const NOW = new Date('2026-10-14T00:00:00.000Z');

describe('classifyMedicalDebt', () => {
  it('treats a bureau medical account type or a healthcare original creditor as medical', () => {
    expect(classifyMedicalDebt({ accountType: 'medical', creditorName: 'Apex Recovery' })).toBe('medical');
    expect(classifyMedicalDebt({ accountType: 'collection', creditorName: 'Apex Recovery', originalCreditor: 'Northwell Health' })).toBe('medical');
  });

  it('asks for confirmation when only the furnisher name suggests healthcare', () => {
    expect(classifyMedicalDebt({ accountType: 'collection', creditorName: 'Medical Data Systems' })).toBe('possible');
  });

  it('excludes debt on a general-purpose credit card', () => {
    expect(classifyMedicalDebt({ accountType: 'credit_card', creditorName: 'Health Card Bank', originalCreditor: 'City Hospital' })).toBe('not_medical');
  });
});

describe('assessMedicalDebt', () => {
  const baseCollection = {
    accountType: 'medical',
    creditorName: 'Apex Recovery',
    itemType: 'collection',
    accountStatus: 'collection',
    amount: 120000,
    dateOfFirstDelinquency: '2023-01-15',
    now: NOW,
  };

  it('cites the New York ban for a New York resident', () => {
    expect(assessMedicalDebt({ ...baseCollection, clientState: 'NY' })).toEqual({
      classification: 'medical',
      findings: [{
        code: 'medical_state_rule',
        text: 'This account is medical debt and I live in New York. New York General Business Law § 380-j bars consumer reporting agencies from reporting medical debt.',
      }],
    });
  });

  it('adds the New Jersey bureau rule for medical debt under $500', () => {
    const { findings } = assessMedicalDebt({ ...baseCollection, amount: 32500, clientState: 'New Jersey' });

    expect(findings.map(finding => finding.text)).toEqual([
      "This account is medical debt and I live in New Jersey. New Jersey's Louisa Carman Medical Debt Relief Act (2024) bars medical creditors and collection agencies such as Apex Recovery from reporting medical debt to consumer reporting agencies.",
      "This medical debt is reported at $325.00, and New Jersey's Louisa Carman Medical Debt Relief Act (2024) bars consumer reporting agencies from reporting medical debt under $500.",
      "This medical collection is reported at $325.00. Under the credit bureaus' own published medical debt policy, medical collections under $500 are not reported.",
    ]);
  });

  it('cites the Connecticut furnisher ban for a Connecticut resident', () => {
    const { findings } = assessMedicalDebt({ ...baseCollection, clientState: 'ct' });

    expect(findings).toEqual([{
      code: 'medical_state_rule',
      text: 'This account is medical debt and I live in Connecticut. Connecticut Public Act 24-6 bars health care providers and collection agencies such as Apex Recovery from reporting medical debt to consumer reporting agencies.',
    }]);
  });

  it('frames the national limits as bureau policy for residents of other states', () => {
    const { findings } = assessMedicalDebt({ ...baseCollection, accountStatus: 'paid', clientState: 'PA' });

    expect(findings).toEqual([{
      code: 'medical_bureau_policy',
      text: "This is a paid medical collection. Under the credit bureaus' own published medical debt policy, paid medical collections are not reported.",
    }]);
  });

  it('flags a medical collection reported less than a year after the delinquency', () => {
    const { findings } = assessMedicalDebt({ ...baseCollection, dateOfFirstDelinquency: '2026-03-10', clientState: null });

    expect(findings).toEqual([{
      code: 'medical_bureau_policy',
      text: "This medical collection's date of first delinquency is 3/2026, less than a year ago. Under the credit bureaus' own published medical debt policy, medical collections are not reported until a year after the delinquency.",
    }]);
  });

  it('produces no findings until a creditor-name-only match is confirmed', () => {
    expect(assessMedicalDebt({ ...baseCollection, accountType: 'collection', creditorName: 'Medical Data Systems', clientState: 'NY' }))
      .toEqual({ classification: 'possible', findings: [] });
  });

  it('marks every state rule as not yet counsel-reviewed', () => {
    expect(Object.values(MEDICAL_DEBT_STATE_RULES).map(rule => rule.counselReviewed)).toEqual([false, false, false]);
  });
});
