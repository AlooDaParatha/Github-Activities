/**
 * generateSvg.js
 * Converts GitHub contribution data into a styled SVG.
 * Supports: light, dark, cyberpunk, and high-contrast themes.
 * Hover tooltips, animated glow, month/weekday labels, summary stats.
 */

// ─── Theme Definitions ───────────────────────────────────────────────────────

export const THEMES = {
  light: {
    name: "light",
    background: "#ffffff",
    headerText: "#1f2328",
    labelText: "#57606a",
    statsText: "#57606a",
    emptyCellFill: "#ebedf0",
    emptyCellStroke: "rgba(27,31,35,0.06)",
    tooltipBg: "#1f2328",
    tooltipText: "#ffffff",
    totalHighlight: "#0969da",
    glow: false,
    animated: false,
  },
  dark: {
    name: "dark",
    background: "#0d1117",
    headerText: "#e6edf3",
    labelText: "#7d8590",
    statsText: "#7d8590",
    emptyCellFill: "#161b22",
    emptyCellStroke: "rgba(240,246,252,0.06)",
    tooltipBg: "#e6edf3",
    tooltipText: "#0d1117",
    totalHighlight: "#58a6ff",
    glow: false,
    animated: false,
  },
  cyberpunk: {
    name: "cyberpunk",
    background: "#0a0a0f",
    headerText: "#00ffff",
    labelText: "#7f5af0",
    statsText: "#a786ff",
    emptyCellFill: "#111118",
    emptyCellStroke: "rgba(127,90,240,0.2)",
    tooltipBg: "#0a0a0f",
    tooltipText: "#00ffff",
    totalHighlight: "#ff2d55",
    glow: true,
    animated: true,
    glowColor: "#7f5af0",
    // Override contribution colors with neon palette
    colorOverride: ["#111118", "#2d004f", "#7f5af0", "#c77dff", "#e040fb"],
  },
  "high-contrast": {
    name: "high-contrast",
    background: "#010409",
    headerText: "#f0f6fc",
    labelText: "#b3b3b3",
    statsText: "#b3b3b3",
    emptyCellFill: "#21262d",
    emptyCellStroke: "rgba(240,246,252,0.1)",
    tooltipBg: "#f0f6fc",
    tooltipText: "#010409",
    totalHighlight: "#79c0ff",
    glow: false,
    animated: false,
  },
};

// ─── Layout Constants ─────────────────────────────────────────────────────────

const CELL_SIZE = 11;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const WEEK_LABEL_WIDTH = 28;
const MONTH_LABEL_HEIGHT = 20;
const PADDING_TOP = 50;      // space for header
const PADDING_BOTTOM = 48;   // space for stats
const PADDING_LEFT = 16;
const PADDING_RIGHT = 16;

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getMonthLabels(weeks) {
  const labels = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const d = new Date(week.firstDay + "T00:00:00Z");
    const month = d.getUTCMonth();
    if (month !== lastMonth) {
      labels.push({ x: wi * CELL_STEP, label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }) });
      lastMonth = month;
    }
  });
  return labels;
}

// ─── CSS / Defs builder ───────────────────────────────────────────────────────

function buildDefs(theme, uniqueId) {
  const glowFilter = theme.glow
    ? `
  <filter id="glow-${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <filter id="glow-strong-${uniqueId}" x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>`
    : "";

  const animation = theme.animated
    ? `
  <style>
    @keyframes pulse-${uniqueId} {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    @keyframes scanline-${uniqueId} {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100vh); }
    }
    .cell-active-${uniqueId} {
      animation: pulse-${uniqueId} 3s ease-in-out infinite;
    }
    .cell-active-${uniqueId}:hover {
      animation: none;
      opacity: 1 !important;
    }
  </style>`
    : `
  <style>
    .contribution-cell-${uniqueId}:hover rect {
      stroke: ${theme.headerText};
      stroke-width: 1px;
    }
  </style>`;

  return `<defs>${glowFilter}\n${animation}</defs>`;
}

