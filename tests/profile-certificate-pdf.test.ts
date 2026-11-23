import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILE_CERTIFICATE_CATEGORIES,
  PROFILE_CERTIFICATE_TRACKS,
  buildProfileAttestationCertificateData,
  resolveDefaultExamDateIso,
  resolveDefaultTrack,
} from '../src/utils/profileCertificatePdf.ts';
import { ATTESTATION_PATH_STAGES } from '../src/utils/attestationPath.ts';
import type { SessionUser } from '../src/utils/identityApi.ts';
import type { UserAttestationSummary } from '../src/components/AttestationProgressWidget.tsx';
import type { InquiryRecord } from '../src/components/social/MyInquiriesSection.tsx';

function makeSummary(completedStagesCount: number): UserAttestationSummary {
  const allCompleted = completedStagesCount >= ATTESTATION_PATH_STAGES.length;
  const stages = ATTESTATION_PATH_STAGES.map((stage, idx) => {
    const done = idx < completedStagesCount;
    const inProg = idx === completedStagesCount && !allCompleted;
    return {
      stage: stage as UserAttestationSummary['stages'][number]['stage'],
      completedCount: done ? stage.tasks.length : inProg ? 1 : 0,
      totalCount: stage.tasks.length,
      percent: done ? 100 : inProg ? 33 : 0,
      status: (done ? 'completed' : inProg ? 'in_progress' : 'pending') as
        | 'completed'
        | 'in_progress'
        | 'pending',
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

const SAMPLE_INSTRUCTOR: SessionUser = {
  id: 'usr-vostok-77',
  email: 'morozov@vostok-guide.ru',
  fullName: 'Морозов Дмитрий Викторович',
  region: 'Камчатский край',
  organisation: 'Клуб горного туризма «Авача»',
  role: 'instructor',
  permissions: ['inquiries:view_own', 'profile:edit_own'],
  isActive: true,
  createdAt: '2026-02-01T00:00:00.000Z',
  lastLoginAt: null,
};

const SAMPLE_INQUIRY: InquiryRecord = {
  id: 'inq-99',
  fullName: SAMPLE_INSTRUCTOR.fullName,
  email: SAMPLE_INSTRUCTOR.email,
  contactChannel: '@morozov_kamchatka',
  region: 'Камчатский край',
  track: 'Горный туризм',
  experienceNote: 'Восхождения 2–3 КС',
  consentAccepted: true,
  sessionDate: '2027-05-20',
  userId: SAMPLE_INSTRUCTOR.id,
  status: 'approved',
  createdAt: '2026-10-12T10:00:00.000Z',
};

describe('Profile-based attestation certificate builder', () => {
  it('derives certificate metadata directly from user profile and approved inquiry', () => {
    const summary = makeSummary(4);
    const cert = buildProfileAttestationCertificateData({
      user: SAMPLE_INSTRUCTOR,
      summary,
      inquiries: [SAMPLE_INQUIRY],
      now: new Date('2026-11-23T08:00:00.000Z'),
    });

    assert.equal(cert.holderName, 'Морозов Дмитрий Викторович');
    assert.equal(cert.holderEmail, 'morozov@vostok-guide.ru');
    assert.equal(cert.region, 'Камчатский край');
    assert.equal(cert.organisation, 'Клуб горного туризма «Авача»');
    assert.equal(cert.roleLabel, 'Инструктор-проводник');
    assert.equal(cert.trackLabel, 'Горный туризм');
    assert.equal(cert.examDateIso, '2027-05-20');
    assert.equal(cert.issuedAtIso, '2026-11-23');
    assert.equal(cert.validUntilIso, '2031-11-23');
    assert.equal(cert.isFullyCompleted, true);
    assert.equal(cert.stages.length, ATTESTATION_PATH_STAGES.length);
    assert.match(cert.certificateNumber, /^РЦА-ДФО-2026-\d{5}$/);
    assert.match(cert.verificationCode, /^RCA-[0-9A-Z]+$/);
  });

  it('supports partial progress profiles, empty organisation fallback, and manual overrides', () => {
    const independentUser: SessionUser = {
      ...SAMPLE_INSTRUCTOR,
      id: 'usr-indep-12',
      role: 'candidate',
      organisation: '   ',
    };
    const partialSummary = makeSummary(2);

    const cert = buildProfileAttestationCertificateData({
      user: independentUser,
      summary: partialSummary,
      inquiries: [],
      track: PROFILE_CERTIFICATE_TRACKS[1],
      complexityCategory: PROFILE_CERTIFICATE_CATEGORIES[2],
      contour: 'contour_a',
      examDateIso: '2027-06-14',
      protocolNote: 'Протокол № 14-ВВГУ/2027',
      now: new Date('2026-11-23T08:00:00.000Z'),
    });

    assert.equal(cert.organisation, 'Независимый инструктор-проводник');
    assert.equal(cert.trackLabel, 'Водный туризм');
    assert.equal(cert.complexityCategory, PROFILE_CERTIFICATE_CATEGORIES[2]);
    assert.equal(cert.contourId, 'contour_a');
    assert.equal(cert.examDateIso, '2027-06-14');
    assert.equal(cert.protocolNote, 'Протокол № 14-ВВГУ/2027');
    assert.equal(cert.isFullyCompleted, false);
    assert.equal(cert.completedStages, 2);
    assert.equal(cert.stages[0].statusLabel, 'Завершён');
    assert.equal(cert.stages[2].statusLabel, 'В работе');
    assert.equal(cert.stages[3].statusLabel, 'В плане');
  });

  it('resolves default track and exam date cleanly across inquiry states', () => {
    assert.equal(resolveDefaultTrack([]), PROFILE_CERTIFICATE_TRACKS[0]);
    assert.equal(resolveDefaultTrack([SAMPLE_INQUIRY]), 'Горный туризм');
    assert.equal(
      resolveDefaultExamDateIso([SAMPLE_INQUIRY], '2027-09-01'),
      '2027-09-01'
    );
    assert.equal(resolveDefaultExamDateIso([SAMPLE_INQUIRY]), '2027-05-20');
  });
});
