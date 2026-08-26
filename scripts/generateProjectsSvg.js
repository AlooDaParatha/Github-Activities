/**
 * generateProjectsSvg.js
 * Renders a user's showcased repositories as a themed card grid SVG.
 * Each card shows ONLY the repository name (clickable) — no description,
 * language, or stats — to keep the widget compact and scannable.
 * Shares the same 4 themes as generateSvg.js so both graphs look native together.
 */

import { THEMES } from "./generateSvg.js";

// ─── Layout ───────────────────────────────────────────────────────────────────

const WIDTH = 800;
const PAD = 20;
const HEADER_H = 44;
const FOOTER_H = 26;
const GAP = 12;
const COLUMNS = 3;
const CARD_H = 52;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Truncate a repo name so it never overflows a single-line card
function truncate(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

// ─── Icon (inline path, currentColor) ──────────────────────────────────────────

const LINK_ICON = `<path d="M6.5 3H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5M9 2h5v5M13.5 2.5l-6 6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`;

// ─── Card ──────────────────────────────────────────────────────────────────────

function renderCard(project, x, y, w, h, theme) {
  const { name, url, homepageUrl } = project;
  const linkTarget = homepageUrl || url;
  // Rough char budget for the available card width, accounting for the icon + padding
  const maxChars = Math.max(6, Math.floor((w - 40) / 7.2));
  const label = truncate(name, maxChars);

  return `
  <a href="${escapeXml(linkTarget)}" target="_blank">
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"
          fill="${theme.cardBg}" stroke="${theme.cardBorder}" stroke-width="1"/>

    <g fill="${theme.headerText}" transform="translate(${x + 14},${y + h / 2 - 7}) scale(0.85)">
      ${LINK_ICON}
    </g>
    <text x="${x + 32}" y="${y + h / 2 + 4}" font-size="13" font-weight="600"
          fill="${theme.headerText}" font-family="${FONT}">${escapeXml(label)}</text>
  </g>
  </a>`;
}

// ─── Main generator ──────────────────────────────────────────────────────────

export function generateProjectsSvg(data, opts = {}) {
  const themeName = opts.theme || "dark";
  const baseTheme = THEMES[themeName] || THEMES.dark;

  // Extend base theme with card-specific colors (kept close to background/text tones)
  const theme = {
    ...baseTheme,
    cardBg: opts.cardBg || (themeName === "light" ? "#f6f8fa" : "rgba(255,255,255,0.03)"),
    cardBorder: opts.cardBorder || baseTheme.gridColor.replace(/[\d.]+\)$/, "0.5)"),
  };

  const { username, projects, fetchedAt } = data;
  const rows = Math.max(1, Math.ceil(projects.length / COLUMNS));
  const HEIGHT = HEADER_H + rows * CARD_H + (rows - 1) * GAP + FOOTER_H + PAD;

  const cardW = (WIDTH - PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const cardsSvg = projects.map((project, i) => {
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);
    const x = PAD + col * (cardW + GAP);
    const y = HEADER_H + row * (CARD_H + GAP);
    return renderCard(project, x, y, cardW, CARD_H, theme);
  }).join("");

  const emptyStateSvg = projects.length === 0 ? `
  <text x="${WIDTH / 2}" y="${HEADER_H + 30}" font-size="12" fill="${theme.labelText}"
        text-anchor="middle" font-family="${FONT}">No public repositories to show yet.</text>` : "";

  const updatedAt = new Date(fetchedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return `<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${WIDTH}" height="${HEIGHT}"
  viewBox="0 0 ${WIDTH} ${HEIGHT}"
  role="img"
  aria-label="${escapeXml(username)}'s pinned GitHub projects"
>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="6" fill="${theme.background}"/>

  <text x="${PAD}" y="28" font-size="14" font-weight="600" fill="${theme.headerText}"
        font-family="${FONT}">${escapeXml(username)}'s Projects</text>

  ${cardsSvg}
  ${emptyStateSvg}

  <text x="${WIDTH - PAD}" y="${HEIGHT - 8}" font-size="9.5" fill="${theme.statsText}"
        text-anchor="end" font-family="${FONT}">Updated ${updatedAt}</text>
</svg>`;
}
