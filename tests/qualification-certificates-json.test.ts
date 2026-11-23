import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQualificationCertificatesExportPayload,
  buildQualificationCertificatesFileName,
  buildQualificationCertificatesJsonString,
  buildScopedQualificationCertificatesObject,
} from '../src/utils/qualificationCertificatesJsonExport.ts';
import { ATTESTATION_PATH_STAGES } from '../src/utils/attestationPath.ts';
import type { SessionUser } from '../src/utils/identityApi.ts';
import type { UserAttestationSummary } from '../src/components/AttestationProgressWidget.tsx';
import type { InquiryRecord } from '../src/components/social/MyInquiriesSection.tsx';
import type { LinkedAccountDTO } from '../src/domain/identity/LinkedAccounts.ts';

function makeSummary(completedStagesCount: number): UserAttestationSummary {
  const allCompleted = completedStagesCount >= ATTESTATION_PATH_STAGES.length;
  const stages = ATTESTATION_PATH_STAGES.map((stage, idx) => {
    const done = idx < completedStagesCount;
    return {
      stage: stage as UserAttestationSummary['stages'][number]['stage'],
      completedCount: done ? stage.tasks.length : 0,
      totalCount: stage.tasks.length,
      percent: done ? 100 : 0,
      status: (done ? 'completed' : 'pending') as 'completed' | 'in_progress' | 'pending',
    };
  });
  const totalTasks = stages.reduce((acc, s) => acc + s.totalCount, 0);
  const completedTasks = stages.reduce((acc, s) => acc + s.completedCount, 0);
  return {
    percent: allCompleted ? 100 : Math.round((completedTasks / totalTasks) * 100),
    completedTasks,
    totalTasks,
    completedStages: completedStagesCount,
    activeStage: stages[Math.min(completedStagesCount, stages.length - 1)].stage,
    stages,
    resolvedCompletedSet: new Set<string>(),
    autoTaskSet: new Set<string>(),
  };
}

const SAMPLE_USER: SessionUser = {
  id: 'usr-export-101',
  email: 'volkov@dv-expedition.ru',
  fullName: 'Волков Сергей Андреевич',
  region: 'Приморский край',
  organisation: 'Федерация туризма ДФО',
  role: 'instructor',
  permissions: ['inquiries:view_own', 'profile:edit_own'],
  isActive: true,
  createdAt: '2026-01-15T00:00:00.000Z',
  lastLoginAt: null,
};

const SAMPLE_INQUIRY: InquiryRecord = {
  id: 'inq-505',
  fullName: SAMPLE_USER.fullName,
  email: SAMPLE_USER.email,
  contactChannel: '@volkov_dv',
  region: 'Приморский край',
  track: 'Водный туризм',
  experienceNote: 'Сплавы 2–3 КС по рекам Приморья',
  consentAccepted: true,
  sessionDate: '2027-06-18',
  userId: SAMPLE_USER.id,
  status: 'approved',
  createdAt: '2026-10-05T12:00:00.000Z',
};

const SAMPLE_LINKED: LinkedAccountDTO = {
  provider: 'vk',
  connectionMethod: 'oauth',
  externalId: 'vk-99182',
  displayName: 'Сергей Волков',
  email: SAMPLE_USER.email,
  contactChannel: 'vk.com/id99182',
  region: 'Приморский край',
  organisation: 'Федерация туризма ДФО',
  profileUrl: 'https://vk.com/id99182',
  preferredTrack: 'Водный туризм',
  experienceSummary: '8 лет стажа',
  useForExamAutofill: true,
  linkedAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
};

describe('Qualification & certificates JSON export for external systems', () => {
  it('builds complete qualification and certificates JSON when attestation is 100% completed', () => {
    const payload = buildQualificationCertificatesExportPayload({
      user: SAMPLE_USER,
      summary: makeSummary(4),
      inquiries: [SAMPLE_INQUIRY],
      linkedAccounts: [SAMPLE_LINKED],
      selectedExamDate: '2027-06-18',
      selectedContour: 'contour_a',
      selfCheckOverride: {
        track: 'water',
        answers: {
          'sc-identity-education': 'confirmed',
          'sc-medical-clearance': 'confirmed',
          'sc-hiking-experience': 'confirmed',
          'sc-topography-navigation': 'in_progress',
        },
        updatedAt: '2026-11-20T09:00:00.000Z',
      },
      passportExtrasOverride: {
        yearsOfExperience: 7,
        completedRoutesCount: 19,
        maxRouteCategory: '3 КС',
        tenureSummary: 'Руководитель водных походов 1–3 КС',
        customSkills: ['Спасработы на воде 3 КС'],
      },
      now: new Date('2026-11-23T10:30:00.000Z'),
    });

    assert.equal(payload.schemaVersion, 'rca-vostok.qualification-certificates.v1');
    assert.equal(payload.instructor.fullName, 'Волков Сергей Андреевич');
    assert.equal(payload.qualification.trackId, 'water');
    assert.equal(payload.qualification.selfCheck.confirmedCount, 3);
    assert.equal(payload.qualification.selfCheck.partialCount, 1);
    assert.equal(payload.qualification.experience.yearsOfExperience, 7);
    assert.equal(payload.qualification.experience.completedRoutesCount, 19);
    assert.equal(payload.qualification.linkedExternalProfiles.length, 1);
    assert.equal(payload.qualification.linkedExternalProfiles[0].provider, 'vk');
    assert.ok(payload.qualification.competencies.some((c) => c.title === 'Спасработы на воде 3 КС'));

    assert.equal(payload.certificates.finalAttestationEligible, true);
    assert.ok(payload.certificates.finalAttestationCertificate !== null);
    assert.equal(payload.certificates.profileAttestationCertificate.trackLabel, 'Водный туризм');
    assert.equal(payload.certificates.attestationProgress.overallPercent, 100);
  });

  it('omits final certificate when progress is below 100% and filters scopes cleanly', () => {
    const payload = buildQualificationCertificatesExportPayload({
      user: SAMPLE_USER,
      summary: makeSummary(2),
      inquiries: [SAMPLE_INQUIRY],
      now: new Date('2026-11-23T10:30:00.000Z'),
    });

    assert.equal(payload.certificates.finalAttestationEligible, false);
    assert.equal(payload.certificates.finalAttestationCertificate, null);

    const qualOnly = buildScopedQualificationCertificatesObject(payload, 'qualification');
    assert.equal(qualOnly.exportScope, 'qualification');
    assert.ok('qualification' in qualOnly);
    assert.ok(!('certificates' in qualOnly));

    const certOnly = buildScopedQualificationCertificatesObject(payload, 'certificates');
    assert.equal(certOnly.exportScope, 'certificates');
    assert.ok('certificates' in certOnly);
    assert.ok(!('qualification' in certOnly));

    const compactJson = buildQualificationCertificatesJsonString(payload, 'all', { pretty: false });
    assert.equal(compactJson.includes('\n'), false);
    const reparsed = JSON.parse(compactJson) as typeof payload;
    assert.equal(reparsed.instructor.email, SAMPLE_USER.email);

    assert.match(
      buildQualificationCertificatesFileName(payload, 'qualification'),
      /^Kvalifikaciya_RCA_.*_2026-11-23\.json$/
    );
    assert.match(
      buildQualificationCertificatesFileName(payload, 'certificates'),
      /^Sertifikaty_RCA_.*_2026-11-23\.json$/
    );
  });
});
