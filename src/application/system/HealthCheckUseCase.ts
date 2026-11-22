import type { AnalyticsRepository } from '../../domain/analytics/AnalyticsRepository.ts';
import type { InquiryRepository } from '../../domain/certification/InquiryRepository.ts';

export interface SystemHealthDTO {
  status: 'healthy';
  timestamp: string;
  architecture: {
    methodology: 'DDD + 11 Engineering Contours';
    boundedContexts: string[];
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

  constructor(inquiryRepo: InquiryRepository, analyticsRepo: AnalyticsRepository) {
    this.inquiryRepo = inquiryRepo;
    this.analyticsRepo = analyticsRepo;
  }

  execute(): SystemHealthDTO {
    const store = this.analyticsRepo.loadStore();
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      architecture: {
        methodology: 'DDD + 11 Engineering Contours',
        boundedContexts: ['certification', 'analytics', 'research'],
      },
      metrics: {
        inquiriesCount: this.inquiryRepo.count(),
        sessionsCount: Object.keys(store.sessions).length,
        eventsCount: store.events.length,
      },
    };
  }
}
