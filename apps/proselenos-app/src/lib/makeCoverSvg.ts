// apps/proselenos-app/src/lib/makeCoverSvg.ts

// Uses fonts from /public/fonts/
// Standard Ebooks-style cover design: dark box near bottom with title + author

const WIDTH = 1400;                 // SE standard width
const HEIGHT = 2100;                // SE standard height
const TITLE_BOX_Y = 1620;           // Y position where dark box starts
const TITLE_BOX_HEIGHT = 430;       // Height of the dark box
const BOX_OPACITY = 0.75;           // Dark box opacity
const BOX_MARGIN_X = 40;            // Horizontal margin for dark box
const SAFE_MARGIN_X = 100;          // Horizontal padding inside box
const MAX_TEXT_W = WIDTH - SAFE_MARGIN_X * 2;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function fitFontSize(
  text: string,
  fontWeight: string,
  maxWidth: number,
  startSize: number
): Promise<number> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  let size = startSize;
  while (size > 12) {
    ctx.font = `${fontWeight} ${size}px "EBGaramondEmbed"`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return size;
}

function wrapText(
  text: string,
  fontWeight: string,
  fontSize: number,
  maxWidth: number
): string[] {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${fontWeight} ${fontSize}px "EBGaramondEmbed"`;

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

export async function makeCoverSvg({
  title,
  author,
  bg = "#3366AA",
  fontColor = "#FFFFFF",
  bgImageDataUrl,
}: {
  title: string;
  author: string;
  bg?: string;
  fontColor?: string;
  bgImageDataUrl?: string;
}): Promise<string> {
  // Fetch fonts from /public/fonts/
  const [regBuf, boldBuf] = await Promise.all([
    fetch("/fonts/EBGaramond-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/EBGaramond-Bold.ttf").then((r) => r.arrayBuffer()),
  ]);

  const regB64 = bytesToBase64(new Uint8Array(regBuf));
  const boldB64 = bytesToBase64(new Uint8Array(boldBuf));

  // Load fonts into document for Canvas text measurement
  const ffReg = new FontFace("EBGaramondEmbed", regBuf, { weight: "400", style: "normal" });
  const ffBold = new FontFace("EBGaramondEmbed", boldBuf, { weight: "700", style: "normal" });
  await Promise.all([ffReg.load(), ffBold.load()]);
  document.fonts.add(ffReg);
  document.fonts.add(ffBold);
  await document.fonts.ready;

  // Convert title to uppercase for SE style
  const upperTitle = title.toUpperCase();

  // === ADAPTIVE LAYOUT ALGORITHM ===
  // Box constraints (fixed)
  const boxPadding = 25;
  const boxTop = TITLE_BOX_Y + boxPadding;
  const boxBottom = TITLE_BOX_Y + TITLE_BOX_HEIGHT - boxPadding;
  const availableHeight = boxBottom - boxTop; // ~380px to work with

  // Start with preferred sizes
  let titleSize = 140;
  let authorSize = 70;
  let authorGap = 90;

  // Try entire title on one line first - maximize prominence
  let titleLines: string[];
  const singleLineSize = await fitFontSize(upperTitle, "700", MAX_TEXT_W, 140);

  if (singleLineSize >= 50) {
    // Fits on single line at readable size - use it
    titleLines = [upperTitle];
    titleSize = singleLineSize;
  } else {
    // Need to wrap - use pixel-based wrapping (not arbitrary word count)
    titleLines = wrapText(upperTitle, "700", 100, MAX_TEXT_W);
    // Find size that fits all wrapped lines
    titleSize = 140;
    for (const line of titleLines) {
      const fitted = await fitFontSize(line, "700", MAX_TEXT_W, titleSize);
      if (fitted < titleSize) titleSize = fitted;
    }
  }

  // Helper to calculate total content height
  const calcTotalHeight = (tSize: number, aSize: number, gap: number, aLineCount: number) => {
    const tLineH = Math.round(tSize * 1.2);
    const aLineH = Math.round(aSize * 1.3);
    // Title: first line height is tSize (baseline), subsequent lines add tLineH
    // Author: first line height is aSize, subsequent lines add aLineH
    const titleHeight = tSize + (titleLines.length - 1) * tLineH;
    const authorHeight = aSize + (aLineCount - 1) * aLineH;
    return titleHeight + gap + authorHeight;
  };

  // Initial author line wrap with current size
  let authorLines = wrapText(author, "400", authorSize, MAX_TEXT_W);
  let totalHeight = calcTotalHeight(titleSize, authorSize, authorGap, authorLines.length);

  // ADAPTIVE: Scale down proportionally if content exceeds available space
  if (totalHeight > availableHeight) {
    const scale = availableHeight / totalHeight;
    titleSize = Math.floor(titleSize * scale);
    authorSize = Math.floor(authorSize * scale);
    authorGap = Math.floor(authorGap * scale);

    // Re-wrap author with smaller font (may need fewer lines now)
    authorLines = wrapText(author, "400", authorSize, MAX_TEXT_W);
    totalHeight = calcTotalHeight(titleSize, authorSize, authorGap, authorLines.length);
  }

  // Calculate line heights with final sizes
  const titleLineHeight = Math.round(titleSize * 1.2);
  const authorLineHeight = Math.round(authorSize * 1.3);

  // Position content centered vertically in available space (guaranteed to fit)
  const titleStartY = boxTop + (availableHeight - totalHeight) / 2 + titleSize;

  // Generate title text elements
  const titleTexts = titleLines.map((line, i) => {
    const y = titleStartY + i * titleLineHeight;
    return `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle"
        font-family="EBGaramondEmbed" font-weight="700"
        font-size="${titleSize}" fill="${fontColor}">
    ${esc(line)}
  </text>`;
  }).join("\n  ");

  // Author positioned below title inside the box
  const titleBottomY = titleStartY + (titleLines.length - 1) * titleLineHeight;
  const authorY = titleBottomY + authorGap + authorSize;

  // Generate author text
  const authorText = authorLines.map((line, i) => {
    const y = authorY + i * authorLineHeight;
    return `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle"
        font-family="EBGaramondEmbed" font-weight="400"
        font-size="${authorSize}" fill="${fontColor}" letter-spacing="1">
    ${esc(line)}
  </text>`;
  }).join("\n  ");

  // Background element - image or solid color
  const bgElement = bgImageDataUrl
    ? `<image x="0" y="0" width="${WIDTH}" height="${HEIGHT}" href="${bgImageDataUrl}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <style>
    @font-face {
      font-family: "EBGaramondEmbed";
      src: url(data:font/ttf;base64,${regB64}) format("truetype");
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: "EBGaramondEmbed";
      src: url(data:font/ttf;base64,${boldB64}) format("truetype");
      font-weight: 700;
      font-style: normal;
    }
  </style>

  ${bgElement}

  <!-- Semi-transparent dark box for title/author -->
  <rect x="${BOX_MARGIN_X}" y="${TITLE_BOX_Y}" width="${WIDTH - BOX_MARGIN_X * 2}" height="${TITLE_BOX_HEIGHT}"
        fill="#000000" fill-opacity="${BOX_OPACITY}"/>

  ${titleTexts}

  ${authorText}
</svg>`;
}

export async function svgToPngBlob(
  svg: string,
  width = 1400,
  height = 2100
): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load SVG into Image"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D canvas context");

    ctx.drawImage(img, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
        "image/png"
      );
    });

    return pngBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Typography-only SVG (transparent background, includes dark box)
// For authors to overlay onto their own cover artwork
export async function makeTypographySvg({
  title,
  author,
  fontColor = "#FFFFFF",
}: {
  title: string;
  author: string;
  fontColor?: string;
}): Promise<string> {
  // Fetch fonts from /public/fonts/
  const [regBuf, boldBuf] = await Promise.all([
    fetch("/fonts/EBGaramond-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/EBGaramond-Bold.ttf").then((r) => r.arrayBuffer()),
  ]);

  const regB64 = bytesToBase64(new Uint8Array(regBuf));
  const boldB64 = bytesToBase64(new Uint8Array(boldBuf));

  // Load fonts into document for Canvas text measurement
  const ffReg = new FontFace("EBGaramondEmbed", regBuf, { weight: "400", style: "normal" });
  const ffBold = new FontFace("EBGaramondEmbed", boldBuf, { weight: "700", style: "normal" });
  await Promise.all([ffReg.load(), ffBold.load()]);
  document.fonts.add(ffReg);
  document.fonts.add(ffBold);
  await document.fonts.ready;

  // Convert title to uppercase for SE style
  const upperTitle = title.toUpperCase();

  // === ADAPTIVE LAYOUT ALGORITHM ===
  // Box constraints (fixed)
  const boxPadding = 25;
  const boxTop = TITLE_BOX_Y + boxPadding;
  const boxBottom = TITLE_BOX_Y + TITLE_BOX_HEIGHT - boxPadding;
  const availableHeight = boxBottom - boxTop; // ~380px to work with

  // Start with preferred sizes
  let titleSize = 140;
  let authorSize = 70;
  let authorGap = 90;

  // Try entire title on one line first - maximize prominence
  let titleLines: string[];
  const singleLineSize = await fitFontSize(upperTitle, "700", MAX_TEXT_W, 140);

  if (singleLineSize >= 50) {
    // Fits on single line at readable size - use it
    titleLines = [upperTitle];
    titleSize = singleLineSize;
  } else {
    // Need to wrap - use pixel-based wrapping (not arbitrary word count)
    titleLines = wrapText(upperTitle, "700", 100, MAX_TEXT_W);
    // Find size that fits all wrapped lines
    titleSize = 140;
    for (const line of titleLines) {
      const fitted = await fitFontSize(line, "700", MAX_TEXT_W, titleSize);
      if (fitted < titleSize) titleSize = fitted;
    }
  }

  // Helper to calculate total content height
  const calcTotalHeight = (tSize: number, aSize: number, gap: number, aLineCount: number) => {
    const tLineH = Math.round(tSize * 1.2);
    const aLineH = Math.round(aSize * 1.3);
    // Title: first line height is tSize (baseline), subsequent lines add tLineH
    // Author: first line height is aSize, subsequent lines add aLineH
    const titleHeight = tSize + (titleLines.length - 1) * tLineH;
    const authorHeight = aSize + (aLineCount - 1) * aLineH;
    return titleHeight + gap + authorHeight;
  };

  // Initial author line wrap with current size
  let authorLines = wrapText(author, "400", authorSize, MAX_TEXT_W);
  let totalHeight = calcTotalHeight(titleSize, authorSize, authorGap, authorLines.length);

  // ADAPTIVE: Scale down proportionally if content exceeds available space
  if (totalHeight > availableHeight) {
    const scale = availableHeight / totalHeight;
    titleSize = Math.floor(titleSize * scale);
    authorSize = Math.floor(authorSize * scale);
    authorGap = Math.floor(authorGap * scale);

    // Re-wrap author with smaller font (may need fewer lines now)
    authorLines = wrapText(author, "400", authorSize, MAX_TEXT_W);
    totalHeight = calcTotalHeight(titleSize, authorSize, authorGap, authorLines.length);
  }

  // Calculate line heights with final sizes
  const titleLineHeight = Math.round(titleSize * 1.2);
  const authorLineHeight = Math.round(authorSize * 1.3);

  // Position content centered vertically in available space (guaranteed to fit)
  const titleStartY = boxTop + (availableHeight - totalHeight) / 2 + titleSize;

  // Generate title text elements
  const titleTexts = titleLines.map((line, i) => {
    const y = titleStartY + i * titleLineHeight;
    return `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle"
        font-family="EBGaramondEmbed" font-weight="700"
        font-size="${titleSize}" fill="${fontColor}">
    ${esc(line)}
  </text>`;
  }).join("\n  ");

  // Author positioned below title inside the box
  const titleBottomY = titleStartY + (titleLines.length - 1) * titleLineHeight;
  const authorY = titleBottomY + authorGap + authorSize;

  // Generate author text
  const authorText = authorLines.map((line, i) => {
    const y = authorY + i * authorLineHeight;
    return `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle"
        font-family="EBGaramondEmbed" font-weight="400"
        font-size="${authorSize}" fill="${fontColor}" letter-spacing="1">
    ${esc(line)}
  </text>`;
  }).join("\n  ");

  // Transparent background with dark box and text
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <style>
    @font-face {
      font-family: "EBGaramondEmbed";
      src: url(data:font/ttf;base64,${regB64}) format("truetype");
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: "EBGaramondEmbed";
      src: url(data:font/ttf;base64,${boldB64}) format("truetype");
      font-weight: 700;
      font-style: normal;
    }
  </style>

  <!-- Semi-transparent dark box for title/author -->
  <rect x="${BOX_MARGIN_X}" y="${TITLE_BOX_Y}" width="${WIDTH - BOX_MARGIN_X * 2}" height="${TITLE_BOX_HEIGHT}"
        fill="#000000" fill-opacity="${BOX_OPACITY}"/>

  ${titleTexts}

  ${authorText}
</svg>`;
}

// Convenience: get PNG as File (for EPUB packaging)
export async function makeCoverPngFile({
  title,
  author,
  bg = "#3366AA",
  fontColor = "#FFFFFF",
  bgImageDataUrl,
  filename = "cover.png",
}: {
  title: string;
  author: string;
  bg?: string;
  fontColor?: string;
  bgImageDataUrl?: string;
  filename?: string;
}): Promise<File> {
  const svg = await makeCoverSvg({ title, author, bg, fontColor, bgImageDataUrl });
  const pngBlob = await svgToPngBlob(svg);
  return new File([pngBlob], filename, { type: "image/png" });
}
