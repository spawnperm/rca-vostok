import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  BUILT_IN_ACADEMIC_WORKS,
  MAX_ACADEMIC_PDF_BYTES,
  MAX_PDF_ZOOM,
  MIN_PDF_ZOOM,
  clampPdfPage,
  createUploadedAcademicWorkMeta,
  formatPdfFileSize,
  rotatePdfQuarterTurn,
  stepPdfZoom,
  validateAcademicPdfFile,
} from '../src/utils/dissertationPdfLibrary.ts';

describe('dissertationPdfLibrary helpers and catalog', () => {
  it('provides built-in academic works covering dissertation, abstract, and VAK articles', () => {
    assert.ok(BUILT_IN_ACADEMIC_WORKS.length >= 4);
    const categories = new Set(BUILT_IN_ACADEMIC_WORKS.map((w) => w.category));
    assert.ok(categories.has('Диссертация'));
    assert.ok(categories.has('Автореферат'));
    assert.ok(categories.has('Статья ВАК'));

    for (const work of BUILT_IN_ACADEMIC_WORKS) {
      assert.ok(work.title.length > 5);
      assert.ok(work.fileName.endsWith('.pdf'));
      assert.ok(work.sections && work.sections.length > 0);
    }
  });

  it('validates uploaded PDF files by extension, MIME type, non-empty bytes, and 50 MB cap', () => {
    assert.deepEqual(
      validateAcademicPdfFile({ name: 'dissertation_draft.pdf', type: 'application/pdf', size: 2048 }),
      { valid: true }
    );

    const nonPdf = validateAcademicPdfFile({
      name: 'notes.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 2048,
    });
    assert.equal(nonPdf.valid, false);

    const empty = validateAcademicPdfFile({
      name: 'empty.pdf',
      type: 'application/pdf',
      size: 0,
    });
    assert.equal(empty.valid, false);

    const oversized = validateAcademicPdfFile({
      name: 'huge.pdf',
      type: 'application/pdf',
      size: MAX_ACADEMIC_PDF_BYTES + 1,
    });
    assert.equal(oversized.valid, false);
  });

  it('formats sizes, clamps pages, steps zoom, and rotates quarter turns cleanly', () => {
    assert.equal(formatPdfFileSize(512), '512 Б');
    assert.equal(formatPdfFileSize(15 * 1024), '15 КБ');
    assert.equal(formatPdfFileSize(2.5 * 1024 * 1024), '2,5 МБ');

    assert.equal(clampPdfPage(0, 12), 1);
    assert.equal(clampPdfPage(15, 12), 12);
    assert.equal(clampPdfPage(4, 12), 4);
    assert.equal(clampPdfPage(Number.NaN, 5), 1);

    assert.equal(stepPdfZoom(MIN_PDF_ZOOM, -0.5), MIN_PDF_ZOOM);
    assert.equal(stepPdfZoom(MAX_PDF_ZOOM, 0.5), MAX_PDF_ZOOM);
    assert.equal(stepPdfZoom(1, 0.15), 1.15);

    assert.equal(rotatePdfQuarterTurn(0), 90);
    assert.equal(rotatePdfQuarterTurn(90), 180);
    assert.equal(rotatePdfQuarterTurn(180), 270);
    assert.equal(rotatePdfQuarterTurn(270), 0);
  });

  it('builds uploaded academic work metadata cleanly from file input', () => {
    const sampleBytes = new Uint8Array([37, 80, 68, 70]);
    const meta = createUploadedAcademicWorkMeta(
      { name: 'Statya_Turizm_DFO_2026.pdf', size: 145 * 1024 },
      sampleBytes,
      '2026-11-23'
    );

    assert.equal(meta.source, 'uploaded');
    assert.equal(meta.category, 'Загруженный PDF');
    assert.equal(meta.title, 'Statya Turizm DFO 2026');
    assert.equal(meta.year, '2026');
    assert.equal(meta.sizeLabel, '145 КБ');
    assert.equal(meta.bytes?.length, 4);
  });
});
