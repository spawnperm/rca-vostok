import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { buildN8nFromLegacyWorkflow } from '../../domain/n8n/workflowDefinition.ts';
import type {
  WorkflowCondition,
  WorkflowNodeDef,
  WorkflowTriggerType,
} from '../../domain/nocobase/entities.ts';
import { buildDefaultContentForKind } from '../../domain/office/entities.ts';
import { ALL_PERMISSIONS } from '../../domain/iam/rbac.ts';
import { buildTraefikHostRule } from '../../domain/tenancy/tenant.ts';
import { encodeOfficeDocumentToBuffer, OFFICE_MIME_TYPES } from '../office/ooxmlCodec.ts';
import { putGarageObject } from '../storage/garageS3Service.ts';
import { getDb } from './client.ts';
import {
  cmsBlocks,
  companies,
  contacts,
  deals,
  emailTemplates,
  forgejoCommits,
  forgejoRepos,
  garageBuckets,
  mmChannels,
  mmPosts,
  mmReactions,
  natsEvents,
  nocobaseApprovals,
  nocobaseCollections,
  nocobaseRecords,
  nocobaseWorkflowExecutions,
  nocobaseWorkflows,
  officeDocuments,
  pipelineStages,
  pipelines,
  plugins,
  rolePermissions,
  roles,
  socialComments,
  socialGroups,
  socialPosts,
  socialProfiles,
  tasks,
  tenantPlugins,
  tenants,
  timelineEvents,
  users,
} from './schema.ts';
import { ensureTenantMattermostSetup } from '../mattermost/mattermostSync.ts';

function hashPassword(plain: string): string {
  const salt = 'nexus-harness-static-seed-v1';
  return crypto.scryptSync(plain, salt, 32).toString('hex');
}

export function verifyPasswordHash(plain: string, stored: string): boolean {
  const salt = 'nexus-harness-static-seed-v1';
  const candidate = crypto.scryptSync(plain, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(stored, 'hex'));
}

