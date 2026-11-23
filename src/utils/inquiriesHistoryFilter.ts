import type { InquiryRecord } from '../components/social/MyInquiriesSection.tsx';

export type InquiryStatusFilterKey = 'all' | InquiryRecord['status'];
export type InquiryYearFilterKey = 'all' | number;
export type InquirySortOrder = 'newest' | 'oldest';

export function getInquirySubmissionYear(
  inquiry: Pick<InquiryRecord, 'createdAt'>
): number | null {
  if (!inquiry.createdAt) return null;
  const isoMatch = /^(\d{4})-/.exec(inquiry.createdAt.trim());
  if (isoMatch) {
    const parsedYear = Number(isoMatch[1]);
    return Number.isInteger(parsedYear) ? parsedYear : null;
  }
  const parsed = new Date(inquiry.createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCFullYear();
}

export function getAvailableInquiryYears(
  inquiries: ReadonlyArray<Pick<InquiryRecord, 'createdAt'>>
): number[] {
  const years = new Set<number>();
  for (const inquiry of inquiries) {
    const year = getInquirySubmissionYear(inquiry);
    if (year !== null) {
      years.add(year);
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function computeInquiryYearCounts(
  inquiries: ReadonlyArray<Pick<InquiryRecord, 'createdAt'>>
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const inquiry of inquiries) {
    const year = getInquirySubmissionYear(inquiry);
    if (year !== null) {
      counts.set(year, (counts.get(year) ?? 0) + 1);
    }
  }
  return counts;
}

export function computeInquiryStatusCounts(
  inquiries: ReadonlyArray<Pick<InquiryRecord, 'createdAt' | 'status'>>,
  yearFilter: InquiryYearFilterKey = 'all'
): Record<InquiryStatusFilterKey, number> {
  const counts: Record<InquiryStatusFilterKey, number> = {
    all: 0,
    new: 0,
    in_review: 0,
    needs_documents: 0,
    approved: 0,
    rejected: 0,
  };

  for (const inquiry of inquiries) {
    if (yearFilter !== 'all') {
      const year = getInquirySubmissionYear(inquiry);
      if (year !== yearFilter) continue;
    }
    counts.all += 1;
    if (inquiry.status in counts) {
      counts[inquiry.status] += 1;
    }
  }

  return counts;
}

export function filterAndSortInquiriesHistory<T extends InquiryRecord>(
  inquiries: ReadonlyArray<T>,
  options: {
    year?: InquiryYearFilterKey;
    status?: InquiryStatusFilterKey;
    sortOrder?: InquirySortOrder;
  } = {}
): T[] {
  const { year = 'all', status = 'all', sortOrder = 'newest' } = options;

  const filtered = inquiries.filter((inquiry) => {
    if (year !== 'all' && getInquirySubmissionYear(inquiry) !== year) {
      return false;
    }
    if (status !== 'all' && inquiry.status !== status) {
      return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    const timeA = Date.parse(a.createdAt) || 0;
    const timeB = Date.parse(b.createdAt) || 0;
    return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
  });
}
