import type { UserAttestationSummary } from '../components/AttestationProgressWidget.tsx';
import type { InquiryRecord } from '../components/social/MyInquiriesSection.tsx';
import {
  evaluateAttestationDiagnostics,
  readStoredDiagnosticsState,
} from './attestationSelfDiagnostics.ts';
import type { SessionUser } from './identityApi.ts';
import {
  PRESET_INSTRUCTOR_SKILLS,
  readStoredPassportExtras,
  type MaxRouteCategory,
  type StoredPassportExtras,
} from './instructorPassportExport.ts';
import { formatRussianDate, type PreparationContour } from './personalRoadmap.ts';
import { readStoredSelfCheck, SELF_CHECK_QUESTIONS } from './qualificationSelfCheck.ts';
import {
  exportCanvasAsA4PortraitPdf,
  sanitizeFileSlug,
  wrapLines,
} from './pdfCanvasHelpers.ts';

export interface ResumeAchievementItem {
  id: string;
  title: string;
  meta: string;
}

export interface InstructorResumeInput {
  fullName: string;
  email: string;
  contactPhone: string;
  region: string;
  organisation: string;
  specialization: string;
  contour: PreparationContour;
  yearsOfExperience: number;
  completedRoutesCount: number;
  maxCategory: MaxRouteCategory;
  aboutSummary: string;
  educationAndDpo: string;
  achievements: ResumeAchievementItem[];
  competencies: string[];
  attestationStatusLabel: string;
  attestationPercent: number;
  completedStagesCount: number;
  totalStagesCount: number;
  diagnosticsPercent: number | null;
}

export interface InstructorResumeModel extends InstructorResumeInput {
  resumeId: string;
  issuedAtIso: string;
  issuedAtFormatted: string;
  contourLabel: string;
}

export interface GeneratedInstructorResumePdf {
  fileName: string;
  resume: InstructorResumeModel;
  previewDataUrl: string;
  pdfBlobUrl: string;
}

export const RESUME_SPECIALIZATIONS: readonly string[] = [
  'Инструктор-проводник · Пешеходный и горно-таёжный туризм',
  'Инструктор-проводник · Водный туризм, сплавы и морской каякинг',
  'Инструктор-проводник · Экспедиционный и автономный туризм ДФО',
  'Инструктор-проводник · Экотропы ООПТ и прибрежные маршруты',
  'Универсальный инструктор-проводник (пеший + водный профиль)',
];

function buildResumeId(seed: string, now: Date): string {
  const year = now.getUTCFullYear();
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9000;
  }
  const suffix = String(1000 + Math.abs(hash)).padStart(4, '0');
  const mmdd =
    String(now.getUTCMonth() + 1).padStart(2, '0') + String(now.getUTCDate()).padStart(2, '0');
  return `РЦА-РЗ-${year}-${mmdd}-${suffix}`;
}

/**
 * Builds an initial resume draft strictly from live profile, passport extras,
 * attestation stage summary, self-check & diagnostics data.
 */