export async function ensureSeeded(): Promise<void> {
  const db = await getDb();
  const existing = await db.select().from(tenants).limit(1);
  if (existing.length > 0) {
    await ensureDefaultEmailTemplatesSeeded();
    await ensureDefaultOfficeSuiteSeeded();
    await ensureNocobaseSeeded();
    await ensureMattermostSeeded();
    return;
  }

  // 1. Seed Tenants (Multi-tenant Subdomains)
  const seedTenants = [
    {
      id: 'tnt_acme',
      name: 'Acme Cloud Solutions',
      subdomain: 'acme',
      plan: 'enterprise',
      status: 'active',
      maxUsers: 120,
      maxDeals: 50000,
      traefikRule: buildTraefikHostRule('acme'),
    },
    {
      id: 'tnt_globex',
      name: 'Globex Industrial Group',
      subdomain: 'globex',
      plan: 'growth',
      status: 'active',
      maxUsers: 45,
      maxDeals: 15000,
      traefikRule: buildTraefikHostRule('globex'),
    },
    {
      id: 'tnt_alpha',
      name: 'Alpha FinTech Hub',
      subdomain: 'alpha',
      plan: 'starter',
      status: 'active',
      maxUsers: 15,
      maxDeals: 3000,
      traefikRule: buildTraefikHostRule('alpha'),
    },
  ];
  await db.insert(tenants).values(seedTenants);

  // 2. Seed RBAC Roles & Permissions for each tenant
  const roleDefs = [
    {
      code: 'portal_superadmin',
      name: 'Portal SuperAdmin',
      description: 'Полный контроль портала, тенантов на поддоменах, RBAC и плагинов Verdaccio',
      perms: [...ALL_PERMISSIONS],
    },
    {
      code: 'sales_head',
      name: 'Руководитель продаж (РОП)',
      description: 'Управление сделками, аналитикой, контактами, задачами и запуск Dify/Harness',
      perms: [
        'deals:read',
        'deals:write',
        'deals:delete',
        'contacts:read',
        'contacts:write',
        'tasks:read',
        'tasks:write',
        'social:read',
        'social:post',
        'social:moderate',
        'plugins:read',
        'plugins:manage',
        'harness:execute',
        'cms:edit',
        'docs:read',
        'collections:read',
        'collections:manage',
        'workflows:read',
        'workflows:manage',
      ],
    },
    {
      code: 'sales_manager',
      name: 'Менеджер по продажам',
      description: 'Ведение воронки сделок, контактов, задач и участие в корпоративной соцсети',
      perms: [
        'deals:read',
        'deals:write',
        'contacts:read',
        'contacts:write',
        'tasks:read',
        'tasks:write',
        'social:read',
        'social:post',
        'plugins:read',
        'harness:execute',
        'docs:read',
        'collections:read',
        'workflows:read',
      ],
    },
    {
      code: 'viewer',
      name: 'Аудитор / Наблюдатель',
      description: 'Доступ только на чтение воронки CRM, профиля и документации Scalar/Archify',
      perms: [
        'deals:read',
        'contacts:read',
        'tasks:read',
        'social:read',
        'plugins:read',
        'docs:read',
        'collections:read',
        'workflows:read',
      ],
    },
  ];

  for (const tenant of seedTenants) {
    for (const def of roleDefs) {
      const roleId = `role_${tenant.subdomain}_${def.code}`;
      await db.insert(roles).values({
        id: roleId,
        tenantId: tenant.id,
        code: def.code,
        name: def.name,
        description: def.description,
        isSystem: true,
      });
      await db.insert(rolePermissions).values(
        def.perms.map((perm) => ({
          id: `rp_${roleId}_${perm}`,
          roleId,
          permission: perm,
        }))
      );
    }
  }

  // 3. Seed Users across tenants
  const avatarAlexey = '/src/assets/images/avatar_alexey_volkov_1795559386382.jpg';
  const avatarElena = '/src/assets/images/avatar_elena_smirnova_1795559386124.jpg';
  const avatarDmitry = '/src/assets/images/avatar_dmitry_kuznetsov_1795559386885.jpg';
  const coverUrl = '/src/assets/images/profile_cover_banner_1795559385959.jpg';

  const defaultPass = hashPassword('nexus-demo-2026');

  const seedUsers = [
    {
      id: 'usr_alexey',
      tenantId: 'tnt_acme',
      email: 'alexey.volkov@acme.platform.local',
      fullName: 'Алексей Волков',
      roleId: 'role_acme_portal_superadmin',
      avatarUrl: avatarAlexey,
      passwordHash: defaultPass,
    },
    {
      id: 'usr_elena',
      tenantId: 'tnt_acme',
      email: 'elena.smirnova@acme.platform.local',
      fullName: 'Елена Смирнова',
      roleId: 'role_acme_sales_head',
      avatarUrl: avatarElena,
      passwordHash: defaultPass,
    },
    {
      id: 'usr_dmitry',
      tenantId: 'tnt_acme',
      email: 'dmitry.kuznetsov@acme.platform.local',
      fullName: 'Дмитрий Кузнецов',
      roleId: 'role_acme_sales_manager',
      avatarUrl: avatarDmitry,
      passwordHash: defaultPass,
    },
    {
      id: 'usr_auditor',
      tenantId: 'tnt_acme',
      email: 'audit@acme.platform.local',
      fullName: 'Ирина Соколова',
      roleId: 'role_acme_viewer',
      avatarUrl: avatarElena,
      passwordHash: defaultPass,
    },
    {
      id: 'usr_globex_admin',
      tenantId: 'tnt_globex',
      email: 'admin@globex.platform.local',
      fullName: 'Сергей Морозов',
      roleId: 'role_globex_portal_superadmin',
      avatarUrl: avatarDmitry,
      passwordHash: defaultPass,
    },
    {
      id: 'usr_alpha_admin',
      tenantId: 'tnt_alpha',
      email: 'lead@alpha.platform.local',
      fullName: 'Марина Орлова',
      roleId: 'role_alpha_sales_head',
      avatarUrl: avatarElena,
      passwordHash: defaultPass,
    },
  ];
  await db.insert(users).values(seedUsers);

  // 4. Seed Social Profiles (BuddyBoss + VKontakte style)
  await db.insert(socialProfiles).values([
    {
      userId: 'usr_alexey',
      tenantId: 'tnt_acme',
      handle: 'alexey_volkov',
      headline: 'VP of Platform & Revenue Architecture',
      department: 'Центр компетенций DeepSeek-Harness',
      city: 'Москва',
      coverUrl,
      statusText: 'Разворачиваем федерацию поддоменов Traefik и плагины в Verdaccio',
      bio: 'Отвечаю за DDD-архитектуру корпоративного портала, автоматизацию воронок amoCRM через Dify и развитие внутренней партнерской сети.',
      skills: ['DDD Architecture', 'amoCRM Pipelines', 'DeepSeek-Harness', 'PostgreSQL', 'NATS JetStream'],
      friendsCount: 48,
      followersCount: 312,
    },
    {
      userId: 'usr_elena',
      tenantId: 'tnt_acme',
      handle: 'elena_smirnova',
      headline: 'Руководитель отдела корпоративных продаж',
      department: 'Enterprise Sales',
      city: 'Санкт-Петербург',
      coverUrl,
      statusText: 'План Q4 выполнен на 118%, готовим демо для NordStar Logistics',
      bio: 'Помогаю B2B-командам выстраивать предсказуемую воронку в amoCRM с автоматическим скорингом сделок.',
      skills: ['B2B Enterprise', 'Цифровая воронка', 'Переговоры', 'Dify Copilot'],
      friendsCount: 64,
      followersCount: 420,
    },
    {
      userId: 'usr_dmitry',
      tenantId: 'tnt_acme',
      handle: 'dmitry_kuznetsov',
      headline: 'Lead Account Executive & Solutions Engineer',
      department: 'Технический пресейл',
      city: 'Казань',
      coverUrl,
      statusText: 'Тестирую новый виджет опросов для стены команды',
      bio: 'Сопровождаю технические интеграции: Directus, NATS события, кастомные плагины на базе @nexus-plugins/*.',
      skills: ['Pre-Sale', 'TypeScript', 'Zod Contracts', 'Traefik'],
      friendsCount: 31,
      followersCount: 154,
    },
  ]);

  await db.insert(socialGroups).values([
    {
      id: 'grp_sales_hq',
      tenantId: 'tnt_acme',
      name: 'Клуб Enterprise-продаж',
      description: 'Разборы сложных B2B-сделок, скрипты дожима и обмен практиками по воронке amoCRM.',
      category: 'Коммерция',
      membersCount: 34,
      isJoined: true,
    },
    {
      id: 'grp_harness_guild',
      tenantId: 'tnt_acme',
      name: 'DeepSeek-Harness & Dify Guild',
      description: 'Воркшопы по проектированию AI-агентов, NATS-событий и плагинов в Verdaccio.',
      category: 'Инженерия',
      membersCount: 22,
      isJoined: true,
    },
    {
      id: 'grp_product_tina',
      tenantId: 'tnt_acme',
      name: 'Витрина знаний и TinaCMS',
      description: 'Редакционная группа по обновлению клиентских презентаций и баз знаний в Directus.',
      category: 'Контент',
      membersCount: 16,
      isJoined: false,
    },
  ]);

  await db.insert(socialPosts).values([
    {
      id: 'post_1',
      tenantId: 'tnt_acme',
      authorId: 'usr_elena',
      content:
        'Закрыли годовой контракт с NordStar Logistics на интеграцию единой воронки и NATS-шины событий. Коллеги из пресейла, спасибо за оперативный прототип схемы!',
      attachmentType: 'deal',
      attachmentData: {
        dealId: 'deal_acme_2',
        dealTitle: 'NordStar Logistics — Внедрение Enterprise CRM',
        budget: 2450000,
        currency: 'RUB',
      },
      likesCount: 14,
      likedByUsers: ['usr_alexey', 'usr_dmitry'],
      repostsCount: 3,
    },
    {
      id: 'post_2',
      tenantId: 'tnt_acme',
      authorId: 'usr_alexey',
      content:
        'Опубликовали обновление @nexus-plugins/dify-deal-copilot@1.4.2 в корпоративный Verdaccio реестр. Плагин добавляет AI-оценку вероятности закрытия прямо в карточку сделки amoCRM.',
      attachmentType: 'doc',
      attachmentData: {
        title: 'Release Notes: @nexus-plugins/dify-deal-copilot v1.4.2',
        subtitle: 'Verdaccio Registry · SHA-512 verified',
      },
      likesCount: 9,
      likedByUsers: ['usr_elena'],
      repostsCount: 2,
    },
  ]);

  await db.insert(socialComments).values([
    {
      id: 'cmt_1',
      tenantId: 'tnt_acme',
      postId: 'post_1',
      authorId: 'usr_dmitry',
      body: 'Отличная сделка! Уже подключил им песочницу на поддомене и проверил вебхуки NATS.',
    },
    {
      id: 'cmt_2',
      tenantId: 'tnt_acme',
      postId: 'post_2',
      authorId: 'usr_elena',
      body: 'Включила плагин для нашего отдела — скоринг по зависшим сделкам сразу подсветил 3 приоритетных звонка.',
    },
  ]);

  // 5. Seed amoCRM Pipelines, Stages, Companies, Contacts, Deals, Tasks, Timeline
  const pipelineDefs = [
    {
      tenantId: 'tnt_acme',
      pipelineId: 'pip_acme_main',
      name: 'Основная воронка B2B',
    },
    {
      tenantId: 'tnt_globex',
      pipelineId: 'pip_globex_main',
      name: 'Промышленные контракты',
    },
    {
      tenantId: 'tnt_alpha',
      pipelineId: 'pip_alpha_main',
      name: 'Подключение FinTech-партнеров',
    },
  ];

  for (const pip of pipelineDefs) {
    await db.insert(pipelines).values({
      id: pip.pipelineId,
      tenantId: pip.tenantId,
      name: pip.name,
      isDefault: true,
    });

    const stageTemplates = [
      { key: 'unsorted', name: 'Неразобранное', color: '#64748B', sortOrder: 1, isWon: false, isLost: false },
      { key: 'contact', name: 'Первичный контакт', color: '#3B82F6', sortOrder: 2, isWon: false, isLost: false },
      { key: 'negotiation', name: 'Переговоры', color: '#8B5CF6', sortOrder: 3, isWon: false, isLost: false },
      { key: 'decision', name: 'Принимают решение', color: '#F59E0B', sortOrder: 4, isWon: false, isLost: false },
      { key: 'won', name: 'Успешно реализовано', color: '#16A34A', sortOrder: 5, isWon: true, isLost: false },
      { key: 'lost', name: 'Закрыто и не реализовано', color: '#DC2626', sortOrder: 6, isWon: false, isLost: true },
    ];

    await db.insert(pipelineStages).values(
      stageTemplates.map((st) => ({
        id: `stg_${pip.tenantId}_${st.key}`,
        tenantId: pip.tenantId,
        pipelineId: pip.pipelineId,
        name: st.name,
        color: st.color,
        sortOrder: st.sortOrder,
        isWon: st.isWon,
        isLost: st.isLost,
      }))
    );
  }

  await db.insert(companies).values([
    {
      id: 'cmp_1',
      tenantId: 'tnt_acme',
      name: 'NordStar Logistics',
      industry: 'Логистика и цепи поставок',
      website: 'nordstar.ru',
      phone: '+7 (495) 780-11-20',
      customFields: { cf_tier: 'Enterprise', cf_inn: '7707083893', cf_kpp: '773601001', cf_edo: true },
    },
    {
      id: 'cmp_2',
      tenantId: 'tnt_acme',
      name: 'ТехноПром Автоматика',
      industry: 'Промышленный IoT',
      website: 'technoprom.io',
      phone: '+7 (812) 412-55-09',
      customFields: { cf_tier: 'Mid-Market', cf_inn: '7812045509', cf_kpp: '781201001', cf_edo: true },
    },
    {
      id: 'cmp_3',
      tenantId: 'tnt_acme',
      name: 'Балтик Ритейл Групп',
      industry: 'Ритейл',
      website: 'balticretail.ru',
      phone: '+7 (495) 990-44-18',
      customFields: { cf_tier: 'Enterprise', cf_inn: '7704990441', cf_kpp: '770401001', cf_edo: false },
    },
    {
      id: 'cmp_4',
      tenantId: 'tnt_globex',
      name: 'УралСталь Холдинг',
      industry: 'Металлургия',
      website: 'uralsteel.ru',
      phone: '+7 (343) 220-88-10',
      customFields: { cf_tier: 'Enterprise', cf_inn: '6671220881', cf_kpp: '667101001', cf_edo: true },
    },
  ]);

  await db.insert(contacts).values([
    {
      id: 'cnt_1',
      tenantId: 'tnt_acme',
      fullName: 'Виктор Громов',
      phone: '+7 (916) 442-10-88',
      email: 'v.gromov@nordstar.ru',
      position: 'ИТ-директор',
      companyId: 'cmp_1',
      companyName: 'NordStar Logistics',
      tags: ['ЛПР', 'Enterprise'],
      customFields: { cf_source: 'Рекомендация', cf_lpr: true, cf_telegram: '@vgromov_it' },
    },
    {
      id: 'cnt_2',
      tenantId: 'tnt_acme',
      fullName: 'Ольга Белова',
      phone: '+7 (921) 318-90-44',
      email: 'belova@technoprom.io',
      position: 'Коммерческий директор',
      companyId: 'cmp_2',
      companyName: 'ТехноПром Автоматика',
      tags: ['IoT', 'Приоритет'],
      customFields: { cf_source: 'Конференция', cf_lpr: true, cf_telegram: '@belova_iot' },
    },
    {
      id: 'cnt_3',
      tenantId: 'tnt_acme',
      fullName: 'Артем Захаров',
      phone: '+7 (903) 774-22-15',
      email: 'zakharov@balticretail.ru',
      position: 'Руководитель цифровой трансформации',
      companyId: 'cmp_3',
      companyName: 'Балтик Ритейл Групп',
      tags: ['Ритейл', 'Входящий лид'],
      customFields: { cf_source: 'Сайт / Форма', cf_lpr: false, cf_telegram: '@azakharov' },
    },
    {
      id: 'cnt_4',
      tenantId: 'tnt_globex',
      fullName: 'Павел Крылов',
      phone: '+7 (912) 605-33-91',
      email: 'krylov@uralsteel.ru',
      position: 'Директор по закупкам',
      companyId: 'cmp_4',
      companyName: 'УралСталь Холдинг',
      tags: ['Тендер'],
      customFields: { cf_source: 'Входящий запрос', cf_lpr: true, cf_telegram: '@pkrylov' },
    },
  ]);

  await db.insert(deals).values([
    {
      id: 'deal_acme_1',
      tenantId: 'tnt_acme',
      pipelineId: 'pip_acme_main',
      stageId: 'stg_tnt_acme_unsorted',
      title: 'Балтик Ритейл — Запрос на 120 рабочих мест CRM',
      budget: 890000,
      currency: 'RUB',
      contactId: 'cnt_3',
      companyId: 'cmp_3',
      ownerId: 'usr_dmitry',
      tags: ['Входящий сайт', 'Ритейл'],
      customFields: { Источник: 'TinaCMS Форма', Срок_запуска: 'Декабрь 2026' },
    },
    {
      id: 'deal_acme_2',
      tenantId: 'tnt_acme',
      pipelineId: 'pip_acme_main',
      stageId: 'stg_tnt_acme_won',
      title: 'NordStar Logistics — Внедрение Enterprise CRM',
      budget: 2450000,
      currency: 'RUB',
      contactId: 'cnt_1',
      companyId: 'cmp_1',
      ownerId: 'usr_elena',
      tags: ['Enterprise', 'Годовой контракт'],
      customFields: { Поддомен: 'nordstar.platform.local', Лицензий: '85' },
    },
    {
      id: 'deal_acme_3',
      tenantId: 'tnt_acme',
      pipelineId: 'pip_acme_main',
      stageId: 'stg_tnt_acme_negotiation',
      title: 'ТехноПром — Пилот DeepSeek-Harness + Directus',
      budget: 1350000,
      currency: 'RUB',
      contactId: 'cnt_2',
      companyId: 'cmp_2',
      ownerId: 'usr_elena',
      tags: ['Dify AI', 'Пилот'],
      customFields: { Модули: 'CRM + NATS + Dify', Вероятность: '75%' },
    },
    {
      id: 'deal_acme_4',
      tenantId: 'tnt_acme',
      pipelineId: 'pip_acme_main',
      stageId: 'stg_tnt_acme_decision',
      title: 'NordStar — Расширение плагина телеметрии',
      budget: 640000,
      currency: 'RUB',
      contactId: 'cnt_1',
      companyId: 'cmp_1',
      ownerId: 'usr_alexey',
      tags: ['Апселл', 'Verdaccio'],
      customFields: { Пакет: '@nexus-plugins/nats-webhook-bridge' },
    },
    {
      id: 'deal_acme_5',
      tenantId: 'tnt_acme',
      pipelineId: 'pip_acme_main',
      stageId: 'stg_tnt_acme_contact',
      title: 'СибирьЭнерго — Портал дилеров и RBAC',
      budget: 1120000,
      currency: 'RUB',
      contactId: 'cnt_2',
      companyId: 'cmp_2',
      ownerId: 'usr_dmitry',
      tags: ['Мультитенантность'],
      customFields: { Поддоменов: '14 филиалов' },
    },
    {
      id: 'deal_globex_1',
      tenantId: 'tnt_globex',
      pipelineId: 'pip_globex_main',
      stageId: 'stg_tnt_globex_negotiation',
      title: 'УралСталь — Поставка АСУ ТП и CRM-контура',
      budget: 4200000,
      currency: 'RUB',
      contactId: 'cnt_4',
      companyId: 'cmp_4',
      ownerId: 'usr_globex_admin',
      tags: ['Тендер 2026', 'Крупный заказ'],
      customFields: { Площадка: 'Екатеринбург' },
    },
  ]);

  const now = Date.now();
  await db.insert(tasks).values([
    {
      id: 'tsk_1',
      tenantId: 'tnt_acme',
      dealId: 'deal_acme_3',
      assigneeId: 'usr_elena',
      taskType: 'call',
      title: 'Согласовать SLA по NATS-интеграции с Ольгой Беловой',
      dueAt: new Date(now + 2 * 3600 * 1000),
      reminderAt: new Date(now + 90 * 60 * 1000),
      completed: false,
    },
    {
      id: 'tsk_2',
      tenantId: 'tnt_acme',
      dealId: 'deal_acme_4',
      assigneeId: 'usr_alexey',
      taskType: 'meeting',
      title: 'Демо-показ архитектуры Traefik поддоменов для совета директоров',
      dueAt: new Date(now + 24 * 3600 * 1000),
      completed: false,
    },
    {
      id: 'tsk_3',
      tenantId: 'tnt_acme',
      dealId: 'deal_acme_1',
      assigneeId: 'usr_dmitry',
      taskType: 'dify_ai',
      title: 'Запустить Dify AI квалификацию входящего брифа Балтик Ритейл',
      dueAt: new Date(now - 3 * 3600 * 1000),
      completed: false,
    },
  ]);

  await db.insert(timelineEvents).values([
    {
      id: 'tl_1',
      tenantId: 'tnt_acme',
      dealId: 'deal_acme_3',
      authorId: 'usr_elena',
      type: 'note',
      body: 'Клиент запросил выделенный поддомен technoprom.platform.local и демонстрацию RBAC-матрицы для 4 отделов.',
      metadata: {},
    },
    {
      id: 'tl_2',
      tenantId: 'tnt_acme',
      dealId: 'deal_acme_3',
      authorId: 'usr_alexey',
      type: 'dify_insight',
      body: 'DeepSeek-Harness оценка: высокая готовность к сделке (78%). Рекомендуется предложить пакет Enterprise с Verdaccio-плагинами.',
      metadata: { workflow: 'deal-qualification-v2', confidence: 0.78 },
    },
    {
      id: 'tl_3',
      tenantId: 'tnt_acme',
      dealId: 'deal_acme_2',
      authorId: 'usr_elena',
      type: 'stage_change',
      body: 'Сделка переведена на этап «Успешно реализовано». Контракт подписан через ЭДО.',
      metadata: { toStage: 'Успешно реализовано' },
    },
  ]);

  // 6. Seed Verdaccio Plugin Marketplace
  const seedPlugins = [
    {
      id: 'plg_dify_copilot',
      npmPackageName: '@nexus-plugins/dify-deal-copilot',
      version: '1.4.2',
      verdaccioUrl: 'http://localhost:4873/@nexus-plugins/dify-deal-copilot/-/dify-deal-copilot-1.4.2.tgz',
      tarballSha512: 'sha512-8a9f2d7c1b4e6f90d2a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
      name: 'Dify Deal Copilot',
      category: 'AI & Harness',
      author: 'DeepSeek-Harness Core Team',
      description: 'Добавляет виджет AI-анализа сделки, прогноза закрытия и генерации следующего шага прямо в карточку amoCRM.',
      slot: 'crm_deal_sidebar',
      permissionsRequired: ['deals:read', 'harness:execute'],
      defaultConfig: { autoScoreOnStageChange: true, difyAppMode: 'agent-chat', model: 'deepseek-harness-v3' },
      downloads: 1240,
    },
    {
      id: 'plg_nats_webhooks',
      npmPackageName: '@nexus-plugins/nats-webhook-bridge',
      version: '2.1.0',
      verdaccioUrl: 'http://localhost:4873/@nexus-plugins/nats-webhook-bridge/-/nats-webhook-bridge-2.1.0.tgz',
      tarballSha512: 'sha512-3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
      name: 'NATS JetStream Webhook Bridge',
      category: 'CRM Automation',
      author: 'Platform Infra',
      description: 'Транслирует все доменные события CRM (crm.deal.moved, crm.deal.created) в внешние микросервисы через NATS.',
      slot: 'crm_toolbar',
      permissionsRequired: ['deals:write'],
      defaultConfig: { streamName: 'NEXUS_CRM_EVENTS', subjectPrefix: 'crm.acme', retryCount: 3 },
      downloads: 890,
    },
    {
      id: 'plg_vk_polls',
      npmPackageName: '@nexus-plugins/vk-social-polls',
      version: '1.1.5',
      verdaccioUrl: 'http://localhost:4873/@nexus-plugins/vk-social-polls/-/vk-social-polls-1.1.5.tgz',
      tarballSha512: 'sha512-9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a',
      name: 'Социальные опросы для стены',
      category: 'Social Widgets',
      author: 'BuddyBoss UX Guild',
      description: 'Расширяет редактор стены профиля ВКонтакте/BuddyBoss возможностью прикреплять интерактивные командные опросы.',
      slot: 'social_composer',
      permissionsRequired: ['social:post'],
      defaultConfig: { allowAnonymousVotes: false, maxOptions: 6 },
      downloads: 612,
    },
    {
      id: 'plg_directus_sync',
      npmPackageName: '@nexus-plugins/directus-bi-connector',
      version: '1.0.8',
      verdaccioUrl: 'http://localhost:4873/@nexus-plugins/directus-bi-connector/-/directus-bi-connector-1.0.8.tgz',
      tarballSha512: 'sha512-4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f',
      name: 'Directus BI & Collection Sync',
      category: 'Integrations',
      author: 'Data Engineering',
      description: 'Двусторонняя синхронизация таблиц PostgreSQL и коллекций Directus с автоматическим аудитом Zod.',
      slot: 'portal_module',
      permissionsRequired: ['cms:edit'],
      defaultConfig: { syncIntervalSec: 60, exposeGraphQL: true },
      downloads: 475,
    },
    {
      id: 'plg_tinacms_playbooks',
      npmPackageName: '@nexus-plugins/tinacms-sales-playbooks',
      version: '1.3.0',
      verdaccioUrl: 'http://localhost:4873/@nexus-plugins/tinacms-sales-playbooks/-/tinacms-sales-playbooks-1.3.0.tgz',
      tarballSha512: 'sha512-7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
      name: 'TinaCMS Sales Playbooks',
      category: 'CRM Automation',
      author: 'Revenue Ops',
      description: 'Подключает визуальные сценарии продаж и регламенты из TinaCMS в панель контекстных подсказок сделки.',
      slot: 'crm_deal_sidebar',
      permissionsRequired: ['deals:read', 'cms:edit'],
      defaultConfig: { playbookCollection: 'sales_playbooks' },
      downloads: 530,
    },
  ];
  await db.insert(plugins).values(seedPlugins);

  await db.insert(tenantPlugins).values([
    {
      id: 'tp_acme_1',
      tenantId: 'tnt_acme',
      pluginId: 'plg_dify_copilot',
      enabled: true,
      config: { autoScoreOnStageChange: true, difyAppMode: 'agent-chat', model: 'deepseek-harness-v3' },
      installedBy: 'usr_alexey',
    },
    {
      id: 'tp_acme_2',
      tenantId: 'tnt_acme',
      pluginId: 'plg_vk_polls',
      enabled: true,
      config: { allowAnonymousVotes: false, maxOptions: 6 },
      installedBy: 'usr_alexey',
    },
  ]);

  // 7. Seed TinaCMS Content Blocks
  await db.insert(cmsBlocks).values([
    {
      id: 'cms_1',
      tenantId: 'tnt_acme',
      slug: 'q4-sales-playbook',
      title: 'Регламент закрытия Enterprise-сделок Q4',
      sectionType: 'playbook',
      body: 'На этапе «Принимают решение» обязательно прикрепляйте SLA-расчет и запускайте Dify-ассистента для проверки юридических рисков перед выставлением счета.',
      ctaLabel: 'Открыть воронку',
      published: true,
    },
    {
      id: 'cms_2',
      tenantId: 'tnt_acme',
      slug: 'verdaccio-plugin-guide',
      title: 'Публикация корпоративных плагинов в Verdaccio',
      sectionType: 'announcement',
      body: 'Все внутренние расширения публикуются под scope @nexus-plugins/* в локальный реестр Verdaccio и мгновенно доступны в Маркете тенанта с проверкой RBAC.',
      ctaLabel: 'Перейти в Маркет',
      published: true,
    },
  ]);

  // 8. Seed initial NATS JetStream Events
  await db.insert(natsEvents).values([
    {
      id: 'evt_1',
      tenantId: 'tnt_acme',
      subject: 'crm.acme.deal.won',
      actorId: 'usr_elena',
      payload: { dealId: 'deal_acme_2', budget: 2450000, currency: 'RUB' },
    },
    {
      id: 'evt_2',
      tenantId: 'tnt_acme',
      subject: 'marketplace.acme.plugin.enabled',
      actorId: 'usr_alexey',
      payload: { package: '@nexus-plugins/dify-deal-copilot', version: '1.4.2' },
    },
    {
      id: 'evt_3',
      tenantId: 'tnt_acme',
      subject: 'tenancy.traefik.routes.synced',
      actorId: 'usr_alexey',
      payload: { activeSubdomains: ['acme', 'globex', 'alpha'] },
    },
  ]);

  await ensureDefaultEmailTemplatesSeeded();
  await ensureDefaultOfficeSuiteSeeded();
  await ensureNocobaseSeeded();
  await ensureMattermostSeeded();
}

