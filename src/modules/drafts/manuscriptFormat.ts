/**
 * Export a manuscript in standard manuscript format as a real .docx: Times New Roman 12pt, double
 * spaced, 1-inch margins, half-inch first-line indents, a running header "Surname / TITLE / page",
 * a title page with contact details and a rounded word count, each chapter on a new page a third
 * of the way down, and "#" for scene breaks. Pure: returns the file's bytes.
 */
import { strToU8, zipSync } from 'fflate';
import { paragraphs, roundedCount } from './logic';

export interface ExportChapter { title: string; text: string }
export interface ExportInput { title: string; author: { name: string; surname: string; contact: string }; chapters: ExportChapter[]; words: number }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A run of text, turning *asterisks* into italics. */
function runs(text: string): string {
  return text.split(/(\*[^*\n]+\*)/g).filter(Boolean).map((part) =>
    /^\*[^*]+\*$/.test(part)
      ? `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${esc(part.slice(1, -1))}</w:t></w:r>`
      : `<w:r><w:t xml:space="preserve">${esc(part)}</w:t></w:r>`).join('');
}

const P = (inner: string, props = '') => `<w:p><w:pPr>${props}</w:pPr>${inner}</w:p>`;
const center = '<w:jc w:val="center"/>';
const noIndent = '<w:ind w:firstLine="0"/>';

export function manuscriptDocx(m: ExportInput): Uint8Array {
  const body: string[] = [];
  // Title page: contact block top-left, word count top-right, title and byline centered halfway down.
  const contact = [m.author.name, ...m.author.contact.split('\n')].map((l) => l.trim()).filter(Boolean);
  body.push(P(`<w:r><w:t xml:space="preserve">${esc(contact[0] ?? '')}</w:t></w:r><w:r><w:tab/><w:t>${esc(roundedCount(m.words))}</w:t></w:r>`, `${noIndent}<w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs><w:spacing w:line="240" w:lineRule="auto"/>`));
  for (const line of contact.slice(1)) body.push(P(runs(line), `${noIndent}<w:spacing w:line="240" w:lineRule="auto"/>`));
  body.push(P('', `${noIndent}<w:spacing w:before="4320"/>`));
  body.push(P(runs(m.title.toUpperCase()), `${center}${noIndent}`));
  body.push(P(runs(`by ${m.author.name}`), `${center}${noIndent}`));

  m.chapters.forEach((ch, i) => {
    // New page, a third of the way down, chapter heading centered.
    // Word ignores space-before at the top of a page, so drop down a third with blank double-spaced lines.
    body.push(P('', `${noIndent}<w:pageBreakBefore/>`));
    for (let k = 0; k < 7; k++) body.push(P('', noIndent));
    body.push(P(runs(`Chapter ${i + 1}`), `${center}${noIndent}`));
    if (ch.title && !/^chapter\s+\d+$/i.test(ch.title)) body.push(P(runs(ch.title), `${center}${noIndent}`));
    let first = true;
    for (const p of paragraphs(ch.text)) {
      if (p.kind === 'break') { body.push(P(runs('#'), `${center}${noIndent}`)); first = true; continue; }
      body.push(P(runs(p.text), first ? noIndent : ''));
      first = false;
    }
  });
  body.push(P(runs('END'), `${center}${noIndent}<w:spacing w:before="480"/>`));

  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:titlePg/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${body.join('')}${sect}</w:body></w:document>`;
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${ns}><w:p><w:pPr><w:jc w:val="right"/><w:ind w:firstLine="0"/><w:spacing w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:t xml:space="preserve">${esc(m.author.surname)} / ${esc(m.title.toUpperCase())} / </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${ns}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="480" w:lineRule="auto"/><w:ind w:firstLine="720"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    'word/_rels/document.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`),
    'word/document.xml': strToU8(doc),
    'word/styles.xml': strToU8(styles),
    'word/header1.xml': strToU8(header),
  };
  return zipSync(files);
}

/** Plain-text export (for pasting, or a quick read on a phone). */
export function manuscriptText(m: ExportInput): string {
  return [`${m.title.toUpperCase()}\nby ${m.author.name}\n${roundedCount(m.words)}`,
    ...m.chapters.map((c, i) => `\n\nCHAPTER ${i + 1}${c.title && !/^chapter\s+\d+$/i.test(c.title) ? `\n${c.title}` : ''}\n\n${paragraphs(c.text).map((p) => (p.kind === 'break' ? '#' : p.text)).join('\n\n')}`),
    '\n\nEND\n'].join('');
}
