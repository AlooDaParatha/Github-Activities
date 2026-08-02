/**
 * generateProjectsSvg.js
 * Renders a user's showcased repositories as a themed card-grid SVG.
 * Shares the same 4 themes as generateSvg.js so both graphs look native together.
 */

import { THEMES } from "./generateSvg.js";

// ─── Layout ───────────────────────────────────────────────────────────────────

const WIDTH = 800;
const PAD = 20;
const HEADER_H = 44;
const FOOTER_H = 26;
const GAP = 14;
const COLUMNS = 2;
const CARD_H = 108;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

function escapeXml(s) {
    return String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Rough character-width wrap (SVG has no native text wrapping)
function wrapText(text, maxChars) {
    if (!text) return [];
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxChars) {
            if (current) lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
        if (lines.length === 2) break; // hard cap at 2 lines, ellipsis handled below
    }
    if (current && lines.length < 2) lines.push(current);

    if (lines.length === 2 && words.join(" ").length > lines.join(" ").length) {
        const last = lines[1];
        lines[1] = last.length > 3 ? `${last.slice(0, last.length - 1)}…` : last;
    }
    return lines;
}

function formatCompact(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(n);
}

// ─── Icons (inline paths, currentColor) ───────────────────────────────────────

const STAR_ICON = `<path d="M8 .5l2.245 4.55 5.02.73-3.632 3.54.857 5-4.49-2.36-4.49 2.36.857-5L.735 5.78l5.02-.73z"/>`;
const FORK_ICON = `<path d="M5 3.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0zm0 0v1.5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1.5m0 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0zM8 6.75V9.5a2 2 0 0 1-2 2H4.75m0 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z" fill="none" stroke="currentColor" stroke-width="1"/>`;
const LINK_ICON = `<path d="M6.5 3H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5M9 2h5v5M13.5 2.5l-6 6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`;

// ─── Card ──────────────────────────────────────────────────────────────────────

function renderCard(project, x, y, w, h, theme) {
    const { name, description, url, stars, forks, language, languageColor, homepageUrl } = project;
    const descLines = wrapText(description, Math.floor(w / 6.4));
    const linkTarget = homepageUrl || url;

    return `
  <a href="${escapeXml(linkTarget)}" target="_blank">
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"
          fill="${theme.cardBg}" stroke="${theme.cardBorder}" stroke-width="1"/>

    <!-- repo name -->
    <g fill="${theme.headerText}">
      ${LINK_ICON.replace('fill="none"', `fill="none" transform="translate(${x + 14},${y + 12}) scale(0.85)"`)}
    </g>
    <text x="${x + 32}" y="${y + 24}" font-size="13" font-weight="600"
          fill="${theme.headerText}" font-family="${FONT}">${escapeXml(name)}</text>

    <!-- description (up to 2 lines) -->
    ${descLines.map((line, i) => `
    <text x="${x + 14}" y="${y + 44 + i * 15}" font-size="11"
          fill="${theme.labelText}" font-family="${FONT}">${escapeXml(line)}</text>`).join("")}

    <!-- language pill -->
    ${language ? `
    <circle cx="${x + 18}" cy="${y + h - 16}" r="5" fill="${languageColor}"/>
    <text x="${x + 28}" y="${y + h - 12}" font-size="10.5" fill="${theme.statsText}"
          font-family="${FONT}">${escapeXml(language)}</text>` : ""}

    <!-- stats -->
    <g transform="translate(${x + w - 118}, ${y + h - 19})" fill="${theme.labelText}">
      ${STAR_ICON}
      <text x="19" y="11" font-size="10.5" fill="${theme.statsText}" font-family="${FONT}">${formatCompact(stars)}</text>
    </g>
    <g transform="translate(${x + w - 56}, ${y + h - 19})" fill="${theme.labelText}">
      ${FORK_ICON}
      <text x="19" y="11" font-size="10.5" fill="${theme.statsText}" font-family="${FONT}">${formatCompact(forks)}</text>
    </g>
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
  <text x="${WIDTH / 2}" y="${HEADER_H + 50}" font-size="12" fill="${theme.labelText}"
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