import type { Page, Route } from '@playwright/test';

export const e2eClient = {
  id: 'e2e-client-record',
  first_name: 'Portal',
  last_name: 'Fixture',
  email: 'portal-fixture@example.test',
  phone: null,
  status: 'active',
};

export const e2eNegativeItem = {
  id: 'e2e-negative-item',
  creditor_name: 'Fixture Card Services',
  original_creditor: null,
  account_number: '****1234',
  item_type: 'collection',
  amount: 420,
  date_reported: '2026-07-01T00:00:00.000Z',
  bureau: 'transunion',
  on_transunion: true,
  on_experian: true,
  on_equifax: true,
  risk_severity: 'high',
  recommended_action: 'dispute',
};

const json = (route: Route, value: unknown, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(value),
});

export interface WizardFixtureState {
  generateRequests: Array<Record<string, unknown>>;
  updateRequests: Array<Record<string, unknown>>;
  draftId: string;
}

export async function installWizardApiFixtures(page: Page): Promise<WizardFixtureState> {
  const state: WizardFixtureState = {
    generateRequests: [],
    updateRequests: [],
    draftId: 'e2e-generated-dispute',
  };

  await page.route('**/api/admin/clients**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith(`/clients/${e2eClient.id}`)) {
      await json(route, {
        client: e2eClient,
        negative_items: [e2eNegativeItem],
        personal_info_disputes: [],
        inquiry_disputes: [],
        credit_reports: [{ id: 'e2e-report', file_name: 'fixture-report.pdf', bureau: 'transunion', uploaded_at: '2026-07-01T00:00:00.000Z' }],
      });
      return;
    }

    await json(route, { items: [e2eClient], total: 1, page: 1, limit: 50 });
  });

  await page.route('**/api/admin/disputes/methodologies**', async (route) => {
    await json(route, {
      methodologies: [{
        code: 'factual',
        name: 'Factual accuracy',
        description: 'Request a documented investigation of the reported facts.',
        roundRange: [1, 2, 3],
        targetRecipients: ['bureau', 'creditor', 'collector'],
        bestFor: ['inaccurate reporting'],
        successIndicators: ['documented response'],
      }],
      reason_codes: [{ code: 'verification_required', label: 'Request verification', description: 'Request verification.' }],
      dispute_types: [{ code: 'standard', label: 'Standard' }],
    });
  });

  await page.route('**/api/admin/disputes/*/cfpb-eligibility**', async (route) => {
    await json(route, {
      eligible: false,
      reason: 'still_pending',
      eligible_at: '2026-08-15T00:00:00.000Z',
      message: 'CFPB escalation is deferred until 2026-08-15T00:00:00.000Z.',
    });
  });

  await page.route('**/api/admin/disputes/discrepancies**', async (route) => {
    await json(route, { summary: { total: 0, highSeverity: 0 } });
  });

  await page.route('**/api/admin/disputes/triage', async (route) => {
    await json(route, { quickActions: [], historicalRecommendations: {} });
  });

  await page.route('**/api/admin/disputes/evidence**', async (route) => {
    await json(route, { documents: [] });
  });

  await page.route('**/api/admin/disputes/analyze-items', async (route) => {
    await json(route, {
      analyses: [{
        itemId: e2eNegativeItem.id,
        creditorName: e2eNegativeItem.creditor_name,
        itemType: e2eNegativeItem.item_type,
        suggestedMethodology: 'factual',
        autoReasonCodes: ['verification_required'],
        metro2Violations: [],
        fcraIssues: [],
        confidence: 0.95,
        analysisNotes: 'Fixture analysis',
      }],
      summary: {
        itemCount: 1,
        recommendedMethodology: 'factual',
        allReasonCodes: ['verification_required'],
        allMetro2Violations: [],
        allFcraIssues: [],
        averageConfidence: 0.95,
        analysisNotes: 'Fixture analysis',
      },
    });
  });

  await page.route('**/api/admin/disputes/drafts/generate', async (route) => {
    const requestBody: unknown = route.request().postDataJSON();
    if (typeof requestBody === 'object' && requestBody !== null && !Array.isArray(requestBody)) {
      state.generateRequests.push(requestBody as Record<string, unknown>);
    }
    await json(route, {
      dispute_id: state.draftId,
      revision: 1,
      letter_content: 'Fixture generated letter requesting documented verification.',
      library_selection: {
        chosen: { id: 'fixture-library-row', name: 'Fixture strategy' },
        score: 9,
        rationale: ['Matches the fixture reason code.'],
        runnersUp: [],
      },
    });
  });

  await page.route('**/api/admin/disputes/e2e-generated-dispute/letter', async (route) => {
    await json(route, {
      content: 'Fixture generated letter requesting documented verification.',
      current_revision: 1,
      immutable_reason: null,
      lint: { findings: [], blocked: false },
      library: { name: 'Fixture strategy', methodology: 'factual', rationale: { rationale: ['Matches the fixture reason code.'] } },
      revisions: [{
        id: 'fixture-revision-1',
        revision: 1,
        source: 'generated',
        tone_label: null,
        warnings_acknowledged: false,
        created_by: 'fixture-admin',
        created_at: '2026-08-02T00:00:00.000Z',
        content: 'Fixture generated letter requesting documented verification.',
      }],
    });
  });

  await page.route('**/api/admin/disputes/e2e-generated-dispute', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }
    const requestBody: unknown = route.request().postDataJSON();
    if (typeof requestBody === 'object' && requestBody !== null && !Array.isArray(requestBody)) {
      state.updateRequests.push(requestBody as Record<string, unknown>);
    }
    await json(route, { id: state.draftId, status: 'sent' });
  });

  return state;
}