// ─── Cell builder ─────────────────────────────────────────────────────────────

function buildCell({ day, x, y, theme, uniqueId, colors }) {
  const count = day.contributionCount;
  const isEmpty = count === 0;

  // Pick fill color — theme may override GitHub's palette
  let fill, stroke;
  if (isEmpty) {
    fill = theme.emptyCellFill;
    stroke = theme.emptyCellStroke;
  } else if (theme.colorOverride) {
    // Map GitHub's 0–4 levels to theme's 5-stop palette
    const level = colors.indexOf(day.color);
    const idx = level >= 0 ? Math.min(level, theme.colorOverride.length - 1) : theme.colorOverride.length - 1;
    fill = theme.colorOverride[idx] || theme.colorOverride[theme.colorOverride.length - 1];
    stroke = "none";
  } else {
    fill = day.color;
    stroke = "none";
  }

  const tooltip = `${count} contribution${count !== 1 ? "s" : ""} on ${formatDate(day.date)}`;
  const glowAttr = theme.glow && !isEmpty
    ? `filter="url(#glow-${uniqueId})" class="cell-active-${uniqueId}"`
    : `class="contribution-cell-${uniqueId}"`;

  return `
  <g ${glowAttr} transform="translate(${x},${y})">
    <rect
      width="${CELL_SIZE}"
      height="${CELL_SIZE}"
      rx="2"
      ry="2"
      fill="${fill}"
      stroke="${stroke}"
      stroke-width="1"
      data-count="${count}"
      data-date="${day.date}"
    />
    <title>${escapeXml(tooltip)}</title>
  </g>`;
}

// ─── Main SVG generator ───────────────────────────────────────────────────────

/**
 * Generates an SVG contribution graph.
 * @param {Object} data   - Output from fetchContributions()
 * @param {Object} [opts] - Options: theme, width
 * @returns {string} SVG markup
 */