export function buildDefaultResumeDraft(params: {
  user: SessionUser | null;
  summary?: UserAttestationSummary;
  inquiries?: InquiryRecord[];
  selectedContour?: PreparationContour;
  passportExtrasOverride?: StoredPassportExtras;
  diagnosticsPercentOverride?: number | null;
  selfCheckOverride?: ReturnType<typeof readStoredSelfCheck>;
}): InstructorResumeInput {
  const { user, summary, inquiries = [], selectedContour = 'contour_b' } = params;

  const extras: StoredPassportExtras =
    params.passportExtrasOverride ??
    (user
      ? readStoredPassportExtras(user.id, inquiries)
      : {
          yearsOfExperience: 2,
          completedRoutesCount: 14,
          maxRouteCategory: '2 КС',
          tenureSummary:
            'Сопровождение коммерческих и клубных групп по горно-таёжным маршрутам и экотропам ООПТ Приморского края.',
          customSkills: [PRESET_INSTRUCTOR_SKILLS[0], PRESET_INSTRUCTOR_SKILLS[3]],
        });

  let diagnosticsPercent: number | null = params.diagnosticsPercentOverride ?? null;
  if (diagnosticsPercent === null && typeof window !== 'undefined') {
    const diagState = readStoredDiagnosticsState(user?.id);
    const diagEval = evaluateAttestationDiagnostics(diagState.answers);
    if (diagEval.answeredCount > 0) {
      diagnosticsPercent = diagEval.overallPercent;
    }
  }

  const selfCheck =
    params.selfCheckOverride ??
    (user ? readStoredSelfCheck(user.id) : { track: 'hiking' as const, answers: {}, updatedAt: null });

  const latestInquiry = inquiries[0] ?? null;
  const derivedTrack = latestInquiry?.track ?? '';
  let specialization = RESUME_SPECIALIZATIONS[0];
  if (derivedTrack.toLowerCase().includes('водн') || selfCheck.track === 'water') {
    specialization = RESUME_SPECIALIZATIONS[1];
  } else if (derivedTrack.toLowerCase().includes('экспед') || selfCheck.track === 'expedition') {
    specialization = RESUME_SPECIALIZATIONS[2];
  }

  const completedStages = summary?.stages.filter((s) => s.status === 'completed') ?? [];
  const totalStagesCount = summary?.stages.length ?? 4;
  const attestationPercent = summary?.percent ?? 0;

  let attestationStatusLabel = 'Предварительная подготовка к аттестации в РЦА «Русский Восток»';
  if (summary && summary.percent === 100) {
    attestationStatusLabel = 'Аттестация РЦА «Русский Восток» завершена (ЕФРТА · 5 лет)';
  } else if (user?.role === 'instructor') {
    attestationStatusLabel = 'Действующий инструктор-проводник в профиле РЦА ДФО';
  } else if (summary && summary.percent > 0) {
    attestationStatusLabel = `В процессе аттестации (${summary.percent}% · ${completedStages.length}/${totalStagesCount} этапов)`;
  }

  // Derive structured professional achievements from attestation stages, inquiries, and profile
  const achievements: ResumeAchievementItem[] = [];
  const seenTitles = new Set<string>();
  const pushAchievement = (id: string, title: string, meta: string) => {
    const key = title.trim().toLowerCase();
    if (!title.trim() || seenTitles.has(key)) return;
    seenTitles.add(key);
    achievements.push({ id, title: title.trim(), meta: meta.trim() });
  };

  if (summary?.percent === 100) {
    pushAchievement(
      'ach-full-cert',
      'Успешно пройдены все 4 этапа государственной аттестации РЦА «Русский Восток» (ВВГУ + ФСТР)',
      'ЕФРТА · Допуск 5 лет'
    );
  }

  for (const st of completedStages) {
    pushAchievement(
      `ach-stage-${st.stage.id}`,
      `Зачтён этап ${st.stage.stepNumber}: ${st.stage.title}`,
      'РЦА «Русский Восток»'
    );
  }

  for (const inq of inquiries) {
    if (inq.status === 'approved') {
      pushAchievement(
        `ach-inq-${inq.id}`,
        `Допуск комиссии к аттестационной сессии по направлению «${inq.track}»`,
        inq.region
      );
    }
  }

  if (diagnosticsPercent !== null && diagnosticsPercent >= 75) {
    pushAchievement(
      'ach-diag',
      `Пройдена самодиагностика знаний по ПП № 1003, ПП № 760 и WFA с результатом ${diagnosticsPercent}%`,
      'Личный кабинет РЦА'
    );
  }

  if (extras.completedRoutesCount > 0) {
    pushAchievement(
      'ach-routes',
      `Безаварийное сопровождение групп на ${extras.completedRoutesCount} маршрутах (до ${extras.maxRouteCategory})`,
      user?.region || 'Дальний Восток'
    );
  }

  if (achievements.length === 0) {
    pushAchievement(
      'ach-default-1',
      'Подготовка паспорта туристского маршрута в соответствии с требованиями ПП РФ № 760',
      'Нормативная практика'
    );
    pushAchievement(
      'ach-default-2',
      'Отработка протоколов первой помощи в природной среде (Wilderness First Aid) и регистрации в МЧС',
      'Безопасность ДФО'
    );
  }

  // Gather confirmed skills & competencies
  const competencies: string[] = [];
  const seenSkills = new Set<string>();
  const addCompetency = (val: string) => {
    const clean = val.trim();
    if (!clean || seenSkills.has(clean.toLowerCase())) return;
    seenSkills.add(clean.toLowerCase());
    competencies.push(clean);
  };

  for (const q of SELF_CHECK_QUESTIONS) {
    if (selfCheck.answers[q.id] === 'confirmed') {
      addCompetency(q.title);
    }
  }
  for (const custom of extras.customSkills) {
    addCompetency(custom);
  }
  if (competencies.length === 0) {
    addCompetency(PRESET_INSTRUCTOR_SKILLS[0]);
    addCompetency(PRESET_INSTRUCTOR_SKILLS[3]);
    addCompetency(PRESET_INSTRUCTOR_SKILLS[4]);
  }

  const educationAndDpo =
    selectedContour === 'contour_a'
      ? 'Образовательный трек: Контур А (зачёт подтверждённого походного стажа, ВВГУ / ФСТР)'
      : 'Образовательный трек: Контур Б (профессиональная переподготовка ДПО ВВГУ ≈ 250 ч + экзамен РЦА)';

  const aboutSummary =
    extras.tenureSummary.trim() ||
    inquiries.find((i) => i.experienceNote.trim().length > 0)?.experienceNote.trim() ||
    'Инструктор-проводник активного туризма ДФО: планирование нитки маршрута, брифинг и страховка группы, соблюдение режимов ООПТ и стандартов безопасности (ФЗ № 132-ФЗ).';

  return {
    fullName: user?.fullName?.trim() || 'Соколов Алексей Владимирович',
    email: user?.email?.trim() || 'guide@rca-vostok.ru',
    contactPhone: '',
    region: user?.region?.trim() || 'Приморский край',
    organisation: user?.organisation?.trim() || 'Индивидуальная практика / Туроператор ДФО',
    specialization,
    contour: selectedContour,
    yearsOfExperience: extras.yearsOfExperience,
    completedRoutesCount: extras.completedRoutesCount,
    maxCategory: extras.maxRouteCategory,
    aboutSummary,
    educationAndDpo,
    achievements,
    competencies,
    attestationStatusLabel,
    attestationPercent,
    completedStagesCount: completedStages.length,
    totalStagesCount,
    diagnosticsPercent,
  };
}

