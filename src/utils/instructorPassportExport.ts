import { jsPDF } from 'jspdf';
import { ROLE_LABELS, type SessionUser } from './identityApi.ts';
import type { UserAttestationSummary } from '../components/AttestationProgressWidget.tsx';
import type { InquiryRecord } from '../components/social/MyInquiriesSection.tsx';
import { formatRussianDate } from './personalRoadmap.ts';
import {
  QUALIFICATION_TRACKS,
  SELF_CHECK_QUESTIONS,
  readStoredSelfCheck,
  type QualificationTrackId,
} from './qualificationSelfCheck.ts';
import { downloadTextFile } from './download.ts';

export type MaxRouteCategory = '1 КС' | '2 КС' | '3 КС' | '4 КС' | 'Не указана';

export interface StoredPassportExtras {
  yearsOfExperience: number;
  completedRoutesCount: number;
  maxRouteCategory: MaxRouteCategory;
  tenureSummary: string;
  customSkills: string[];
}

export interface PassportSkillEntry {
  id: string;
  title: string;
  domain: string;
  source: 'self_check' | 'attestation' | 'custom';
  sourceLabel: string;
  status: 'confirmed' | 'in_progress';
}

export interface PassportAttestationEntry {
  id: string;
  title: string;
  statusLabel: string;
  percent: number;
  completed: boolean;
  details: string;
}

export interface InstructorDigitalPassport {
  schemaVersion: 'rca-vostok.digital-passport.v1';
  passportId: string;
  exportedAtIso: string;
  exportedAtFormatted: string;
  profile: {
    userId: string;
    fullName: string;
    email: string;
    role: SessionUser['role'];
    roleLabel: string;
    region: string;
    organisation: string;
    trackId: QualificationTrackId;
    trackLabel: string;
  };
  experience: {
    yearsOfExperience: number;
    completedRoutesCount: number;
    maxRouteCategory: MaxRouteCategory;
    summary: string;
  };
  confirmedSkills: PassportSkillEntry[];
  attestations: {
    overallProgressPercent: number;
    completedStagesCount: number;
    totalStagesCount: number;
    activeStageLabel: string;
    registryStatus: string;
    stages: PassportAttestationEntry[];
    inquiries: {
      id: string;
      track: string;
      region: string;
      status: InquiryRecord['status'];
      statusLabel: string;
      createdAt: string;
    }[];
  };
}

export interface GeneratedPassportPdfResult {
  fileName: string;
  passport: InstructorDigitalPassport;
  previewDataUrl: string;
  pdfBlobUrl: string;
}

export interface GeneratedPassportJsonResult {
  fileName: string;
  jsonContent: string;
  passport: InstructorDigitalPassport;
}

export const PRESET_INSTRUCTOR_SKILLS: readonly string[] = [
  'Первая помощь в автономии (Wilderness First Aid)',
  'Спутниковый трекинг (Garmin inReach) и связь с МЧС',
  'Организация навесных и водных переправ',
  'Разработка и защита паспорта маршрута (ПП РФ № 760)',
  'Безопасность групп на ООПТ ДФО (ареал крупных хищников)',
  'Спортивное ориентирование и работа с GPS/топокартами',
  'Проведение спасработ на горных и таёжных реках',
];

const STORAGE_PREFIX = 'rca_instructor_passport_extras_v1:';

const INQUIRY_STATUS_LABELS: Record<InquiryRecord['status'], string> = {
  new: 'Новая',
  in_review: 'На рассмотрении',
  needs_documents: 'Требуются документы',
  approved: 'Одобрена',
  rejected: 'Отклонена',
};

const VALID_CATEGORIES = new Set<MaxRouteCategory>([
  '1 КС',
  '2 КС',
  '3 КС',
  '4 КС',
  'Не указана',
]);

