/**
 * Visual Narrative CSS for EPUB3
 *
 * Reflowable styles for visual narrative ebooks.
 * Applied to EPUBs that contain visual narrative block types
 * (dialogue, internal, emphasis-line, scene-break, visual, scene-audio).
 *
 * Reader apps handle light/dark mode — this CSS provides the structural
 * styling and relative formatting that works in both.
 */

export const VISUAL_NARRATIVE_CSS = `/* Visual Narrative — reflowable epub3 styles */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
  line-height: 1.8;
  font-size: 1.1em;
  max-width: 100%;
  overflow-x: hidden;
}

/* ── Nav / Title ─────────────────────────── */

.nav-page {
  text-align: center;
  padding: 2em 1em;
}

.story-header {
  margin-bottom: 2em;
}

.cover-image {
  width: 60%;
  max-width: 400px;
  height: auto;
  border-radius: 4px;
  margin-bottom: 1.5em;
  display: block;
  margin-left: auto;
  margin-right: auto;
}

.story-header h1 {
  font-size: 2.2em;
  font-weight: 300;
  letter-spacing: 0.15em;
  margin-bottom: 0.2em;
  text-transform: uppercase;
}

.byline {
  font-style: italic;
  opacity: 0.6;
  font-size: 0.95em;
}

nav ol {
  list-style: none;
  padding: 1em 0;
}

nav ol li {
  margin: 0.8em 0;
}

nav ol li a {
  text-decoration: none;
  font-size: 1.1em;
  letter-spacing: 0.05em;
}

/* ── Scene ────────────────────────────────── */

.scene {
  padding: 1.5em;
  max-width: 750px;
  margin: 0 auto;
}

.scene-title {
  font-size: 1.4em;
  font-weight: 300;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 1.5em;
  text-align: center;
}

/* ── Text ─────────────────────────────────── */

.narration {
  margin-bottom: 1.5em;
}

.narration.opening {
  font-size: 1.15em;
}

.dialogue {
  margin: 1.5em 0;
  padding-left: 1.5em;
  border-left: 2px solid;
  border-left-color: rgba(128, 128, 128, 0.3);
}

.dialogue .speaker {
  font-style: normal;
  font-size: 0.85em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.5;
  display: block;
  margin-bottom: 0.3em;
}

.internal {
  margin: 1.5em 2em;
  font-style: italic;
  opacity: 0.7;
}

.emphasis-line {
  text-align: center;
  margin: 2em 0;
  font-size: 1.2em;
  letter-spacing: 0.08em;
}

.scene-break {
  text-align: center;
  margin: 2.5em 0;
  letter-spacing: 0.5em;
  font-size: 0.8em;
  opacity: 0.4;
}

/* ── Images ───────────────────────────────── */

.visual {
  margin: 2em 0;
}

.visual img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 2px;
}

.visual.wide {
  margin-left: -1.5em;
  margin-right: -1.5em;
  width: calc(100% + 3em);
}

.visual.wide img {
  border-radius: 0;
}

.visual.inline-right {
  float: right;
  width: 45%;
  margin: 0.5em 0 1em 1.5em;
}

.visual.inline-left {
  float: left;
  width: 45%;
  margin: 0.5em 1.5em 1em 0;
}

.visual.centered {
  width: 65%;
  margin-left: auto;
  margin-right: auto;
}

.visual .caption {
  font-size: 0.8em;
  text-align: center;
  margin-top: 0.5em;
  font-style: italic;
  opacity: 0.5;
}

.clearfix::after {
  content: "";
  display: table;
  clear: both;
}

/* ── Audio ────────────────────────────────── */

.scene-audio {
  margin: 2em 0;
  text-align: center;
}

.scene-audio audio {
  width: 80%;
  max-width: 400px;
  opacity: 0.7;
}

.scene-audio .audio-label {
  font-size: 0.8em;
  opacity: 0.4;
  margin-bottom: 0.5em;
  letter-spacing: 0.05em;
}

/* ── Scene nav ────────────────────────────── */

.scene-end {
  margin-top: 3em;
  padding-top: 2em;
  border-top: 1px solid;
  border-top-color: rgba(128, 128, 128, 0.15);
  text-align: center;
}

.scene-end .next-label {
  font-size: 0.8em;
  opacity: 0.4;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.scene-end a {
  display: block;
  margin-top: 0.3em;
  text-decoration: none;
  font-size: 1.1em;
}

/* ── Responsive ───────────────────────────── */

@media (max-width: 600px) {
  .scene { padding: 1em; }

  .visual.wide {
    margin-left: -1em;
    margin-right: -1em;
    width: calc(100% + 2em);
  }

  .visual.inline-right,
  .visual.inline-left {
    float: none;
    width: 100%;
    margin: 1.5em 0;
  }

  .visual.centered { width: 90%; }
  .dialogue { padding-left: 1em; }
  .internal { margin: 1.5em 0.5em; }
}

@media (min-width: 1000px) {
  .scene {
    max-width: 800px;
    font-size: 1.05em;
  }
}
`;
