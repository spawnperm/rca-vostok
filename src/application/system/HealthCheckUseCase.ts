import type { AnalyticsRepository } from '../../domain/analytics/AnalyticsRepository.ts';
import type { InquiryRepository } from '../../domain/certification/InquiryRepository.ts';

export interface SystemHealthDTO {
  status: 'healthy';
  timestamp: string;
  architecture: {
    methodology: 'DDD + 11 Engineering Contours';
    boundedContexts: string[];
  };
  persistence: {
    adapter: string;
  };
  metrics: {
    inquiriesCount: number;
    sessionsCount: number;
    eventsCount: number;
  };
}

export class GetSystemHealthUseCase {
  private readonly inquiryRepo: InquiryRepository;
  private readonly analyticsRepo: AnalyticsRepository;
  private readonly adapterName: string;

  constructor(
    inquiryRepo: InquiryRepository,
    analyticsRepo: AnalyticsRepository,
    adapterName = 'unknown'
  ) {
    this.inquiryRepo = inquiryRepo;
    this.analyticsRepo = analyticsRepo;
    this.adapterName = adapterName;
  }

  async execute(): Promise<SystemHealthDTO> {
    const store = await this.analyticsRepo.loadStore();
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      architecture: {
        methodology: 'DDD + 11 Engineering Contours',
        boundedContexts: ['certification', 'analytics', 'research'],
      },
      persistence: {
        adapter: this.adapterName,
      },
      metrics: {
        inquiriesCount: await this.inquiryRepo.count(),
        sessionsCount: Object.keys(store.sessions).length,
        eventsCount: store.events.length,
      },
    };
  }
}