export function createDefaultPassportExtras(inquiries: InquiryRecord[] = []): StoredPassportExtras {
  const firstNote = inquiries.find((i) => i.experienceNote.trim().length > 0)?.experienceNote.trim() ?? '';
  return {
    yearsOfExperience: 0,
    completedRoutesCount: 0,
    maxRouteCategory: '1 КС',
    tenureSummary: firstNote,
    customSkills: [],
  };
}

export function readStoredPassportExtras(
  userId: string,
  inquiries: InquiryRecord[] = []
): StoredPassportExtras {
  const fallback = createDefaultPassportExtras(inquiries);
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredPassportExtras>;
    return {
      yearsOfExperience:
        typeof parsed.yearsOfExperience === 'number' && Number.isFinite(parsed.yearsOfExperience)
          ? Math.max(0, Math.min(60, Math.round(parsed.yearsOfExperience)))
          : fallback.yearsOfExperience,
      completedRoutesCount:
        typeof parsed.completedRoutesCount === 'number' && Number.isFinite(parsed.completedRoutesCount)
          ? Math.max(0, Math.min(999, Math.round(parsed.completedRoutesCount)))
          : fallback.completedRoutesCount,
      maxRouteCategory:
        parsed.maxRouteCategory && VALID_CATEGORIES.has(parsed.maxRouteCategory)
          ? parsed.maxRouteCategory
          : fallback.maxRouteCategory,
      tenureSummary:
        typeof parsed.tenureSummary === 'string' && parsed.tenureSummary.trim().length > 0
          ? parsed.tenureSummary
          : fallback.tenureSummary,
      customSkills: Array.isArray(parsed.customSkills)
        ? parsed.customSkills.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        : [],
    };
  } catch {
    return fallback;
  }
}

export function writeStoredPassportExtras(userId: string, extras: StoredPassportExtras): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(extras));
  } catch {
    // ignore storage quota errors
  }
}

function buildPassportId(userId: string, now: Date): string {
  const year = now.getUTCFullYear();
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) % 9000;
  }
  const code = String(1000 + hash).padStart(4, '0');
  const mmdd =
    String(now.getUTCMonth() + 1).padStart(2, '0') + String(now.getUTCDate()).padStart(2, '0');
  return `РЦА-${year}/ПИ-${code}-${mmdd}`;
}

export function sanitizePassportFileSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'instructor'
  );
}

