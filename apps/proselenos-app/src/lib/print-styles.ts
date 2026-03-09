// print-styles.ts
//
// Plain EB Garamond book interior — targets KDP 6×9 trim

export const PRINT_CSS = `
/* ── Base page ── */
@page {
  size: 6in 9in;
  margin: 0.75in 0.625in 0.875in 0.625in; /* top right bottom left */

  @bottom-center {
    content: counter(page);
    font-family: 'EB Garamond', serif;
    font-size: 9pt;
  }
}

/* ── Left (verso) pages: author name header ── */
@page :left {
  margin-left: 0.875in; /* extra gutter */
  @top-left {
    content: string(book-author);
    font-family: 'EB Garamond', serif;
    font-size: 8pt;
    font-style: italic;
    letter-spacing: 0.05em;
  }
}

/* ── Right (recto) pages: book title header ── */
@page :right {
  margin-right: 0.875in;
  @top-right {
    content: string(book-title);
    font-family: 'EB Garamond', serif;
    font-size: 8pt;
    font-style: italic;
    letter-spacing: 0.05em;
  }
}

/* ── Front matter pages: no headers, no page numbers ── */
@page front-matter {
  @top-left      { content: none; }
  @top-right     { content: none; }
  @bottom-center { content: none; }
}

/* ── Chapter-opener page: no header, no page number ── */
@page chapter-start {
  @top-left    { content: none; }
  @top-right   { content: none; }
  @bottom-center { content: none; }
}

/* ── Blank inserted pages: totally empty ── */
@page :blank {
  @top-left      { content: none; }
  @top-right     { content: none; }
  @bottom-center { content: none; }
}

/* ── Body defaults ── */
body {
  font-family: 'EB Garamond', serif;
  font-size: 11pt;
  line-height: 1.45;
  color: #000;
  text-align: left;
  orphans: 2;
  widows: 2;
}

/* ── Running-header string sources ── */
.pdf-author { string-set: book-author content(); display: none; }
.pdf-title  { string-set: book-title content();  display: none; }

/* ── Front matter shared ── */
.front-matter {
  page: front-matter;
  break-before: right;
}

/* ── Title page ── */
.title-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.title-page .book-title {
  font-size: 28pt;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 0.3in;
  text-indent: 0;
}

.title-page .book-author {
  font-size: 16pt;
  font-weight: 400;
  font-style: italic;
  text-indent: 0;
}

/* ── Copyright page ── */
.copyright-page {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;
  padding-bottom: 1in;
}

.copyright-page p {
  font-size: 8.5pt;
  line-height: 1.5;
  text-align: left;
  text-indent: 0;
  margin: 0.15em 0;
}

/* ── Table of contents ── */
.toc-page {
  break-before: right;
}

.toc-page h2 {
  font-size: 18pt;
  font-weight: 600;
  text-align: center;
  margin-top: 1.5in;
  margin-bottom: 0.5in;
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-list li {
  font-size: 11pt;
  line-height: 2;
  text-indent: 0;
}

/* ── Chapters ── */
article.scene {
  break-before: right;       /* always start on recto, insert blank if needed */
  page: chapter-start;       /* first page uses chapter-start @page (no header) */
}

/* After the first page, revert to normal pages */
article.scene::after {
  page: auto;
}

h1.scene-title {
  font-size: 18pt;
  font-weight: 600;
  text-align: center;
  margin-top: 2in;
  margin-bottom: 0.5in;
  string-set: book-title content(); /* update running header per chapter */
}

/* ── Paragraphs ── */
p {
  margin: 0;
  text-indent: 1.5em;
}

/* First paragraph after a heading or break: no indent.
   Class applied by JS to avoid pagedjs 0.4.3 css-tree crash
   on + combinator and :first-of-type pseudo-selector. */
p.no-indent-first {
  text-indent: 0;
}

/* Kill empty spacer paragraphs and stacked <br> tags */
p:empty { display: none; }

/* ── Dialogue ── */
.dialogue {
  margin: 0.6em 0;
  text-indent: 1.5em;
}

.dialogue .speaker {
  font-variant: small-caps;
  font-weight: 600;
  margin-right: 0.4em;
}

/* ── Scene breaks ── */
.scene-break {
  text-align: center;
  margin: 1.2em 0;
  text-indent: 0;
  font-size: 12pt;
  letter-spacing: 0.3em;
}

/* ── Images (flatten Scenecraft sticky-wrap for print) ── */
.sticky-wrap {
  display: block;
  page-break-inside: avoid;
  margin: 1em 0;
}

.sticky-img-wrap {
  text-align: center;
  margin-bottom: 0.4em;
  background: none !important; /* kill the --sticky-bg */
}

.sticky-img {
  max-width: 3.5in;
  max-height: 4in;
  display: block;
  margin: 0 auto;
}

.sticky-caption {
  font-size: 9pt;
  font-style: italic;
  text-align: center;
  margin-top: 0.2em;
  text-indent: 0;
}

.sticky-text {
  margin-top: 0.4em;
}

/* Hide interactive elements meaningless in print */
input[type="checkbox"],
.enlarge-overlay,
label.img-label {
  display: contents; /* unwrap label so img still shows */
}

input[type="checkbox"] {
  display: none;
}
`;