export async function ensureDefaultEmailTemplatesSeeded(): Promise<void> {
  const db = await getDb();
  const existingTemplates = await db.select({ id: emailTemplates.id }).from(emailTemplates).limit(1);
  if (existingTemplates.length > 0) return;

  const tenantRows = await db.select().from(tenants);
  if (tenantRows.length === 0) return;

  const presets = [
    {
      slug: 'welcome',
      name: 'Первичное знакомство и бриф',
      category: 'welcome',
      subject: 'Запуск проекта «{{dealTitle}}» — план первых шагов',
      body: `Здравствуйте, {{contactName}}!\n\nБлагодарю за обращение от компании {{companyName}}. Мы изучили ваш запрос по проекту «{{dealTitle}}» (предварительный бюджет: {{budget}}).\n\nПредлагаю провести короткий 20-минутный созвон для уточнения требований к архитектуре и доступам. Подскажите, какое время вам удобно?\n\nС уважением,\n{{ownerName}}`,
    },
    {
      slug: 'proposal',
      name: 'Коммерческое предложение (КП)',
      category: 'proposal',
      subject: 'КП по проекту «{{dealTitle}}» для {{companyName}}',
      body: `Добрый день, {{contactName}}!\n\nНаправляю детализированное коммерческое предложение по сделке «{{dealTitle}}» на сумму {{budget}}.\n\nВ стоимость включены: выделенный контур на поддомене, настройка матрицы ролей RBAC, интеграция с NATS и обучение команды.\n\nБуду рад ответить на вопросы по спецификации.\n\nС уважением,\n{{ownerName}}`,
    },
    {
      slug: 'demo',
      name: 'Приглашение на тех-демо',
      category: 'followup',
      subject: 'Приглашение на демонстрацию стенда для {{companyName}}',
      body: `Здравствуйте, {{contactName}}!\n\nПодготовили тестовый стенд для компании {{companyName}} по проекту «{{dealTitle}}». На демонстрации покажем воронку amoCRM, аналитику DeepSeek-Harness и каталог расширений.\n\nНапишите, пожалуйста, удобный слот на этой неделе — отправлю ссылку на встречу.\n\nС уважением,\n{{ownerName}}`,
    },
    {
      slug: 'contract',
      name: 'Согласование договора и SLA',
      category: 'contract',
      subject: 'Проект договора и SLA — {{dealTitle}}',
      body: `Добрый день, {{contactName}}!\n\nМы находимся на этапе «{{stageName}}» по сделке «{{dealTitle}}». Направляю финальную редакцию договора и приложения SLA для согласования с юридическим отделом {{companyName}}.\n\nКак только получим подтверждение, зафиксируем дату старта внедрения.\n\nС уважением,\n{{ownerName}}`,
    },
    {
      slug: 'reactivation',
      name: 'Мягкий follow-up по статусу',
      category: 'reactivation',
      subject: 'Актуализация статуса по проекту «{{dealTitle}}»',
      body: `Здравствуйте, {{contactName}}!\n\nВозвращаюсь к нашему обсуждению проекта «{{dealTitle}}» для {{companyName}}. Подскажите, пожалуйста, на каком этапе сейчас внутреннее согласование и нужна ли дополнительная информация с нашей стороны?\n\nС уважением,\n{{ownerName}}`,
    },
  ];

  const values = tenantRows.flatMap((tnt) =>
    presets.map((p) => ({
      id: `etpl_${tnt.subdomain}_${p.slug}`,
      tenantId: tnt.id,
      name: p.name,
      category: p.category,
      subject: p.subject,
      body: p.body,
      createdBy: 'system',
    }))
  );

  await db.insert(emailTemplates).values(values);
}

