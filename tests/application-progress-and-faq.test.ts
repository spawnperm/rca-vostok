import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApplicationProgressModel } from '../src/utils/applicationProgress.ts';
import { LANDING_SECTIONS } from '../src/data/landingContent.ts';
import { ATTESTATION_FAQ } from '../src/data/researchData.ts';
import type { InquiryRecord } from '../src/components/social/MyInquiriesSection.tsx';

function makeInquiry(
  status: InquiryRecord['status'],
  statusComment?: string
): InquiryRecord {
  return {
    id: 'inq-test-12345678',
    fullName: 'Петров Иван Сергеевич',
    email: 'petrov@example.ru',
    contactChannel: '@petrov_guide',
    region: 'Приморский край',
    track: 'Пешеходный туризм',
    experienceNote: '3 походов 2 КС',
    consentAccepted: true,
    sessionDate: '2027-04-16',
    statusComment,
    userId: 'user-1',
    status,
    createdAt: '2026-11-20T09:00:00.000Z',
  };
}

describe('ApplicationProgressIndicator model & FAQ landing integration', () => {
  it('models no_inquiry at 0% with step 1 awaiting submission', () => {
    const model = buildApplicationProgressModel({
      userRole: 'candidate',
      activeInquiry: null,
      overallChecklistPercent: 8,
    });
    assert.equal(model.statusKey, 'no_inquiry');
    assert.equal(model.progressPercent, 0);
    assert.equal(model.completedStepsCount, 0);
    assert.equal(model.steps[0].state, 'current');
  });

  it('models each inquiry status accurately with distinct progress percentages and tones', () => {
    const newModel = buildApplicationProgressModel({
      userRole: 'candidate',
      activeInquiry: makeInquiry('new'),
    });
    assert.equal(newModel.statusKey, 'new');
    assert.equal(newModel.progressPercent, 25);
    assert.equal(newModel.completedStepsCount, 1);
    assert.equal(newModel.steps[0].state, 'completed');
    assert.equal(newModel.steps[1].state, 'current');

    const docsModel = buildApplicationProgressModel({
      userRole: 'candidate',
      activeInquiry: makeInquiry('needs_documents', 'Прикрепите скан медсправки'),
    });
    assert.equal(docsModel.statusKey, 'needs_documents');
    assert.equal(docsModel.progressPercent, 40);
    assert.equal(docsModel.tone, 'amber');
    assert.equal(docsModel.steps[1].state, 'attention');
    assert.equal(docsModel.statusSummary, 'Прикрепите скан медсправки');

    const reviewModel = buildApplicationProgressModel({
      userRole: 'candidate',
      activeInquiry: makeInquiry('in_review'),
    });
    assert.equal(reviewModel.statusKey, 'in_review');
    assert.equal(reviewModel.progressPercent, 55);
    assert.equal(reviewModel.completedStepsCount, 2);
    assert.equal(reviewModel.steps[2].state, 'current');

    const approvedModel = buildApplicationProgressModel({
      userRole: 'candidate',
      activeInquiry: makeInquiry('approved'),
      overallChecklistPercent: 67,
    });
    assert.equal(approvedModel.statusKey, 'approved');
    assert.equal(approvedModel.progressPercent, 75);
    assert.equal(approvedModel.completedStepsCount, 3);
    assert.equal(approvedModel.tone, 'emerald');
    assert.equal(approvedModel.steps[3].state, 'current');

    const certifiedModel = buildApplicationProgressModel({
      userRole: 'instructor',
      activeInquiry: makeInquiry('approved'),
      overallChecklistPercent: 100,
    });
    assert.equal(certifiedModel.statusKey, 'certified');
    assert.equal(certifiedModel.progressPercent, 100);
    assert.equal(certifiedModel.completedStepsCount, 4);

    const rejectedModel = buildApplicationProgressModel({
      userRole: 'candidate',
      activeInquiry: makeInquiry('rejected', 'Недостаточно подтверждённого стажа'),
    });
    assert.equal(rejectedModel.statusKey, 'rejected');
    assert.equal(rejectedModel.tone, 'rose');
    assert.equal(rejectedModel.steps[1].state, 'rejected');
    assert.equal(rejectedModel.statusSummary, 'Недостаточно подтверждённого стажа');
  });

  it('includes faq in LANDING_SECTIONS and has attestation FAQ entries', () => {
    const faqSection = LANDING_SECTIONS.find((s) => s.id === 'faq');
    assert.ok(faqSection);
    assert.equal(faqSection.label, 'FAQ');
    assert.ok(ATTESTATION_FAQ.length >= 10);
  });
});