export function generateSvg(data, opts = {}) {
  const themeName = opts.theme || "dark";
  const theme = THEMES[themeName] || THEMES.dark;
  const uniqueId = Math.random().toString(36).slice(2, 8);

  const { calendar, summary, displayName, fetchedAt } = data;
  const weeks = calendar.weeks;
  const colors = theme.colorOverride || calendar.colors;

  // ── Dimensions ──
  const graphWidth = weeks.length * CELL_STEP - CELL_GAP;
  const graphHeight = 7 * CELL_STEP - CELL_GAP;

  const innerWidth = WEEK_LABEL_WIDTH + graphWidth;
  const totalWidth = PADDING_LEFT + innerWidth + PADDING_RIGHT;
  const totalHeight = PADDING_TOP + MONTH_LABEL_HEIGHT + graphHeight + PADDING_BOTTOM;

  const graphX = PADDING_LEFT + WEEK_LABEL_WIDTH;
  const graphY = PADDING_TOP + MONTH_LABEL_HEIGHT;

  // ── Month labels ──
  const monthLabels = getMonthLabels(weeks);
  const monthLabelsSvg = monthLabels
    .map(
      ({ x, label }) =>
        `<text x="${graphX + x}" y="${PADDING_TOP + 13}" font-size="10" fill="${theme.labelText}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${label}</text>`
    )
    .join("\n  ");

  // ── Weekday labels ──
  const weekdayLabelsSvg = DAY_LABELS.map((label, i) => {
    if (!label) return "";
    return `<text x="${PADDING_LEFT + 0}" y="${graphY + i * CELL_STEP + CELL_SIZE - 1}" font-size="9" fill="${theme.labelText}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" text-anchor="start">${label}</text>`;
  }).join("\n  ");

  // ── Cells ──
  const cellsSvg = weeks
    .map((week, wi) => {
      return week.contributionDays
        .map((day) => {
          const x = graphX + wi * CELL_STEP;
          const y = graphY + day.weekday * CELL_STEP;
          return buildCell({ day, x, y, theme, uniqueId, colors });
        })
        .join("");
    })
    .join("");

  // ── Header ──
  const glowAttr = theme.glow
    ? `filter="url(#glow-strong-${uniqueId})"`
    : "";
  const headerSvg = `
  <text x="${PADDING_LEFT}" y="${PADDING_TOP - 12}" font-size="14" font-weight="600" fill="${theme.headerText}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" ${glowAttr}>${escapeXml(displayName)}'s Contributions</text>`;

  // ── Stats bar ──
  const statsY = graphY + graphHeight + 18;
  const updatedAt = new Date(fetchedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });

  const privateNote = summary.privateCount > 0
    ? ` (incl. ${summary.privateCount} private)`
    : "";

  const statsSvg = `
  <text x="${PADDING_LEFT}" y="${statsY}" font-size="11" fill="${theme.totalHighlight}" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
    ${summary.total.toLocaleString()} contributions${privateNote}
  </text>
  <text x="${PADDING_LEFT}" y="${statsY + 16}" font-size="10" fill="${theme.statsText}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
    ${summary.commits} commits · ${summary.pullRequests} PRs · ${summary.issues} issues · ${summary.reviews} reviews
  </text>
  <text x="${totalWidth - PADDING_RIGHT}" y="${statsY + 16}" font-size="10" fill="${theme.statsText}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" text-anchor="end">
    Updated ${updatedAt}
  </text>`;

  // ── Legend ──
  const legendX = totalWidth - PADDING_RIGHT - (colors.length * (CELL_SIZE + 4)) - 30;
  const legendY = statsY - 1;
  const legendCells = colors
    .map((c, i) => `<rect x="${legendX + i * (CELL_SIZE + 3)}" y="${legendY}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" fill="${c}"/>`)
    .join("");
  const legendSvg = `
  <text x="${legendX - 4}" y="${legendY + CELL_SIZE - 1}" font-size="10" fill="${theme.statsText}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" text-anchor="end">Less</text>
  ${legendCells}
  <text x="${legendX + colors.length * (CELL_SIZE + 3) + 2}" y="${legendY + CELL_SIZE - 1}" font-size="10" fill="${theme.statsText}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">More</text>`;

  // ── Cyberpunk scanline overlay ──
  const cyberpunkOverlay = theme.animated
    ? `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="url(#scanline-${uniqueId})" opacity="0.03" pointer-events="none"/>`
    : "";

  const defs = buildDefs(theme, uniqueId);

  return `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${totalWidth}"
  height="${totalHeight}"
  viewBox="0 0 ${totalWidth} ${totalHeight}"
  role="img"
  aria-label="${escapeXml(displayName)}'s GitHub contribution graph"
>
  ${defs}
  <!-- Background -->
  <rect width="${totalWidth}" height="${totalHeight}" rx="6" fill="${theme.background}"/>
  ${cyberpunkOverlay}
  <!-- Header -->
  ${headerSvg}
  <!-- Month labels -->
  ${monthLabelsSvg}
  <!-- Weekday labels -->
  ${weekdayLabelsSvg}
  <!-- Contribution cells -->
  ${cellsSvg}
  <!-- Stats -->
  ${statsSvg}
  <!-- Legend -->
  ${legendSvg}
</svg>`;
}

/**
 * Wraps two theme SVGs in a <picture> element for GitHub dark/light switching.
 * @param {string} lightSvgPath - Repo-relative path to light SVG
 * @param {string} darkSvgPath  - Repo-relative path to dark SVG
 * @returns {string} HTML snippet
 */
export function generatePictureSnippet(lightSvgPath, darkSvgPath) {
  return `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${darkSvgPath}">
  <source media="(prefers-color-scheme: light)" srcset="${lightSvgPath}">
  <img alt="GitHub Contribution Graph" src="${lightSvgPath}">
</picture>`;
}