export async function ensureDefaultOfficeSuiteSeeded(): Promise<void> {
  const db = await getDb();
  const existingDocs = await db.select({ id: officeDocuments.id }).from(officeDocuments).limit(1);
  if (existingDocs.length > 0) return;

  const tenantRows = await db.select().from(tenants);
  if (tenantRows.length === 0) return;

  for (const tnt of tenantRows) {
    const docsBucketName = `nexus-${tnt.subdomain}-docs`;
    const lfsBucketName = `nexus-${tnt.subdomain}-forgejo-lfs`;

    await db.insert(garageBuckets).values([
      {
        id: `bkt_${tnt.subdomain}_docs`,
        tenantId: tnt.id,
        name: docsBucketName,
        region: 'garage-eu-1',
        visibility: 'private',
        quotaMb: 10240,
        endpoint: process.env.GARAGE_S3_ENDPOINT || 'http://s3.platform.local:3900',
      },
      {
        id: `bkt_${tnt.subdomain}_lfs`,
        tenantId: tnt.id,
        name: lfsBucketName,
        region: 'garage-eu-1',
        visibility: 'private',
        quotaMb: 20480,
        endpoint: process.env.GARAGE_S3_ENDPOINT || 'http://s3.platform.local:3900',
      },
    ]);

    const proposalsRepoId = `fj_${tnt.subdomain}_proposals`;
    const specsRepoId = `fj_${tnt.subdomain}_specs`;
    const baseUrl = (process.env.FORGEJO_BASE_URL || 'https://git.platform.local').replace(/\/$/, '');

    await db.insert(forgejoRepos).values([
      {
        id: proposalsRepoId,
        tenantId: tnt.id,
        ownerSlug: tnt.subdomain,
        name: 'crm-proposals',
        fullName: `${tnt.subdomain}/crm-proposals`,
        defaultBranch: 'main',
        cloneUrl: `${baseUrl}/${tnt.subdomain}/crm-proposals.git`,
        visibility: 'private',
        lfsBucket: lfsBucketName,
        description: 'Версионируемые КП, расчёты бюджета (.xlsx) и презентации сделок в Univer + Garage S3',
        starsCount: 4,
      },
      {
        id: specsRepoId,
        tenantId: tnt.id,
        ownerSlug: tnt.subdomain,
        name: 'platform-specs',
        fullName: `${tnt.subdomain}/platform-specs`,
        defaultBranch: 'main',
        cloneUrl: `${baseUrl}/${tnt.subdomain}/platform-specs.git`,
        visibility: 'internal',
        lfsBucket: lfsBucketName,
        description: 'Архитектурные спецификации, SLA и регламенты для внедрения тенанта',
        starsCount: 2,
      },
    ]);

    const tenantDeals = await db
      .select({ id: deals.id, title: deals.title })
      .from(deals)
      .where(eq(deals.tenantId, tnt.id))
      .limit(1);
    const primaryDealId = tenantDeals[0]?.id ?? null;

    const sheetContent = buildDefaultContentForKind(
      'xlsx',
      `Калькулятор бюджета и SLA — ${tnt.name}`
    );
    const docContent = buildDefaultContentForKind(
      'docx',
      `Коммерческое предложение и SLA — ${tnt.name}`
    );
    const slideContent = buildDefaultContentForKind(
      'pptx',
      `Презентация внедрения DeepSeek-Harness — ${tnt.name}`
    );

    const starterDocs = [
      {
        id: `odoc_${tnt.subdomain}_budget`,
        title: `Калькулятор бюджета и SLA (${tnt.subdomain})`,
        kind: 'xlsx' as const,
        dealId: primaryDealId,
        objectKey: `deals/budget-sla-${tnt.subdomain}.xlsx`,
        repoId: proposalsRepoId,
        commitSha: `fj${tnt.subdomain.slice(0, 3)}91a4c2`,
        content: sheetContent,
      },
      {
        id: `odoc_${tnt.subdomain}_kp`,
        title: `Коммерческое предложение Enterprise (${tnt.subdomain})`,
        kind: 'docx' as const,
        dealId: primaryDealId,
        objectKey: `proposals/kp-enterprise-${tnt.subdomain}.docx`,
        repoId: proposalsRepoId,
        commitSha: `fj${tnt.subdomain.slice(0, 3)}74b8e1`,
        content: docContent,
      },
      {
        id: `odoc_${tnt.subdomain}_deck`,
        title: `Архитектура Forgejo + Garage S3 + Univer (${tnt.subdomain})`,
        kind: 'pptx' as const,
        dealId: null,
        objectKey: `presentations/architecture-${tnt.subdomain}.pptx`,
        repoId: specsRepoId,
        commitSha: `fj${tnt.subdomain.slice(0, 3)}52d0f9`,
        content: slideContent,
      },
    ];

    for (const item of starterDocs) {
      const buffer = await encodeOfficeDocumentToBuffer(item.kind, item.title, item.content);
      await putGarageObject({
        tenantId: tnt.id,
        tenantSubdomain: tnt.subdomain,
        bucketName: docsBucketName,
        objectKey: item.objectKey,
        contentType: OFFICE_MIME_TYPES[item.kind],
        buffer,
        linkedEntityType: 'office_document',
        linkedEntityId: item.id,
        actorId: 'system',
      });

      await db.insert(officeDocuments).values({
        id: item.id,
        tenantId: tnt.id,
        title: item.title,
        kind: item.kind,
        dealId: item.dealId,
        bucketName: docsBucketName,
        objectKey: item.objectKey,
        forgejoRepoId: item.repoId,
        latestCommitSha: item.commitSha,
        sizeBytes: buffer.length,
        content: item.content as unknown as Record<string, unknown>,
        updatedBy: 'system',
      });

      await db.insert(forgejoCommits).values({
        id: `fjc_${item.id}`,
        tenantId: tnt.id,
        repoId: item.repoId,
        branch: 'main',
        commitSha: item.commitSha,
        message: `docs(${item.kind}): init ${item.title} in Univer + Garage S3`,
        authorName: 'NexusHarness Bot',
        authorEmail: `forgejo@${tnt.subdomain}.platform.local`,
        filesChanged: 1,
        s3ObjectKey: `${docsBucketName}/${item.objectKey}`,
      });
    }

    const sampleAssets = [
      {
        bucketName: docsBucketName,
        objectKey: `specs/sla-checklist-${tnt.subdomain}.md`,
        contentType: 'text/markdown; charset=utf-8',
        body: `# Регламент SLA и хранения файлов — ${tnt.name}\n\n- Поддомен: \`${tnt.subdomain}.${process.env.BASE_DOMAIN || 'platform.local'}\`\n- Основной бакет документов: \`${docsBucketName}\`\n- LFS-бакет Forgejo: \`${lfsBucketName}\`\n- Контроль целостности: SHA-256 ETag для каждого объекта\n`,
      },
      {
        bucketName: lfsBucketName,
        objectKey: `configs/garage-policy-${tnt.subdomain}.json`,
        contentType: 'application/json',
        body: JSON.stringify(
          {
            tenant: tnt.subdomain,
            s3Region: process.env.GARAGE_S3_REGION || 'garage-eu-1',
            buckets: [docsBucketName, lfsBucketName],
            isolation: 'strict-tenant-prefix',
            versioning: true,
          },
          null,
          2
        ),
      },
    ];

    for (const asset of sampleAssets) {
      await putGarageObject({
        tenantId: tnt.id,
        tenantSubdomain: tnt.subdomain,
        bucketName: asset.bucketName,
        objectKey: asset.objectKey,
        contentType: asset.contentType,
        buffer: Buffer.from(asset.body, 'utf8'),
        linkedEntityType: 'garage_file',
        linkedEntityId: null,
        actorId: 'system',
      });
    }
  }
}

