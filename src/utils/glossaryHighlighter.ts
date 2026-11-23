import { GLOSSARY_TERMS, type GlossaryTerm } from '../data/researchData.ts';

export interface GlossarySegmentText {
  type: 'text';
  text: string;
}

export interface GlossarySegmentTerm {
  type: 'term';
  text: string;
  term: GlossaryTerm;
}

export type GlossarySegment = GlossarySegmentText | GlossarySegmentTerm;

interface TermPatternEntry {
  termId: string;
  regex: RegExp;
}

/**
 * Morphological patterns for Russian & English regulatory terms used in
 * RCA "Русский Восток" texts so inflected forms (e.g. "аттестацию",
 * "инструктора-проводника", "паспорта маршрута") match safely without
 * altering the displayed prose.
 */
const TERM_PATTERN_DEFS: { termId: string; pattern: string }[] = [
  {
    termId: 'term-pp-1003-1893',
    pattern:
      '(?:ПП\\s+РФ\\s+№\\s*1003(?:\\s*\\([^)]*1893[^)]*\\))?|Постановлени[еяюи]\\s+Правительства\\s+РФ\\s+№\\s*1003(?:\\s*\\([^)]*1893[^)]*\\))?|ПП\\s+№\\s*1893|ПП\\s+№\\s*1003)',
  },
  {
    termId: 'term-pp-760',
    pattern:
      '(?:Постановлени[еяюи]\\s+Правительства\\s+РФ\\s+№\\s*760|ПП\\s+(?:РФ\\s+)?№\\s*760)',
  },
  {
    termId: 'term-fz-132',
    pattern:
      '(?:ФЗ\\s+№\\s*132-ФЗ|Федеральн(?:ый|ого|ому|ым)\\s+закон(?:а|у|ом)?\\s+(?:от\\s+24\\.11\\.1996\\s+)?№\\s*132-ФЗ|132-ФЗ)',
  },
  {
    termId: 'term-federal-registry',
    pattern:
      '(?:Един(?:ый|ого|ом|ому)\\s+федеральн(?:ый|ого|ом|ому)\\s+реестр(?:а|у|е|ом)?|федеральн(?:ый|ого|ом|ому)\\s+реестр(?:а|у|е|ом)?)',
  },
  {
    termId: 'term-two-contour',
    pattern:
      '(?:двухконтурн(?:ая|ой|ую|ые)\\s+модел[ьию]|Контур(?:а|у|е|ом)?\\s+[АБ])',
  },
  {
    termId: 'term-dpo-250',
    pattern:
      '(?:программ(?:а|ы|у|е|ой)?\\s+ДПО(?:\\s+ВВГУ)?(?:\\s*\\([^)]*250[^)]*\\))?|ДПО\\s+ВВГУ|ДПО)',
  },
  {
    termId: 'term-instructor-guide',
    pattern:
      'инструктор(?:а|у|ом|е|ы|ов|ам|ами|ах)?-проводник(?:а|у|ом|е|и|ов|ам|ами|ах)?',
  },
  {
    termId: 'term-difficulty-category',
    pattern:
      'категори(?:я|и|ю|ей|ям|ями|ях)\\s+сложности',
  },
  {
    termId: 'term-route-passport',
    pattern:
      'паспорт(?:а|у|ом|е|ы|ов)?\\s+маршрут(?:а|у|ом|е|ов)?',
  },
  {
    termId: 'term-unlegalized-reserve',
    pattern:
      '(?:нелегализованн(?:ый|ого|ому|ым|ом)\\s+резерв(?:а|у|ом|е)?|тенев(?:ой|ого|ому|ым|ом)\\s+резерв(?:а|у|ом|е)?)',
  },
  {
    termId: 'term-wilderness-first-aid',
    pattern: '(?:Wilderness\\s+First\\s+Aid|WFA)',
  },
  {
    termId: 'term-oopt',
    pattern: '(?:режим(?:а|у|е|ом)?\\s+ООПТ|ООПТ)',
  },
  {
    termId: 'term-mkk',
    pattern:
      '(?:Маршрутно-квалификационн(?:ая|ой|ую)\\s+комисси(?:я|и|ю|ей)(?:\\s*\\(МКК\\))?|МКК)',
  },
  {
    termId: 'term-rca',
    pattern:
      '(?:Региональн(?:ый|ого|ому|ым|ом)\\s+центр(?:а|у|ом|е)?\\s+аттестации(?:\\s*\\(РЦА\\))?|РЦА\\s+«Русский\\s+Восток»|РЦА)',
  },
  {
    termId: 'term-attestation',
    pattern: '(?:государственн(?:ая|ой|ую)\\s+)?аттестаци(?:я|и|ю|ей)',
  },
];