export async function installPortalApiFixtures(page: Page): Promise<void> {
  await page.route('**/api/portal/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/cases')) {
      await json(route, { cases: [{ id: 'case-1', status: 'active', phase: 'investigation', progress: 40 }] });
      return;
    }
    if (pathname.endsWith('/letters')) {
      await json(route, { letters: [{ id: 'letter-1', approval_id: 'approval-1', status: 'pending', letter_content: 'Review me' }] });
      return;
    }
    if (pathname.endsWith('/audit-report')) {
      await json(route, { has_report: false, message: 'Fixture report is not yet available.' });
      return;
    }
    if (pathname.endsWith('/disputes')) {
      await json(route, { disputes: [], stats: { total: 0, pending: 0, resolved: 0 } });
      return;
    }
    if (pathname.endsWith('/score-history')) {
      await json(route, { history: [], summary: null });
      return;
    }
    if (pathname.endsWith('/feedback')) {
      await json(route, { feedback: [] });
      return;
    }
    if (pathname.endsWith('/tasks')) {
      await json(route, { tasks: [] });
      return;
    }
    if (pathname.endsWith('/documents')) {
      await json(route, { documents: [] });
      return;
    }
    if (pathname.endsWith('/agreement')) {
      await json(route, { agreement: null });
      return;
    }
    await json(route, {});
  });
}

export async function installDisputeListFixture(page: Page, status = 'draft'): Promise<void> {
  await page.route('**/api/admin/disputes**', async (route) => {
    await json(route, {
      disputes: [{
        id: 'e2e-generated-dispute',
        client_id: e2eClient.id,
        client_name: `${e2eClient.first_name} ${e2eClient.last_name}`,
        negative_item_id: e2eNegativeItem.id,
        bureau: 'transunion',
        dispute_reason: 'Request documented verification',
        dispute_type: 'standard',
        status,
        round: 1,
        tracking_number: null,
        sent_at: status === 'sent' ? '2026-08-02T00:00:00.000Z' : null,
        letter_content: 'Fixture generated letter requesting documented verification.',
        response_deadline: null,
        response_received_at: null,
        outcome: null,
        response_notes: null,
        response_channel: null,
        score_impact: null,
        creditor_name: e2eNegativeItem.creditor_name,
        account_number: e2eNegativeItem.account_number,
        created_at: '2026-08-02T00:00:00.000Z',
      }],
    });
  });
}

