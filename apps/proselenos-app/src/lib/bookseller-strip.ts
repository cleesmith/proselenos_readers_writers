/**
 * Strip ALL Visual Narrative, Sticky Image, and SceneCraft traces from an epub zip.
 *
 * Produces a clean, plain epub suitable for booksellers (D2D, KDP, etc.)
 * that passes EPUBCheck with zero errors.
 *
 * Used by both BookDetailModal (download bookseller epub) and
 * BookshelfItem (read as bookseller preview).
 */
import JSZip from 'jszip';

/**
 * Mutates the given JSZip in place, stripping VN/sticky/SceneCraft content.
 * - Images and audio folders are kept intact.
 * - All XHTML files are cleaned of VN class names and sticky markup.
 * - visual-narrative.css and meta.json are removed from the zip.
 * - content.opf manifest entry for vn-style is removed.
 */
export async function stripEpubForBookseller(zip: JSZip): Promise<void> {
  // Step 1: Strip XHTML content files
  const xhtmlFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith('OEBPS/') && name.endsWith('.xhtml')
  );

  for (const name of xhtmlFiles) {
    const content = await zip.file(name)!.async('string');
    const stripped = stripXhtmlContent(content);
    if (stripped !== content) {
      zip.file(name, stripped);
    }
  }

  // Step 2: Remove VN CSS and SceneCraft meta.json
  zip.remove('OEBPS/css/visual-narrative.css');
  zip.remove('OEBPS/meta.json');

  // Step 3: Update content.opf — remove vn-style manifest entry
  const opfPath = 'OEBPS/content.opf';
  const opfFile = zip.file(opfPath);
  if (opfFile) {
    let opf = await opfFile.async('string');
    opf = opf.replace(/\s*<item\s+id="vn-style"\s+href="css\/visual-narrative\.css"[^>]*\/>/g, '');
    zip.file(opfPath, opf);
  }
}

/**
 * Strip all VN/sticky/SceneCraft markup from a single XHTML string.
 *
 * Replacements are applied in a specific order so that outer wrappers
 * are handled before their inner elements get individually transformed.
 */
function stripXhtmlContent(html: string): string {
  let s = html;

  // 1. VN CSS link → style.css
  //    Handles both "css/visual-narrative.css" and "../css/visual-narrative.css" (nomatter)
  s = s.replace(
    /<link[^>]*href="(\.\.\/)?css\/visual-narrative\.css"[^/]*\/>/g,
    (_match, prefix) => {
      const p = prefix || '';
      return `<link rel="stylesheet" type="text/css" href="${p}css/style.css"/>`;
    }
  );

  // 2. Sticky-wrap blocks → figure + text paragraphs
  //    Must run before individual sticky-* cleanups since this replaces the whole block.
  s = s.replace(
    /<div class="sticky-wrap">\s*<div class="sticky-img-wrap"[^>]*>([\s\S]*?)<\/div>\s*<div class="sticky-text">\s*([\s\S]*?)\s*<\/div>\s*<\/div>/g,
    (_match, imgWrapContent: string, textContent: string) => {
      const imgMatch = imgWrapContent.match(/<img[^>]*\bsrc="([^"]*)"[^>]*\balt="([^"]*)"[^>]*\/>/);
      let result = '';
      if (imgMatch) {
        result += `<figure><img src="${imgMatch[1]}" alt="${imgMatch[2]}"/></figure>\n`;
      }
      result += textContent.trim() + '\n';
      return result;
    }
  );

  // 3. Unwrap <article class="scene" ...> wrapper (keep children)
  s = s.replace(/<article\s+class="scene"[^>]*>\s*/g, '');
  s = s.replace(/\s*<\/article>/g, '');

  // 4. <h1 class="scene-title"> → plain <h1>
  s = s.replace(/<h1 class="scene-title">/g, '<h1>');

  // 5. Dialogue: <div class="dialogue"><span class="speaker">X</span>Y</div>
  //    → <blockquote><strong>X</strong>Y</blockquote>
  s = s.replace(
    /<div class="dialogue"><span class="speaker">([\s\S]*?)<\/span>([\s\S]*?)<\/div>/g,
    '<blockquote><strong>$1</strong><br/>$2</blockquote>'
  );

  // 6. <p class="internal"> → <p style="font-style:italic">
  s = s.replace(/<p class="internal">/g, '<p style="font-style:italic">');

  // 7. <p class="emphasis-line"> → <p style="text-align:center">
  s = s.replace(/<p class="emphasis-line">/g, '<p style="text-align:center">');

  // 8. <p class="scene-break">...</p> → <hr/>
  s = s.replace(/<p class="scene-break">[^<]*<\/p>/g, '<hr/>');

  // 9. <div class="visual ..."> → <figure>, with caption → figcaption
  s = s.replace(
    /<div class="visual[^"]*">\s*([\s\S]*?)\s*<\/div>/g,
    (_match, inner: string) => {
      const converted = inner.replace(
        /<p class="caption">([\s\S]*?)<\/p>/g,
        '<figcaption>$1</figcaption>'
      );
      return `<figure>${converted.trim()}</figure>`;
    }
  );

  // 10. <div class="clearfix"></div> → remove entirely
  s = s.replace(/<div class="clearfix">\s*<\/div>\n?/g, '');

  // 11. scene-audio wrapper → keep <audio> only, strip wrapper and audio-label
  s = s.replace(
    /<div class="scene-audio">\s*(?:<p class="audio-label">[^<]*<\/p>\s*)?(<audio[\s\S]*?<\/audio>)\s*<\/div>/g,
    '$1'
  );

  // 12. audio-block wrapper → keep <audio> only
  s = s.replace(
    /<div class="audio-block">\s*(<audio[\s\S]*?<\/audio>)\s*(?:<p class="caption">[^<]*<\/p>\s*)?<\/div>/g,
    '$1'
  );

  // 13–17. Cleanup any remaining sticky/enlarge artifacts
  s = s.replace(/<input type="checkbox" id="enlarge-\d+"\/>\n?/g, '');
  s = s.replace(/<label class="enlarge-overlay" for="enlarge-\d+"><\/label>\n?/g, '');
  s = s.replace(/<label class="img-label" for="enlarge-\d+">\s*/g, '');
  // Remove orphaned </label> only near sticky/enlarge context
  s = s.replace(/<\/label>\n?(?=\s*(?:<label class="enlarge|<p class="sticky))/g, '');
  s = s.replace(/ class="sticky-img"/g, '');
  s = s.replace(/<p class="sticky-caption">[^<]*<\/p>\n?/g, '');

  return s;
}