export async function ensureNocobaseSeeded(): Promise<void> {
  const db = await getDb();

  // Backfill NocoBase RBAC permissions for system roles on existing databases
  const existingRoles = await db.select().from(roles);
  const existingPerms = await db.select().from(rolePermissions);
  const permSet = new Set(existingPerms.map((p) => `${p.roleId}:${p.permission}`));

  const roleExtras: Record<string, string[]> = {
    portal_superadmin: ['collections:read', 'collections:manage', 'workflows:read', 'workflows:manage'],
    sales_head: ['collections:read', 'collections:manage', 'workflows:read', 'workflows:manage'],
    sales_manager: ['collections:read', 'workflows:read'],
    viewer: ['collections:read', 'workflows:read'],
  };

  for (const r of existingRoles) {
    const extras = roleExtras[r.code];
    if (!extras) continue;
    for (const perm of extras) {
      if (!permSet.has(`${r.id}:${perm}`)) {
        await db.insert(rolePermissions).values({
          id: `rp_${r.id}_${perm}`,
          roleId: r.id,
          permission: perm,
        });
      }
    }
  }

  const existingCollections = await db.select({ id: nocobaseCollections.id }).from(nocobaseCollections).limit(1);
  if (existingCollections.length > 0) return;

  const allTenants = await db.select().from(tenants);
  for (const tnt of allTenants) {
    const tenantDeals = await db.select().from(deals).where(eq(deals.tenantId, tnt.id)).limit(2);
    const tenantContacts = await db.select().from(contacts).where(eq(contacts.tenantId, tnt.id)).limit(2);
    const tenantUsers = await db.select().from(users).where(eq(users.tenantId, tnt.id)).limit(2);
    const creatorId = tenantUsers[0]?.id || 'system';
    const dealA = tenantDeals[0];
    const dealB = tenantDeals[1] || tenantDeals[0];
    const contactA = tenantContacts[0];

    await db.insert(nocobaseCollections).values([
      {
        id: `nb_col_${tnt.subdomain}_contracts`,
        tenantId: tnt.id,
        key: 'contracts',
        title: 'Реестр договоров и SLA',
        description: 'No-Code коллекция договоров с расчётом НДС по формуле, связью со сделками и канбаном статусов',
        defaultView: 'table',
        kanbanGroupBy: 'status',
        calendarDateField: 'signed_at',
        pinnedToDashboard: true,
        fields: [
          { key: 'title', label: 'Название договора', type: 'string', required: true, visibleInTable: true },
          {
            key: 'status',
            label: 'Статус',
            type: 'select',
            required: true,
            visibleInTable: true,
            options: ['Черновик', 'На согласовании', 'Подписан', 'Исполнен'],
          },
          { key: 'deal_id', label: 'Связанная сделка', type: 'relation', required: false, visibleInTable: true, relationTarget: 'deals' },
          { key: 'amount', label: 'Сумма без НДС', type: 'currency', required: true, visibleInTable: true },
          {
            key: 'vat_amount',
            label: 'НДС 20% (формула)',
            type: 'formula',
            required: false,
            visibleInTable: true,
            formulaExpression: '{amount} * 0.2',
          },
          { key: 'signed_at', label: 'Дата подписания', type: 'date', required: false, visibleInTable: true },
          { key: 'auto_renewal', label: 'Автопролонгация', type: 'boolean', required: false, visibleInTable: true },
        ],
      },
      {
        id: `nb_col_${tnt.subdomain}_tickets`,
        tenantId: tnt.id,
        key: 'tickets',
        title: 'Сервисные заявки (Helpdesk)',
        description: 'Запросы клиентов на внедрение и поддержку с представлением Канбан и SLA-дедлайнами',
        defaultView: 'kanban',
        kanbanGroupBy: 'status',
        calendarDateField: 'sla_due_at',
        pinnedToDashboard: true,
        fields: [
          { key: 'subject', label: 'Тема обращения', type: 'string', required: true, visibleInTable: true },
          {
            key: 'status',
            label: 'Статус',
            type: 'select',
            required: true,
            visibleInTable: true,
            options: ['Новая', 'В работе', 'Ожидает клиента', 'Решена'],
          },
          {
            key: 'priority',
            label: 'Приоритет',
            type: 'select',
            required: true,
            visibleInTable: true,
            options: ['Низкий', 'Средний', 'Высокий', 'Критический'],
          },
          { key: 'contact_id', label: 'Контакт', type: 'relation', required: false, visibleInTable: true, relationTarget: 'contacts' },
          { key: 'sla_due_at', label: 'Срок SLA', type: 'date', required: false, visibleInTable: true },
          { key: 'notes', label: 'Комментарий инженера', type: 'text', required: false, visibleInTable: false },
        ],
      },
      {
        id: `nb_col_${tnt.subdomain}_partners`,
        tenantId: tnt.id,
        key: 'partners',
        title: 'Партнёрская сеть',
        description: 'Интеграторы и реселлеры с автоматическим расчётом партнёрского вознаграждения',
        defaultView: 'table',
        kanbanGroupBy: 'tier',
        calendarDateField: 'review_date',
        pinnedToDashboard: false,
        fields: [
          { key: 'partner_name', label: 'Партнёр', type: 'string', required: true, visibleInTable: true },
          {
            key: 'tier',
            label: 'Уровень',
            type: 'select',
            required: true,
            visibleInTable: true,
            options: ['Silver', 'Gold', 'Platinum'],
          },
          { key: 'revenue', label: 'Приведённая выручка', type: 'currency', required: true, visibleInTable: true },
          { key: 'commission_pct', label: 'Ставка %', type: 'number', required: true, visibleInTable: true },
          {
            key: 'payout',
            label: 'Комиссия ₽ (формула)',
            type: 'formula',
            required: false,
            visibleInTable: true,
            formulaExpression: '{revenue} * {commission_pct} / 100',
          },
          { key: 'review_date', label: 'Дата ревью', type: 'date', required: false, visibleInTable: true },
        ],
      },
    ]);

    const today = new Date();
    const fmtDate = (offsetDays: number) => {
      const d = new Date(today.getTime() + offsetDays * 86400_000);
      return d.toISOString().slice(0, 10);
    };

    await db.insert(nocobaseRecords).values([
      {
        id: `nb_rec_${tnt.subdomain}_c1`,
        tenantId: tnt.id,
        collectionKey: 'contracts',
        createdBy: creatorId,
        data: {
          title: `Рамочный договор №2026-01 (${tnt.name})`,
          status: 'На согласовании',
          deal_id: dealA?.id || '',
          amount: 1450000,
          vat_amount: 290000,
          signed_at: fmtDate(2),
          auto_renewal: true,
        },
      },
      {
        id: `nb_rec_${tnt.subdomain}_c2`,
        tenantId: tnt.id,
        collectionKey: 'contracts',
        createdBy: creatorId,
        data: {
          title: 'SLA-соглашение 99.95% на выделенный кластер',
          status: 'Подписан',
          deal_id: dealB?.id || '',
          amount: 680000,
          vat_amount: 136000,
          signed_at: fmtDate(-5),
          auto_renewal: true,
        },
      },
      {
        id: `nb_rec_${tnt.subdomain}_t1`,
        tenantId: tnt.id,
        collectionKey: 'tickets',
        createdBy: creatorId,
        data: {
          subject: 'Настройка SSO SAML и Traefik поддомена для клиента',
          status: 'В работе',
          priority: 'Высокий',
          contact_id: contactA?.id || '',
          sla_due_at: fmtDate(1),
          notes: 'Сертификат загружен в Garage S3, ожидается тест входа.',
        },
      },
      {
        id: `nb_rec_${tnt.subdomain}_t2`,
        tenantId: tnt.id,
        collectionKey: 'tickets',
        createdBy: creatorId,
        data: {
          subject: 'Миграция исторических сделок из CSV в Univer',
          status: 'Новая',
          priority: 'Средний',
          contact_id: contactA?.id || '',
          sla_due_at: fmtDate(4),
          notes: 'Требуется маппинг пользовательских полей.',
        },
      },
      {
        id: `nb_rec_${tnt.subdomain}_p1`,
        tenantId: tnt.id,
        collectionKey: 'partners',
        createdBy: creatorId,
        data: {
          partner_name: 'Цифровые Решения Северо-Запад',
          tier: 'Platinum',
          revenue: 3200000,
          commission_pct: 15,
          payout: 480000,
          review_date: fmtDate(10),
        },
      },
    ]);

    const seededWorkflowSpecs: Array<{
      id: string;
      name: string;
      description: string;
      triggerType: WorkflowTriggerType;
      triggerConfig: Record<string, string>;
      condition: WorkflowCondition | null;
      enabled: boolean;
      runsCount: number;
      lastRunAt: Date | null;
      nodes: WorkflowNodeDef[];
    }> = [
      {
        id: `nb_wf_${tnt.subdomain}_high_deal`,
        name: 'Согласование и аудит крупных сделок (≥ 1 000 000 ₽)',
        description: 'Автоматически создаёт запрос на согласование РОП, ставит задачу юристу и публикует событие в NATS',
        triggerType: 'deal.created',
        triggerConfig: {},
        condition: { field: 'budget', operator: 'gte' as const, value: '1000000' },
        enabled: true,
        runsCount: 1,
        lastRunAt: new Date(),
        nodes: [
          {
            id: 'node_approval',
            type: 'create_approval' as const,
            title: 'Запросить согласование РОП по бюджету',
            config: { approverRoleCode: 'sales_head', comment: 'Сделка превышает порог 1 000 000 ₽' },
          },
          {
            id: 'node_task',
            type: 'create_task' as const,
            title: 'Назначить проверку договора и SLA',
            config: { taskTitle: 'Подготовить драфт договора и согласовать SLA: {{title}}', taskType: 'followup', dueHours: '24' },
          },
          {
            id: 'node_nats',
            type: 'nats_publish' as const,
            title: 'Уведомить контур NATS JetStream',
            config: { subject: `workflows.${tnt.subdomain}.deal_approval_queued` },
          },
        ],
      },
      {
        id: `nb_wf_${tnt.subdomain}_won_onboarding`,
        name: 'Онбординг клиента при победе в сделке',
        description: 'При переходе сделки на этап победы фиксирует запись в таймлайне, ставит задачу внедрения и запускает Harness AI',
        triggerType: 'deal.stage_changed' as const,
        triggerConfig: {} as Record<string, string>,
        condition: { field: 'stageIsWon', operator: 'eq' as const, value: 'true' },
        enabled: true,
        runsCount: 0,
        lastRunAt: null,
        nodes: [
          {
            id: 'node_note',
            type: 'timeline_note' as const,
            title: 'Зафиксировать передачу в отдел внедрения',
            config: { body: 'n8n Workflow: сделка выиграна, запущен стандартный чек-лист онбординга.' },
          },
          {
            id: 'node_task',
            type: 'create_task' as const,
            title: 'Создать стартовую задачу онбординга',
            config: { taskTitle: 'Провести kick-off встречу по сделке: {{title}}', taskType: 'meeting', dueHours: '48' },
          },
          {
            id: 'node_harness',
            type: 'harness_analyze' as const,
            title: 'Обновить AI-резюме DeepSeek-Harness',
            config: {},
          },
        ],
      },
      {
        id: `nb_wf_${tnt.subdomain}_ticket_sla`,
        name: 'SLA-контроль новой сервисной заявки',
        description: 'При создании записи в коллекции tickets автоматически ставит задачу контроля SLA',
        triggerType: 'record.created' as const,
        triggerConfig: { collectionKey: 'tickets' },
        condition: null,
        enabled: true,
        runsCount: 1,
        lastRunAt: new Date(),
        nodes: [
          {
            id: 'node_task',
            type: 'create_task' as const,
            title: 'Взять сервисную заявку в работу по SLA',
            config: { taskTitle: 'Обработать заявку Helpdesk: {{subject}}', taskType: 'call', dueHours: '4' },
          },
          {
            id: 'node_nats',
            type: 'nats_publish' as const,
            title: 'Опубликовать уведомление NATS',
            config: { subject: `workflows.${tnt.subdomain}.ticket_sla_assigned` },
          },
        ],
      },
    ];

    await db.insert(nocobaseWorkflows).values(
      seededWorkflowSpecs.map((spec) => ({
        id: spec.id,
        tenantId: tnt.id,
        name: spec.name,
        description: spec.description,
        triggerType: spec.triggerType,
        triggerConfig: spec.triggerConfig,
        condition: spec.condition,
        nodes: spec.nodes,
        n8nDefinition: buildN8nFromLegacyWorkflow(spec) as unknown as Record<string, unknown>,
        enabled: spec.enabled,
        runsCount: spec.runsCount,
        lastRunAt: spec.lastRunAt,
      }))
    );

    await db.insert(nocobaseWorkflowExecutions).values([
      {
        id: `nb_exec_${tnt.subdomain}_1`,
        tenantId: tnt.id,
        workflowId: `nb_wf_${tnt.subdomain}_high_deal`,
        workflowName: 'Согласование и аудит крупных сделок (≥ 1 000 000 ₽)',
        triggerType: 'deal.created',
        status: 'completed',
        contextSummary: dealA ? `Сделка: ${dealA.title} (${dealA.budget.toLocaleString('ru-RU')} ₽)` : 'Инициализация контура',
        durationMs: 14,
        stepsLog: [
          { nodeTitle: 'Запросить согласование РОП по бюджету', status: 'ok', detail: 'Создан запрос согласования' },
          { nodeTitle: 'Назначить проверку договора и SLA', status: 'ok', detail: 'Задача добавлена в очередь CRM' },
          { nodeTitle: 'Уведомить контур NATS JetStream', status: 'ok', detail: `workflows.${tnt.subdomain}.deal_approval_queued` },
        ],
      },
    ]);

    await db.insert(nocobaseApprovals).values([
      {
        id: `nb_apr_${tnt.subdomain}_1`,
        tenantId: tnt.id,
        title: dealA ? `Согласование спецусловий и SLA: ${dealA.title}` : 'Согласование крупного контракта',
        entityType: dealA ? 'deal' : 'general',
        entityId: dealA?.id || null,
        entityLabel: dealA?.title || 'Enterprise контракт',
        amount: dealA?.budget || 1450000,
        requesterId: creatorId,
        approverRoleCode: 'sales_head',
        status: 'pending',
        comment: 'Клиент просит фиксацию стоимости на 12 месяцев и приоритетное SLA 99.95%.',
      },
      {
        id: `nb_apr_${tnt.subdomain}_2`,
        tenantId: tnt.id,
        title: 'Утверждение рамочного договора с партнёром Platinum',
        entityType: 'collection_record',
        entityId: `nb_rec_${tnt.subdomain}_p1`,
        entityLabel: 'Цифровые Решения Северо-Запад',
        amount: 480000,
        requesterId: creatorId,
        approverRoleCode: 'portal_superadmin',
        status: 'approved',
        comment: 'Увеличенная комиссия 15% за приведение enterprise-заказчика.',
        decisionNote: 'Одобрено, маржинальность сделки подтверждена.',
        decidedBy: creatorId,
        decidedAt: new Date(),
      },
    ]);
  }
}