export function buildInstructorResumeModel(
  input: InstructorResumeInput,
  now: Date = new Date()
): InstructorResumeModel {
  const issuedAtIso = now.toISOString().slice(0, 10);
  const fullName = input.fullName.trim() || 'Инструктор-проводник РЦА';
  const region = input.region.trim() || 'Приморский край';
  const organisation = input.organisation.trim() || 'Индивидуальная практика';
  const contourLabel =
    input.contour === 'contour_a'
      ? 'Контур А (зачёт подтверждённого стажа)'
      : 'Контур Б (обучение ДПО ВВГУ + аттестация)';

  const cleanAchievements = input.achievements
    .map((a) => ({
      id: a.id,
      title: a.title.trim(),
      meta: a.meta.trim() || region,
    }))
    .filter((a) => a.title.length > 0);

  const cleanCompetencies = Array.from(
    new Set(input.competencies.map((c) => c.trim()).filter(Boolean))
  );

  return {
    ...input,
    fullName,
    region,
    organisation,
    email: input.email.trim() || '—',
    contactPhone: input.contactPhone.trim(),
    specialization: input.specialization.trim() || RESUME_SPECIALIZATIONS[0],
    aboutSummary:
      input.aboutSummary.trim() ||
      'Сопровождение туристских групп на маршрутах повышенной сложности ДФО.',
    educationAndDpo: input.educationAndDpo.trim() || contourLabel,
    achievements: cleanAchievements,
    competencies: cleanCompetencies,
    resumeId: buildResumeId(`${fullName}-${region}-${cleanAchievements.length}`, now),
    issuedAtIso,
    issuedAtFormatted: formatRussianDate(issuedAtIso),
    contourLabel,
  };
}