export function buildInstructorDigitalPassport(options: {
  user: SessionUser;
  summary: UserAttestationSummary;
  inquiries?: InquiryRecord[];
  extras?: StoredPassportExtras;
  selfCheckOverride?: ReturnType<typeof readStoredSelfCheck>;
  now?: Date;
}): InstructorDigitalPassport {
  const { user, summary, inquiries = [] } = options;
  const now = options.now ?? new Date();
  const exportedAtIso = now.toISOString().slice(0, 10);
  const extras = options.extras ?? readStoredPassportExtras(user.id, inquiries);
  const selfCheck = options.selfCheckOverride ?? readStoredSelfCheck(user.id);

  const trackMeta =
    QUALIFICATION_TRACKS.find((t) => t.id === selfCheck.track) ?? QUALIFICATION_TRACKS[0];
  const latestInquiry = inquiries[0] ?? null;

  // Aggregate confirmed skills from self-check answers, completed attestation milestones, and user extras
  const skills: PassportSkillEntry[] = [];
  const seenTitles = new Set<string>();

  for (const q of SELF_CHECK_QUESTIONS) {
    const answer = selfCheck.answers[q.id];
    if (answer === 'confirmed' || answer === 'in_progress') {
      seenTitles.add(q.title.toLowerCase());
      skills.push({
        id: `sc:${q.id}`,
        title: q.title,
        domain: q.domainLabel,
        source: 'self_check',
        sourceLabel: 'Анкета-самопроверка РЦА',
        status: answer === 'confirmed' ? 'confirmed' : 'in_progress',
      });
    }
  }

  for (const st of summary.stages) {
    if (st.status === 'completed') {
      const title = `Зачёт этапа ${st.stage.stepNumber}: ${st.stage.title}`;
      if (!seenTitles.has(title.toLowerCase())) {
        seenTitles.add(title.toLowerCase());
        skills.push({
          id: `stage:${st.stage.id}`,
          title,
          domain: 'Этап аттестации РЦА',
          source: 'attestation',
          sourceLabel: 'Кабинет аттестации',
          status: 'confirmed',
        });
      }
    }
  }

  for (const custom of extras.customSkills) {
    const clean = custom.trim();
    if (!clean || seenTitles.has(clean.toLowerCase())) continue;
    seenTitles.add(clean.toLowerCase());
    skills.push({
      id: `custom:${clean}`,
      title: clean,
      domain: 'Профильная компетенция',
      source: 'custom',
      sourceLabel: 'Подтверждено в профиле',
      status: 'confirmed',
    });
  }

  const stageEntries: PassportAttestationEntry[] = summary.stages.map((s) => ({
    id: s.stage.id,
    title: `Этап ${s.stage.stepNumber}. ${s.stage.title}`,
    statusLabel:
      s.status === 'completed' ? 'Пройдена' : s.status === 'in_progress' ? 'В процессе' : 'Ожидает',
    percent: s.percent,
    completed: s.status === 'completed',
    details: `${s.completedCount} из ${s.totalCount} контрольных шагов`,
  }));

  const registryStatus =
    user.role === 'instructor' || summary.percent === 100
      ? 'Аттестация подтверждена (Единый федеральный реестр, срок 5 лет)'
      : summary.percent >= 50
        ? 'В процессе прохождения аттестации (ВВГУ / РЦА «Русский Восток»)'
        : 'Соискатель на этапе подготовки и подачи документов';

  const activeStageLabel =
    summary.percent === 100
      ? 'Все 4 этапа аттестации пройдены'
      : `Этап ${summary.activeStage.stepNumber}: ${summary.activeStage.title}`;

  const fallbackTenure =
    extras.tenureSummary.trim() ||
    inquiries.find((i) => i.experienceNote.trim().length > 0)?.experienceNote.trim() ||
    'Сведения о походном стаже не заполнены в профиле.';

  return {
    schemaVersion: 'rca-vostok.digital-passport.v1',
    passportId: buildPassportId(user.id, now),
    exportedAtIso,
    exportedAtFormatted: formatRussianDate(exportedAtIso),
    profile: {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      region: user.region || 'Приморский край',
      organisation: user.organisation?.trim() || 'Индивидуальная практика',
      trackId: trackMeta.id,
      trackLabel: latestInquiry?.track || trackMeta.label,
    },
    experience: {
      yearsOfExperience: extras.yearsOfExperience,
      completedRoutesCount: extras.completedRoutesCount,
      maxRouteCategory: extras.maxRouteCategory,
      summary: fallbackTenure,
    },
    confirmedSkills: skills,
    attestations: {
      overallProgressPercent: summary.percent,
      completedStagesCount: summary.completedStages,
      totalStagesCount: summary.stages.length,
      activeStageLabel,
      registryStatus,
      stages: stageEntries,
      inquiries: inquiries.map((inq) => ({
        id: inq.id,
        track: inq.track,
        region: inq.region,
        status: inq.status,
        statusLabel: INQUIRY_STATUS_LABELS[inq.status],
        createdAt: inq.createdAt,
      })),
    },
  };
}

export function buildInstructorPassportJsonString(passport: InstructorDigitalPassport): string {
  return JSON.stringify(passport, null, 2);
}

