// apps/proselenos-app/src/lib/makeCoverSvg.ts

// Uses fonts from /public/fonts/

const WIDTH = 1600;
const HEIGHT = 2560;
const SAFE_MARGIN_X = 140;
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

export async function makeCoverSvg({
  title,
  author,
  bg = "#3366AA",
  fontColor = "#FFFFFF",
  logoUrl,
  logoSize = 100,
  bgImageDataUrl,
}: {
  title: string;
  author: string;
  bg?: string;
  fontColor?: string;
  logoUrl?: string;
  logoSize?: number;
  bgImageDataUrl?: string;
}): Promise<string> {
  // Fetch fonts from /public/fonts/
  const [regBuf, boldBuf] = await Promise.all([
    fetch("/fonts/EBGaramond-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/EBGaramond-Bold.ttf").then((r) => r.arrayBuffer()),
  ]);

  const regB64 = bytesToBase64(new Uint8Array(regBuf));
  const boldB64 = bytesToBase64(new Uint8Array(boldBuf));

  // Load logo if provided
  let logoB64 = "";
  let logoMime = "image/png";
  if (logoUrl) {
    const logoRes = await fetch(logoUrl);
    const contentType = logoRes.headers.get("content-type") || "";
    if (logoRes.ok && contentType.startsWith("image/")) {
      const logoBuf = await logoRes.arrayBuffer();
      logoB64 = bytesToBase64(new Uint8Array(logoBuf));
      if (contentType.includes("png")) logoMime = "image/png";
      else if (contentType.includes("ico")) logoMime = "image/x-icon";
      else if (contentType.includes("svg")) logoMime = "image/svg+xml";
      else if (contentType.includes("jpeg") || contentType.includes("jpg")) logoMime = "image/jpeg";
    }
  }

  // Load fonts into document for Canvas text measurement
  const ffReg = new FontFace("EBGaramondEmbed", regBuf, { weight: "400", style: "normal" });
  const ffBold = new FontFace("EBGaramondEmbed", boldBuf, { weight: "700", style: "normal" });
  await Promise.all([ffReg.load(), ffBold.load()]);
  document.fonts.add(ffReg);
  document.fonts.add(ffBold);
  await document.fonts.ready;

  // Split title into lines of max 3 words each
  const words = title.split(/\s+/);
  const titleLines: string[] = [];
  for (let i = 0; i < words.length; i += 3) {
    titleLines.push(words.slice(i, i + 3).join(" "));
  }

  // Fit all title lines to same size (use smallest that fits)
  let titleSize = 170;
  for (const line of titleLines) {
    const fitted = await fitFontSize(line, "700", MAX_TEXT_W, titleSize);
    if (fitted < titleSize) titleSize = fitted;
  }
  const authorSize = await fitFontSize(author, "400", MAX_TEXT_W, 80);

  // Calculate Y positions for title lines (closer to top)
  const lineHeight = Math.round(titleSize * 1.25);
  const titleStartY = 400 + titleSize;

  // Generate title text elements
  const titleTexts = titleLines.map((line, i) => {
    const y = titleStartY + i * lineHeight;
    return `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle"
        font-family="EBGaramondEmbed" font-weight="700"
        font-size="${titleSize}" fill="${fontColor}">
    ${esc(line)}
  </text>`;
  }).join("\n  ");

  // Branding area (icon left of text, both right-justified together, near bottom)
  const brandingY = HEIGHT - 80;
  const iconSize = logoSize;
  const textWidth = 400; // approximate width of "Everything Ebooks" at size 50
  const gap = 20;
  const brandTextX = WIDTH - 100;
  const brandTextY = brandingY;
  const iconX = brandTextX - textWidth - gap - iconSize;
  const iconY = brandingY - iconSize + 15;

  // Logo element (left of text)
  const logoElement = logoB64
    ? `<image x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" href="data:${logoMime};base64,${logoB64}"/>`
    : "";

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

  ${titleTexts}

  <text x="${WIDTH / 2}" y="1600" text-anchor="middle"
        font-family="EBGaramondEmbed" font-weight="400"
        font-size="${authorSize}" fill="${fontColor}" opacity="0.85" letter-spacing="2">
    ${esc(author)}
  </text>

  <!-- Branding: icon then text, right-justified -->
  ${logoElement}
  
  <text x="${brandTextX}" y="${brandTextY}" text-anchor="end"
        font-family="EBGaramondEmbed" font-weight="400" font-style="italic"
        font-size="50" fill="${fontColor}" opacity="0.7">
    Everything Ebooks
  </text>
</svg>`;
}

export async function svgToPngBlob(
  svg: string,
  width = 1600,
  height = 2560
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

// Typography-only SVG (transparent background, no logo/branding)
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

  // Split title into lines of max 3 words each
  const words = title.split(/\s+/);
  const titleLines: string[] = [];
  for (let i = 0; i < words.length; i += 3) {
    titleLines.push(words.slice(i, i + 3).join(" "));
  }

  // Fit all title lines to same size (use smallest that fits)
  let titleSize = 170;
  for (const line of titleLines) {
    const fitted = await fitFontSize(line, "700", MAX_TEXT_W, titleSize);
    if (fitted < titleSize) titleSize = fitted;
  }
  const authorSize = await fitFontSize(author, "400", MAX_TEXT_W, 80);

  // Calculate Y positions for title lines (closer to top)
  const lineHeight = Math.round(titleSize * 1.25);
  const titleStartY = 400 + titleSize;

  // Generate title text elements
  const titleTexts = titleLines.map((line, i) => {
    const y = titleStartY + i * lineHeight;
    return `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle"
        font-family="EBGaramondEmbed" font-weight="700"
        font-size="${titleSize}" fill="${fontColor}">
    ${esc(line)}
  </text>`;
  }).join("\n  ");

  // No background, no logo, no branding - just title and author
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

  ${titleTexts}

  <text x="${WIDTH / 2}" y="1600" text-anchor="middle"
        font-family="EBGaramondEmbed" font-weight="400"
        font-size="${authorSize}" fill="${fontColor}" opacity="0.85" letter-spacing="2">
    ${esc(author)}
  </text>
</svg>`;
}

// Convenience: get PNG as File (for EPUB packaging)
export async function makeCoverPngFile({
  title,
  author,
  bg = "#3366AA",
  fontColor = "#FFFFFF",
  logoUrl,
  logoSize = 100,
  bgImageDataUrl,
  filename = "cover.png",
}: {
  title: string;
  author: string;
  bg?: string;
  fontColor?: string;
  logoUrl?: string;
  logoSize?: number;
  bgImageDataUrl?: string;
  filename?: string;
}): Promise<File> {
  const svg = await makeCoverSvg({ title, author, bg, fontColor, logoUrl, logoSize, bgImageDataUrl });
  const pngBlob = await svgToPngBlob(svg);
  return new File([pngBlob], filename, { type: "image/png" });
}