export async function ensureMattermostSeeded(): Promise<void> {
  const db = await getDb();
  const allTenants = await db.select().from(tenants);

  for (const tnt of allTenants) {
    await ensureTenantMattermostSetup(tnt.id, tnt.subdomain, tnt.name);
    const tenantUsers = await db.select().from(users).where(eq(users.tenantId, tnt.id));
    if (tenantUsers.length === 0) continue;

    const existingTown = await db
      .select({ id: mmPosts.id })
      .from(mmPosts)
      .where(eq(mmPosts.id, `mmp_seed_${tnt.subdomain}_1`));
    if (existingTown.length > 0) continue;

    const u1 = tenantUsers[0].id;
    const u2 = tenantUsers[1]?.id || u1;
    const u3 = tenantUsers[2]?.id || u1;
    const townChannelId = `mmc_${tnt.subdomain}_town_square`;
    const dealsChannelId = `mmc_${tnt.subdomain}_deals_room`;
    const opsChannelId = `mmc_${tnt.subdomain}_workflows_ops`;

    const baseMs = Date.now() - 1000 * 60 * 90;
    const msg1Id = `mmp_seed_${tnt.subdomain}_1`;
    const msg2Id = `mmp_seed_${tnt.subdomain}_2`;
    const msg3Id = `mmp_seed_${tnt.subdomain}_3`;
    const msg4Id = `mmp_seed_${tnt.subdomain}_4`;

    await db.insert(mmPosts).values([
      {
        id: msg1Id,
        tenantId: tnt.id,
        channelId: townChannelId,
        userId: u1,
        rootId: '',
        originalId: '',
        message:
          'Коллеги, добро пожаловать в встроенный корпоративный чат на архитектуре Mattermost! Новостная лента социальной сети теперь синхронизирована в закреплённом канале #новостная-лента.',
        type: '',
        props: {},
        hashtags: '#mattermost #новостная-лента',
        isPinned: true,
        replyCount: 1,
        socialPostId: null,
        createAt: String(baseMs),
        updateAt: String(baseMs),
        editAt: '0',
        deleteAt: '0',
      },
      {
        id: msg2Id,
        tenantId: tnt.id,
        channelId: townChannelId,
        userId: u2,
        rootId: msg1Id,
        originalId: '',
        message:
          'Отлично! Теперь посты со сделками amoCRM, опросами и комментариями приходят в общий чат и в тред в реальном времени по WebSocket v4.',
        type: '',
        props: {},
        hashtags: '#amoCRM',
        isPinned: false,
        replyCount: 0,
        socialPostId: null,
        createAt: String(baseMs + 120000),
        updateAt: String(baseMs + 120000),
        editAt: '0',
        deleteAt: '0',
      },
      {
        id: msg3Id,
        tenantId: tnt.id,
        channelId: dealsChannelId,
        userId: u2,
        rootId: '',
        originalId: '',
        message:
          'Проверил пресейл-сделки на этой неделе: скоринг DeepSeek-Harness повысил приоритет Enterprise-контракта. Нужна быстрая ревизия КП в Univer перед отправкой клиенту.',
        type: '',
        props: {},
        hashtags: '#deals #presale',
        isPinned: false,
        replyCount: 0,
        socialPostId: null,
        createAt: String(baseMs + 240000),
        updateAt: String(baseMs + 240000),
        editAt: '0',
        deleteAt: '0',
      },
      {
        id: msg4Id,
        tenantId: tnt.id,
        channelId: opsChannelId,
        userId: u3,
        rootId: '',
        originalId: '',
        message:
          'Контур n8n + NATS JetStream активен: все согласования по крупным бюджетам логируются и транслируются сюда автоматически.',
        type: '',
        props: {},
        hashtags: '#n8n #nats',
        isPinned: false,
        replyCount: 0,
        socialPostId: null,
        createAt: String(baseMs + 360000),
        updateAt: String(baseMs + 360000),
        editAt: '0',
        deleteAt: '0',
      },
    ]);

    await db.insert(mmReactions).values([
      {
        id: `mmr_seed_${tnt.subdomain}_1`,
        tenantId: tnt.id,
        userId: u2,
        postId: msg1Id,
        emojiName: 'rocket',
        createAt: String(baseMs + 60000),
      },
      {
        id: `mmr_seed_${tnt.subdomain}_2`,
        tenantId: tnt.id,
        userId: u3,
        postId: msg1Id,
        emojiName: 'thumbsup',
        createAt: String(baseMs + 90000),
      },
    ]);

    await db
      .update(mmChannels)
      .set({ totalMsgCount: 2, totalMsgCountRoot: 1, lastPostAt: String(baseMs + 120000) })
      .where(eq(mmChannels.id, townChannelId));
    await db
      .update(mmChannels)
      .set({ totalMsgCount: 1, totalMsgCountRoot: 1, lastPostAt: String(baseMs + 240000) })
      .where(eq(mmChannels.id, dealsChannelId));
    await db
      .update(mmChannels)
      .set({ totalMsgCount: 1, totalMsgCountRoot: 1, lastPostAt: String(baseMs + 360000) })
      .where(eq(mmChannels.id, opsChannelId));
  }
}




