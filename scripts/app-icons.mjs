// Draws the home-screen icons and the favicons from the hare (src/components/brand/hare-art.ts)
// and the FrenchTrack wordmark (public/brand/frenchtrack-light.png), on the cream page colour.
// Run after changing either: node scripts/app-icons.mjs (docs/DESIGN.md, "Icône de l'appli").
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

import { HARE_VIEW_BOX, hareSvg } from "../src/components/brand/hare-art.ts";

const ROOT = join(import.meta.dirname, "..");
const CREAM = "#fdfbf5";
const CANVAS = 512;

const wordmark = readFileSync(join(ROOT, "public/brand/frenchtrack-light.png"));
const WORDMARK_RATIO = 272 / 315; // width / height of the wordmark picture

/** Width / height of a hare variant, from its viewBox. */
function hareRatio(variant) {
  const [, , width, height] = HARE_VIEW_BOX[variant].split(" ").map(Number);
  return width / height;
}

/**
 * The hare above « FRENCH TRACK », centred on a 512 px cream square. `scale` is the share of the
 * 512 px the drawing may fill: 0.9 for the plain icon, less for the maskable one, whose launcher
 * may crop anything outside the central circle of 80 %.
 */
function iconSvg(scale) {
  const height = CANVAS * scale;
  const hareHeight = height * 0.52;
  const gap = height * 0.02;
  const wordHeight = height - hareHeight - gap;
  const hareWidth = hareHeight * hareRatio("full");
  const wordWidth = wordHeight * WORDMARK_RATIO;
  const top = (CANVAS - height) / 2;
  const hare = hareSvg("full").replace(
    "<svg ",
    `<svg x="${(CANVAS - hareWidth) / 2}" y="${top}" width="${hareWidth}" height="${hareHeight}" `,
  );
  const word = `<image x="${(CANVAS - wordWidth) / 2}" y="${top + hareHeight + gap}" width="${wordWidth}" height="${wordHeight}" href="data:image/png;base64,${wordmark.toString("base64")}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}"><rect width="100%" height="100%" fill="${CREAM}"/>${hare}${word}</svg>`;
}

/** The hare's head on a transparent background, for the browser tab. */
function faviconSvg() {
  return hareSvg("head").replace("<svg ", `<svg width="${CANVAS}" height="${CANVAS}" `);
}

async function png(svg, size) {
  return sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toBuffer();
}

/** A .ico holding PNG images (Windows Vista and every current browser read them). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(({ data }) => data)]);
}

const icon = iconSvg(0.9);
const maskable = iconSvg(0.66);
const favicon = faviconSvg();
const out = (name) => join(ROOT, "public", name);

writeFileSync(out("icons/icon-512.png"), await png(icon, 512));
writeFileSync(out("icons/icon-192.png"), await png(icon, 192));
writeFileSync(out("icons/apple-touch-icon.png"), await png(icon, 180));
writeFileSync(out("icons/icon-maskable-512.png"), await png(maskable, 512));
const favicons = [];
for (const size of [32, 16]) {
  const data = await png(favicon, size);
  writeFileSync(out(`icons/favicon-${size}.png`), data);
  favicons.push({ size, data });
}
writeFileSync(out("favicon.ico"), ico(favicons));