export interface LetterStudioFixtureState {
  saveRequests: Array<Record<string, unknown>>;
  rewriteRequests: Array<Record<string, unknown>>;
  revertRequests: string[];
  toneRequests: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function installLetterStudioApiFixtures(page: Page, sent = false): Promise<LetterStudioFixtureState> {
  await installDisputeListFixture(page, sent ? 'sent' : 'draft');

  const state: LetterStudioFixtureState = {
    saveRequests: [],
    rewriteRequests: [],
    revertRequests: [],
    toneRequests: [],
  };
  let content = sent ? 'Sent fixture letter.' : 'Original fixture letter.';
  let revision = 1;
  let immutableReason = sent ? 'This dispute has been sent and its letter is immutable.' : null;
  let findings: Array<{ code: string; severity: 'block' | 'warn'; message: string }> = [];
  const revisions: Array<Record<string, unknown>> = [{
    id: 'studio-revision-1',
    revision: 1,
    source: 'generated',
    tone_label: null,
    warnings_acknowledged: false,
    created_by: 'fixture-admin',
    created_at: '2026-08-02T00:00:00.000Z',
    content,
  }];

  await page.route('**/api/admin/disputes/e2e-generated-dispute/letter', async (route) => {
    await json(route, {
      content,
      current_revision: revision,
      immutable_reason: immutableReason,
      lint: { findings, blocked: findings.some(finding => finding.severity === 'block') },
      library: { name: 'Fixture strategy', methodology: 'factual', rationale: { rationale: ['Matches the fixture reason code.'] } },
      revisions,
    });
  });

  await page.route('**/api/admin/disputes/e2e-generated-dispute/letter/lint', async (route) => {
    const body: unknown = route.request().postDataJSON();
    const proposed = isRecord(body) && typeof body.content === 'string' ? body.content : '';
    findings = proposed.includes('not-on-file')
      ? [{ code: 'creditor_not_on_file', severity: 'block', message: 'The letter references a creditor that is not in the client file.' }]
      : proposed.includes('legal action')
        ? [{ code: 'threat_language', severity: 'warn', message: 'The letter uses legal-threat language and requires acknowledgement.' }]
        : [];
    await json(route, { findings, blocked: findings.some(finding => finding.severity === 'block') });
  });

  await page.route('**/api/admin/disputes/e2e-generated-dispute/letter/rewrite', async (route) => {
    const body: unknown = route.request().postDataJSON();
    const input = isRecord(body) ? body : {};
    const mode = typeof input.mode === 'string' ? input.mode : 'rewrite';
    const tone = typeof input.tone === 'string' ? input.tone : null;
    const selected = typeof input.expectedSelectedText === 'string' ? input.expectedSelectedText : null;
    state.rewriteRequests.push(input);
    if (tone) state.toneRequests.push(tone);
    const replacement = tone ? `${tone} fixture rewrite.` : 'Rewritten selected fixture passage.';
    content = selected && content.includes(selected) ? content.replace(selected, replacement) : replacement;
    revision += 1;
    revisions.push({
      id: `studio-revision-${revision}`,
      revision,
      source: mode === 'tone' ? 'ai_tone' : 'ai_rewrite',
      tone_label: tone,
      warnings_acknowledged: false,
      created_by: 'fixture-admin',
      created_at: `2026-08-02T00:0${revision}:00.000Z`,
      content,
    });
    findings = [];
    await json(route, { letter: content, content, revision, findings });
  });

  await page.route('**/api/admin/disputes/e2e-generated-dispute/letter/revisions/*/revert', async (route) => {
    state.revertRequests.push(route.request().url());
    const selectedRevision = revisions.find(item => item.revision === 1);
    content = typeof selectedRevision?.content === 'string' ? selectedRevision.content : content;
    revision += 1;
    revisions.push({
      id: `studio-revision-${revision}`,
      revision,
      source: 'revert',
      tone_label: null,
      warnings_acknowledged: false,
      created_by: 'fixture-admin',
      created_at: `2026-08-02T00:0${revision}:00.000Z`,
      content,
    });
    await json(route, { content, revision, findings: [] });
  });

  await page.route('**/api/admin/disputes/e2e-generated-dispute', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }
    const body: unknown = route.request().postDataJSON();
    const input = isRecord(body) ? body : {};
    if (typeof input.letterContent === 'string') {
      state.saveRequests.push(input);
      content = input.letterContent;
      revision += 1;
      revisions.push({
        id: `studio-revision-${revision}`,
        revision,
        source: 'manual',
        tone_label: null,
        warnings_acknowledged: input.acknowledgeWarnings === true,
        created_by: 'fixture-admin',
        created_at: `2026-08-02T00:0${revision}:00.000Z`,
        content,
      });
    }
    if (input.status === 'sent') immutableReason = 'This dispute has been sent and its letter is immutable.';
    await json(route, { id: 'e2e-generated-dispute', status: input.status || 'draft', content, revision });
  });

  return state;
}