function renderResumeA4Canvas(resume: InstructorResumeModel): HTMLCanvasElement {
  const W = 1654;
  const H = 2339;
  const marginX = 110;
  const contentW = W - marginX * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать графический контекст для резюме.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Dark editorial header banner
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, W, 336);

  ctx.fillStyle = '#0F766E';
  ctx.fillRect(0, 336, W, 10);

  ctx.fillStyle = '#5EEAD4';
  ctx.font = 'bold 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'ПРОФЕССИОНАЛЬНОЕ РЕЗЮМЕ ИНСТРУКТОРА-ПРОВОДНИКА · РЦА «РУССКИЙ ВОСТОК»',
    marginX,
    78
  );

  ctx.fillStyle = '#FFFFFF';
  const nameFontPx = resume.fullName.length > 34 ? 40 : 48;
  ctx.font = `bold ${nameFontPx}px "DejaVu Sans", "Liberation Sans", Arial, sans-serif`;
  ctx.fillText(resume.fullName, marginX, 146);

  ctx.fillStyle = '#CCFBF1';
  ctx.font = 'bold 22px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(resume.specialization, marginX, 194);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  const contactsParts = [
    `Регион: ${resume.region}`,
    `Организация: ${resume.organisation}`,
    `Email: ${resume.email}`,
  ];
  if (resume.contactPhone) {
    contactsParts.push(`Тел.: ${resume.contactPhone}`);
  }
  const contactLines = wrapLines(ctx, contactsParts.join('  ·  '), contentW).slice(0, 2);
  contactLines.forEach((cl, idx) => {
    ctx.fillText(cl, marginX, 248 + idx * 30);
  });

  // 4-Metric KPI Strip
  let y = 390;
  const cardW = (contentW - 3 * 22) / 4;
  const cardH = 116;
  const kpis: [string, string, boolean][] = [
    ['Походный стаж', `${resume.yearsOfExperience} лет`, false],
    ['Проведено маршрутов', `${resume.completedRoutesCount} групп`, false],
    ['Макс. сложность', resume.maxCategory, true],
    [
      'Аттестация РЦА',
      `${resume.attestationPercent}% (${resume.completedStagesCount}/${resume.totalStagesCount})`,
      resume.attestationPercent === 100,
    ],
  ];

  kpis.forEach(([label, val, accent], idx) => {
    const x = marginX + idx * (cardW + 22);
    ctx.fillStyle = accent ? '#F0FDFA' : '#F8FAFC';
    ctx.strokeStyle = accent ? '#0F766E' : '#CBD5E1';
    ctx.lineWidth = accent ? 2 : 1.4;
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeRect(x, y, cardW, cardH);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(label, x + 20, y + 36);

    ctx.fillStyle = accent ? '#0F766E' : '#0F172A';
    ctx.font = 'bold 26px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(val, x + 20, y + 84);
  });

  // Section 1: Summary & Experience
  y += cardH + 54;
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('01 · ПРОФИЛЬ И ОПЫТ СОПРОВОЖДЕНИЯ', marginX, y);

  y += 14;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();

  y += 34;
  ctx.fillStyle = '#1E293B';
  ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  const summaryLines = wrapLines(ctx, resume.aboutSummary, contentW).slice(0, 5);
  for (const line of summaryLines) {
    ctx.fillText(line, marginX, y);
    y += 30;
  }

  // Section 2: Attestation & Education
  y += 30;
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('02 · АТТЕСТАЦИЯ И ОБРАЗОВАТЕЛЬНЫЙ КОНТУР', marginX, y);

  y += 14;
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();

  y += 24;
  const attBoxH = resume.diagnosticsPercent !== null ? 132 : 96;
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.4;
  ctx.fillRect(marginX, y, contentW, attBoxH);
  ctx.strokeRect(marginX, y, contentW, attBoxH);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`Статус аттестации: ${resume.attestationStatusLabel}`, marginX + 24, y + 38);

  ctx.fillStyle = '#334155';
  ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(resume.educationAndDpo, marginX + 24, y + 74);

  if (resume.diagnosticsPercent !== null) {
    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(
      `Итоговый балл самодиагностики знаний (ПП № 1003, № 760, WFA, ДФО): ${resume.diagnosticsPercent}%`,
      marginX + 24,
      y + 110
    );
  }

  y += attBoxH + 46;

  // Section 3: Key Professional Achievements
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('03 · КЛЮЧЕВЫЕ ПРОФЕССИОНАЛЬНЫЕ ДОСТИЖЕНИЯ', marginX, y);

  y += 14;
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();

  y += 28;
  const visibleAchievements = resume.achievements.slice(0, 7);
  for (const ach of visibleAchievements) {
    ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const titleLines = wrapLines(ctx, `• ${ach.title}`, contentW - 320).slice(0, 2);

    ctx.fillStyle = '#0F172A';
    titleLines.forEach((tl, idx) => {
      ctx.fillText(tl, marginX, y + idx * 27);
    });

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(ach.meta.slice(0, 32), W - marginX, y);
    ctx.textAlign = 'left';

    y += titleLines.length * 27 + 16;
  }

  // Section 4: Key Competencies
  y += 22;
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('04 · ПОДТВЕРЖДЁННЫЕ КОМПЕТЕНЦИИ И НАВЫКИ ДФО', marginX, y);

  y += 14;
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();

  y += 30;
  const visibleCompetencies = resume.competencies.slice(0, 10);
  const colW = (contentW - 32) / 2;
  visibleCompetencies.forEach((comp, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const cx = marginX + col * (colW + 32);
    const cy = y + row * 46;
    if (cy > H - 150) return;

    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.fillRect(cx, cy - 22, colW, 36);
    ctx.strokeRect(cx, cy - 22, colW, 36);

    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText('✓', cx + 14, cy + 2);

    ctx.fillStyle = '#0F172A';
    ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const trimmed = comp.length > 52 ? `${comp.slice(0, 49)}…` : comp;
    ctx.fillText(trimmed, cx + 38, cy + 2);
  });

  // Footer
  const footerY = H - 82;
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 26);
  ctx.lineTo(W - marginX, footerY - 26);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Резюме сформировано в Личном кабинете РЦА «Русский Восток» · Код: ${resume.resumeId} · ${resume.issuedAtFormatted} г.`,
    marginX,
    footerY
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('rca-vostok.ru', W - marginX, footerY);
  ctx.textAlign = 'left';

  return canvas;
}

export function generateInstructorResumePdf(
  input: InstructorResumeInput,
  options: { autoDownload?: boolean } = {}
): GeneratedInstructorResumePdf {
  const { autoDownload = true } = options;
  const resume = buildInstructorResumeModel(input);
  const canvas = renderResumeA4Canvas(resume);
  const fileName = `Resume_Instructor_RCA_${sanitizeFileSlug(resume.fullName, 'instructor', 36)}_${resume.issuedAtIso}.pdf`;
  const { previewDataUrl, pdfBlobUrl } = exportCanvasAsA4PortraitPdf(canvas, fileName, {
    autoDownload,
  });

  return {
    fileName,
    resume,
    previewDataUrl,
    pdfBlobUrl,
  };
}