export function exportInstructorPassportJson(
  passport: InstructorDigitalPassport
): GeneratedPassportJsonResult {
  const jsonContent = buildInstructorPassportJsonString(passport);
  const fileName = `Passport_RCA_${sanitizePassportFileSlug(passport.profile.fullName)}_${passport.exportedAtIso}.json`;
  downloadTextFile(jsonContent, fileName, 'application/json;charset=utf-8');
  return { fileName, jsonContent, passport };
}

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawPassportStamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.08);
  const ink = 'rgba(15, 118, 110, 0.86)';
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;

  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('РЦА «РУССКИЙ ВОСТОК»', 0, -18);
  ctx.font = 'bold 12px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('ЦИФРОВОЙ ПАСПОРТ', 0, 2);
  ctx.fillText('ВВГУ · ФСТР', 0, 22);
  ctx.font = '11px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('г. Владивосток', 0, 44);
  ctx.restore();
}

function renderInstructorPassportCanvas(passport: InstructorDigitalPassport): HTMLCanvasElement {
  const W = 1654;
  const H = 2339;
  const marginX = 120;
  const contentW = W - marginX * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать графический контекст для PDF.');
  }

  // White A4 background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Institutional top bar
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(0, 0, W, 20);

  let y = 96;
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('РЕГИОНАЛЬНЫЙ ЦЕНТР АТТЕСТАЦИИ «РУССКИЙ ВОСТОК» · ВВГУ И ФСТР', marginX, y);

  y += 42;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 38px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('ЦИФРОВОЙ ПАСПОРТ ИНСТРУКТОРА', marginX, y);

  y += 34;
  ctx.fillStyle = '#475569';
  ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Идентификатор: ${passport.passportId}  ·  Дата выгрузки: ${passport.exportedAtFormatted} г.`,
    marginX,
    y
  );

  y += 26;
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();

  // Block 1: Profile & Experience summary
  y += 42;
  const boxTop = y;
  const tenureLine = `${passport.experience.yearsOfExperience} лет · маршрутов: ${passport.experience.completedRoutesCount} · макс. ${passport.experience.maxRouteCategory}`;
  const rows: [string, string][] = [
    ['Инструктор (ФИО):', passport.profile.fullName],
    ['Контакты / регион:', `${passport.profile.email}  ·  ${passport.profile.region}`],
    ['Роль и организация:', `${passport.profile.roleLabel} · ${passport.profile.organisation}`],
    ['Основное направление:', passport.profile.trackLabel],
    ['Статус в реестре РЦА:', passport.attestations.registryStatus],
    ['Стаж и опыт походов:', tenureLine],
  ];

  const rowH = 44;
  const boxH = rows.length * rowH + 28;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.6;
  ctx.fillRect(marginX, boxTop, contentW, boxH);
  ctx.strokeRect(marginX, boxTop, contentW, boxH);

  let ry = boxTop + 40;
  rows.forEach(([label, value], idx) => {
    ctx.fillStyle = '#475569';
    ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(label, marginX + 24, ry);

    ctx.fillStyle = '#0f172a';
    ctx.font =
      idx === 0
        ? 'bold 23px "DejaVu Sans", "Liberation Sans", Arial, sans-serif'
        : 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(value.slice(0, 76), marginX + 340, ry);

    if (idx < rows.length - 1) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginX + 20, ry + 13);
      ctx.lineTo(W - marginX - 20, ry + 13);
      ctx.stroke();
    }
    ry += rowH;
  });

  // Experience narrative
  y = boxTop + boxH + 44;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 23px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('1. Подтверждённый стаж и походная практика', marginX, y);

  y += 32;
  ctx.fillStyle = '#334155';
  ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  const tenureLines = wrapCanvasLines(ctx, passport.experience.summary, contentW).slice(0, 4);
  tenureLines.forEach((line) => {
    ctx.fillText(line, marginX, y);
    y += 29;
  });

  // Block 2: Attestations Table
  y += 28;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 23px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `2. Пройденные аттестации и этапы (общая готовность ${passport.attestations.overallProgressPercent}%)`,
    marginX,
    y
  );

  y += 22;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(marginX, y, contentW, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Этап аттестации', marginX + 18, y + 26);
  ctx.fillText('Выполнение', marginX + 790, y + 26);
  ctx.fillText('Статус', marginX + 1140, y + 26);
  y += 40;

  passport.attestations.stages.forEach((st, idx) => {
    const h = 46;
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(marginX, y, contentW, h);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, y, contentW, h);

    ctx.fillStyle = '#0f172a';
    ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(st.title, marginX + 18, y + 29);
    ctx.fillText(`${st.details} (${st.percent}%)`, marginX + 790, y + 29);

    ctx.fillStyle = st.completed ? '#047857' : st.percent > 0 ? '#b45309' : '#475569';
    ctx.font = 'bold 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(st.statusLabel, marginX + 1140, y + 29);
    y += h;
  });

  // Block 3: Confirmed Skills
  y += 48;
  const confirmedList = passport.confirmedSkills.filter((s) => s.status === 'confirmed');
  const inProgressList = passport.confirmedSkills.filter((s) => s.status === 'in_progress');
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 23px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `3. Подтверждённые навыки и компетенции (${confirmedList.length} подтв. / ${inProgressList.length} в работе)`,
    marginX,
    y
  );

  y += 34;
  if (passport.confirmedSkills.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(
      'Навыки будут автоматически добавлены после заполнения Анкеты-самопроверки или профиля паспорта.',
      marginX,
      y
    );
    y += 32;
  } else {
    const visibleSkills = passport.confirmedSkills.slice(0, 11);
    visibleSkills.forEach((sk, idx) => {
      const badge = sk.status === 'confirmed' ? '[ПОДТВЕРЖДЕНО]' : '[В РАБОТЕ]';
      ctx.fillStyle = sk.status === 'confirmed' ? '#0f766e' : '#b45309';
      ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
      ctx.fillText(`${String(idx + 1).padStart(2, '0')}. ${badge}`, marginX, y);

      ctx.fillStyle = '#0f172a';
      ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
      const titleText = `${sk.title} (${sk.sourceLabel})`;
      const wrapped = wrapCanvasLines(ctx, titleText, contentW - 230).slice(0, 2);
      wrapped.forEach((line, lIdx) => {
        ctx.fillText(line, marginX + 210, y + lIdx * 24);
      });
      y += wrapped.length * 24 + 14;
    });
    if (passport.confirmedSkills.length > 11) {
      ctx.fillStyle = '#475569';
      ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
      ctx.fillText(
        `… и ещё ${passport.confirmedSkills.length - 11} компетенций (полный перечень доступен в JSON-выгрузке).`,
        marginX,
        y
      );
    }
  }

  // Stamp & Footer
  drawPassportStamp(ctx, W - marginX - 150, 2030, 118);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Региональный центр аттестации «Русский Восток» (ВВГУ / ФСТР)', marginX, 2015);
  ctx.fillStyle = '#475569';
  ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Документ сформирован автоматически на основании верифицированных данных кабинета', marginX, 2046);

  const footerY = H - 84;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 26);
  ctx.lineTo(W - marginX, footerY - 26);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Формат: Цифровой паспорт инструктора · ${passport.schemaVersion} · ${passport.passportId} · https://rca-vostok.ru`,
    marginX,
    footerY
  );

  return canvas;
}

export function generateInstructorPassportPdf(
  passport: InstructorDigitalPassport
): GeneratedPassportPdfResult {
  const canvas = renderInstructorPassportCanvas(passport);
  const previewDataUrl = canvas.toDataURL('image/png');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pdf.addImage(previewDataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

  const fileName = `Passport_RCA_${sanitizePassportFileSlug(passport.profile.fullName)}_${passport.exportedAtIso}.pdf`;
  const pdfBlob = pdf.output('blob');
  const pdfBlobUrl = URL.createObjectURL(pdfBlob);
  pdf.save(fileName);

  return {
    fileName,
    passport,
    previewDataUrl,
    pdfBlobUrl,
  };
}