const COMPILED_PATTERNS: TermPatternEntry[] = TERM_PATTERN_DEFS.map((def) => ({
  termId: def.termId,
  regex: new RegExp(def.pattern, 'gi'),
}));

const WORD_CHAR_RE = /[\p{L}\p{N}]/u;

function isUnicodeBoundary(text: string, start: number, end: number): boolean {
  const prevChar = start > 0 ? text[start - 1] : '';
  const nextChar = end < text.length ? text[end] : '';
  const leftOk = !prevChar || !WORD_CHAR_RE.test(prevChar);
  const rightOk = !nextChar || !WORD_CHAR_RE.test(nextChar);
  return leftOk && rightOk;
}

export interface TokenizeGlossaryOptions {
  maxMatchesPerTerm?: number;
  termIds?: readonly string[];
}

/**
 * Splits arbitrary text into plain text segments and matched interactive glossary
 * term segments without overlaps, preferring longer and earlier matches.
 */
export function tokenizeTextWithGlossary(
  text: string,
  terms: readonly GlossaryTerm[] = GLOSSARY_TERMS,
  options: TokenizeGlossaryOptions = {}
): GlossarySegment[] {
  if (!text) {
    return [];
  }

  const termById = new Map<string, GlossaryTerm>(terms.map((t) => [t.id, t]));
  const allowedIds = options.termIds ? new Set(options.termIds) : null;
  const maxPerTerm =
    typeof options.maxMatchesPerTerm === 'number' && options.maxMatchesPerTerm > 0
      ? options.maxMatchesPerTerm
      : Infinity;

  interface CandidateMatch {
    start: number;
    end: number;
    term: GlossaryTerm;
    matchedText: string;
  }

  const candidates: CandidateMatch[] = [];

  for (const entry of COMPILED_PATTERNS) {
    if (allowedIds && !allowedIds.has(entry.termId)) continue;
    const termObj = termById.get(entry.termId);
    if (!termObj) continue;

    const re = new RegExp(entry.regex.source, 'gi');
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (match[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      if (isUnicodeBoundary(text, start, end)) {
        candidates.push({
          start,
          end,
          term: termObj,
          matchedText: match[0],
        });
      }
    }
  }

  if (candidates.length === 0) {
    return [{ type: 'text', text }];
  }

  // Sort by earliest start position, then longest match first so compound phrases
  // like "государственную аттестацию" or "Региональный центр аттестации (РЦА)"
  // take precedence over shorter substrings.
  candidates.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });

  const accepted: CandidateMatch[] = [];
  const countsByTerm = new Map<string, number>();
  let cursor = 0;

  for (const cand of candidates) {
    if (cand.start < cursor) {
      continue;
    }
    const used = countsByTerm.get(cand.term.id) ?? 0;
    if (used >= maxPerTerm) {
      continue;
    }
    accepted.push(cand);
    countsByTerm.set(cand.term.id, used + 1);
    cursor = cand.end;
  }

  if (accepted.length === 0) {
    return [{ type: 'text', text }];
  }

  const segments: GlossarySegment[] = [];
  let textPos = 0;

  for (const item of accepted) {
    if (item.start > textPos) {
      segments.push({
        type: 'text',
        text: text.slice(textPos, item.start),
      });
    }
    segments.push({
      type: 'term',
      text: item.matchedText,
      term: item.term,
    });
    textPos = item.end;
  }

  if (textPos < text.length) {
    segments.push({
      type: 'text',
      text: text.slice(textPos),
    });
  }

  return segments;
}
