import JSZip from 'jszip';
import {
  colIndexToLetter,
  evaluateSheetCell,
  type OfficeDocKind,
  type UniverContent,
} from '../../domain/office/entities.ts';

export const OFFICE_MIME_TYPES: Record<OfficeDocKind, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

export async function encodeOfficeDocumentToBuffer(
  kind: OfficeDocKind,
  title: string,
  content: UniverContent
): Promise<Buffer> {
  const zip = new JSZip();

  if (kind === 'xlsx' && content.type === 'xlsx') {
    const sheets = content.sheets;
    const sheetOverrides = sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join('');

    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`
    );

    zip.file(
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    );

    const sheetEntries = sheets
      .map(
        (sh, i) =>
          `<sheet name="${escapeXml(sh.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
      )
      .join('');

    zip.file(
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetEntries}</sheets>
</workbook>`
    );

    const wbRels = sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join('');

    zip.file(
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${wbRels}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    );

    zip.file(
      'xl/styles.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellXfs count="2">
    <xf fontId="0" fillId="0" borderId="0"/>
    <xf fontId="1" fillId="0" borderId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`
    );

    sheets.forEach((sheet, idx) => {
      const rowMap = new Map<number, Array<{ col: number; key: string }>>();
      for (const key of Object.keys(sheet.cells)) {
        const [rStr, cStr] = key.split(':');
        const r = Number(rStr);
        const c = Number(cStr);
        if (!Number.isInteger(r) || !Number.isInteger(c)) continue;
        const list = rowMap.get(r) || [];
        list.push({ col: c, key });
        rowMap.set(r, list);
      }

      const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);
      const rowsXml = sortedRows
        .map((r) => {
          const items = (rowMap.get(r) || []).sort((a, b) => a.col - b.col);
          const cellsXml = items
            .map(({ col, key }) => {
              const cell = sheet.cells[key];
              const ref = `${colIndexToLetter(col)}${r + 1}`;
              const styleAttr = cell.bold ? ' s="1"' : '';
              const evaluated = cell.formula?.startsWith('=')
                ? evaluateSheetCell(key, sheet.cells)
                : cell.value;

              if (cell.formula?.startsWith('=')) {
                const formulaExpr = escapeXml(cell.formula.slice(1));
                const numVal = typeof evaluated === 'number' ? evaluated : Number(evaluated);
                if (Number.isFinite(numVal)) {
                  return `<c r="${ref}"${styleAttr}><f>${formulaExpr}</f><v>${numVal}</v></c>`;
                }
                return `<c r="${ref}" t="str"${styleAttr}><f>${formulaExpr}</f><v>${escapeXml(String(evaluated))}</v></c>`;
              }

              if (typeof evaluated === 'number' && Number.isFinite(evaluated)) {
                return `<c r="${ref}"${styleAttr}><v>${evaluated}</v></c>`;
              }

              return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${escapeXml(String(evaluated))}</t></is></c>`;
            })
            .join('');
          return `<row r="${r + 1}">${cellsXml}</row>`;
        })
        .join('');

      zip.file(
        `xl/worksheets/sheet${idx + 1}.xml`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowsXml}</sheetData>
</worksheet>`
      );
    });

    const u8 = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return u8;
  }

  if (kind === 'docx' && content.type === 'docx') {
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    );

    zip.file(
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );

    const paragraphs = content.blocks
      .map((blk) => {
        const prefix = blk.kind === 'bullet' ? '• ' : blk.kind === 'callout' ? '[Примечание] ' : '';
        const text = escapeXml(`${prefix}${blk.text}`);
        if (blk.kind === 'heading') {
          return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
        }
        return `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
      })
      .join('');

    const subtitleXml = content.subtitle
      ? `<w:p><w:r><w:rPr><w:i/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve">${escapeXml(content.subtitle)}</w:t></w:r></w:p>`
      : '';

    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t xml:space="preserve">${escapeXml(title)}</w:t></w:r></w:p>
    ${subtitleXml}
    ${paragraphs}
    <w:sectPr/>
  </w:body>
</w:document>`
    );

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  // PPTX PresentationML
  const slides = content.type === 'pptx' ? content.slides : [];
  const slideOverrides = slides
    .map(
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join('');

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slideOverrides}
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  const sldIdList = slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`)
    .join('');

  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>${sldIdList}</p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>
</p:presentation>`
  );

  const pptRels = slides
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    )
    .join('');

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${pptRels}
</Relationships>`
  );

  slides.forEach((slide, i) => {
    const bulletsXml = slide.bullets
      .map(
        (b) =>
          `<a:p><a:r><a:rPr lang="ru-RU" sz="1800"/><a:t>• ${escapeXml(b)}</a:t></a:r></a:p>`
      )
      .join('');

    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p><a:r><a:rPr lang="ru-RU" sz="3200" b="1"/><a:t>${escapeXml(slide.title)}</a:t></a:r></a:p>
          ${slide.subtitle ? `<a:p><a:r><a:rPr lang="ru-RU" sz="1800"/><a:t>${escapeXml(slide.subtitle)}</a:t></a:r></a:p>` : ''}
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          ${bulletsXml || '<a:p><a:r><a:t></a:t></a:r></a:p>'}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
    );
  });

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function decodeUploadedOfficeFile(
  fileName: string,
  buffer: Buffer
): Promise<{ kind: OfficeDocKind; title: string; content: UniverContent }> {
  const lower = fileName.toLowerCase();
  const kind: OfficeDocKind = lower.endsWith('.xlsx')
    ? 'xlsx'
    : lower.endsWith('.docx')
    ? 'docx'
    : 'pptx';
  const title = fileName.replace(/\.(xlsx|docx|pptx)$/i, '') || 'Импортированный документ';
  const zip = await JSZip.loadAsync(buffer);

  if (kind === 'xlsx') {
    const sharedStrings: string[] = [];
    const ssFile = zip.file('xl/sharedStrings.xml');
    if (ssFile) {
      const ssXml = await ssFile.async('string');
      const siMatches = ssXml.match(/<si>[\s\S]*?<\/si>/g) || [];
      for (const si of siMatches) {
        const texts = Array.from(si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((m) =>
          unescapeXml(m[1])
        );
        sharedStrings.push(texts.join(''));
      }
    }

    const sheetFiles = Object.keys(zip.files)
      .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(p))
      .sort();

    const sheets = [];
    for (let i = 0; i < Math.max(1, sheetFiles.length); i++) {
      const sfPath = sheetFiles[i];
      const cells: Record<string, { value: string | number; formula?: string; bold?: boolean }> = {};
      let maxRow = 12;
      let maxCol = 6;
      if (sfPath) {
        const xml = await zip.file(sfPath)!.async('string');
        const cellMatches = xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g);
        for (const m of cellMatches) {
          const attrs = m[1];
          const inner = m[2];
          const refMatch = /r="([A-Z]+\d+)"/i.exec(attrs);
          if (!refMatch) continue;
          const ref = refMatch[1].toUpperCase();
          const rc = /^([A-Z]+)(\d+)$/.exec(ref);
          if (!rc) continue;
          let col = 0;
          for (let k = 0; k < rc[1].length; k++) {
            col = col * 26 + (rc[1].charCodeAt(k) - 64);
          }
          col -= 1;
          const row = parseInt(rc[2], 10) - 1;
          maxRow = Math.max(maxRow, row + 2);
          maxCol = Math.max(maxCol, col + 2);

          const typeMatch = /t="([^"]+)"/.exec(attrs);
          const cellType = typeMatch ? typeMatch[1] : '';
          const formulaMatch = /<f[^>]*>([\s\S]*?)<\/f>/.exec(inner);
          const valueMatch = /<v[^>]*>([\s\S]*?)<\/v>/.exec(inner);
          const inlineMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);

          let value: string | number = '';
          if (cellType === 's' && valueMatch) {
            value = sharedStrings[Number(valueMatch[1])] ?? '';
          } else if (cellType === 'inlineStr' && inlineMatch) {
            value = unescapeXml(inlineMatch[1]);
          } else if (cellType === 'str' && valueMatch) {
            value = unescapeXml(valueMatch[1]);
          } else if (valueMatch) {
            const num = Number(valueMatch[1]);
            value = Number.isFinite(num) ? num : unescapeXml(valueMatch[1]);
          }

          cells[`${row}:${col}`] = {
            value,
            ...(formulaMatch ? { formula: `=${unescapeXml(formulaMatch[1])}` } : {}),
            ...(attrs.includes('s="1"') ? { bold: true } : {}),
          };
        }
      }

      sheets.push({
        id: `sheet_${i + 1}`,
        name: `Лист ${i + 1}`,
        rows: Math.min(50, maxRow),
        cols: Math.min(16, maxCol),
        cells,
      });
    }

    return {
      kind: 'xlsx',
      title,
      content: { type: 'xlsx', sheets },
    };
  }

  if (kind === 'docx') {
    const docFile = zip.file('word/document.xml');
    const blocks: Array<{ id: string; kind: 'heading' | 'paragraph' | 'bullet' | 'callout'; text: string }> = [];
    if (docFile) {
      const xml = await docFile.async('string');
      const pMatches = xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g);
      let idx = 1;
      for (const pm of pMatches) {
        const inner = pm[1];
        const text = Array.from(inner.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g))
          .map((t) => unescapeXml(t[1]))
          .join('')
          .trim();
        if (!text) continue;
        const isHeading = inner.includes('Heading') || (idx === 1 && text === title);
        const isBullet = text.startsWith('• ');
        blocks.push({
          id: `blk_${idx++}`,
          kind: isHeading ? 'heading' : isBullet ? 'bullet' : 'paragraph',
          text: isBullet ? text.slice(2) : text,
        });
      }
    }
    if (blocks.length === 0) {
      blocks.push({ id: 'blk_1', kind: 'paragraph', text: 'Импортированный документ Word' });
    }
    return {
      kind: 'docx',
      title,
      content: {
        type: 'docx',
        subtitle: `Импортировано из ${fileName}`,
        blocks,
      },
    };
  }

  // PPTX
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const na = Number(/slide(\d+)\.xml/i.exec(a)?.[1] || 0);
      const nb = Number(/slide(\d+)\.xml/i.exec(b)?.[1] || 0);
      return na - nb;
    });

  const slides = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.file(slideFiles[i])!.async('string');
    const texts = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
      .map((m) => unescapeXml(m[1]).trim())
      .filter(Boolean);
    slides.push({
      id: `slide_${i + 1}`,
      title: texts[0] || `Слайд ${i + 1}`,
      subtitle: '',
      bullets: texts.slice(1).map((t) => (t.startsWith('• ') ? t.slice(2) : t)),
      notes: '',
      accentColor: i % 2 === 0 ? '#0077FF' : '#0F172A',
    });
  }
  if (slides.length === 0) {
    slides.push({
      id: 'slide_1',
      title,
      subtitle: `Импортировано из ${fileName}`,
      bullets: [],
      notes: '',
      accentColor: '#0077FF',
    });
  }

  return {
    kind: 'pptx',
    title,
    content: { type: 'pptx', slides },
  };
}
