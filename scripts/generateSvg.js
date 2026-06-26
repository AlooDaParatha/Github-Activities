/**
 * generateSvg.js
 * Converts GitHub contribution data into a styled LINE GRAPH SVG.
 * Supports: light, dark, cyberpunk, and high-contrast themes.
 * Smooth area chart with gradient fill, dots on peaks, month labels, stats bar.
 */

// ─── Theme Definitions ───────────────────────────────────────────────────────

export const THEMES = {
  light: {
    name: "light",
    background: "#ffffff",
    headerText: "#1f2328",
    labelText: "#57606a",
    statsText: "#57606a",
    lineColor: "#0969da",
    lineWidth: 2,
    dotColor: "#0969da",
    gradientFrom: "rgba(9,105,218,0.3)",
    gradientTo: "rgba(9,105,218,0)",
    gridColor: "rgba(27,31,35,0.08)",
    totalHighlight: "#0969da",
    glow: false,
  },
  dark: {
    name: "dark",
    background: "#0d1117",
    headerText: "#e6edf3",
    labelText: "#7d8590",
    statsText: "#7d8590",
    lineColor: "#58a6ff",
    lineWidth: 2,
    dotColor: "#58a6ff",
    gradientFrom: "rgba(88,166,255,0.25)",
    gradientTo: "rgba(88,166,255,0)",
    gridColor: "rgba(240,246,252,0.06)",
    totalHighlight: "#58a6ff",
    glow: false,
  },
  cyberpunk: {
    name: "cyberpunk",
    background: "#0a0a0f",
    headerText: "#00ffff",
    labelText: "#7f5af0",
    statsText: "#a786ff",
    lineColor: "#7f5af0",
    lineWidth: 2.5,
    dotColor: "#e040fb",
    gradientFrom: "rgba(127,90,240,0.4)",
    gradientTo: "rgba(127,90,240,0)",
    gridColor: "rgba(127,90,240,0.12)",
    totalHighlight: "#ff2d55",
    glow: true,
    glowColor: "#7f5af0",
  },
  "high-contrast": {
    name: "high-contrast",
    background: "#010409",
    headerText: "#f0f6fc",
    labelText: "#b3b3b3",
    statsText: "#b3b3b3",
    lineColor: "#79c0ff",
    lineWidth: 2,
    dotColor: "#79c0ff",
    gradientFrom: "rgba(121,192,255,0.25)",
    gradientTo: "rgba(121,192,255,0)",
    gridColor: "rgba(240,246,252,0.1)",
    totalHighlight: "#79c0ff",
    glow: false,
  },
};

// ─── Layout ───────────────────────────────────────────────────────────────────

const WIDTH = 800;
const HEIGHT = 200;
const PAD_TOP = 52;   // header
const PAD_BOTTOM = 52;   // stats
const PAD_LEFT = 40;
const PAD_RIGHT = 20;
const CHART_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const CHART_H = HEIGHT - PAD_TOP - PAD_BOTTOM;
const GRID_LINES = 4;

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

// Flatten weeks → daily totals
function flattenDays(weeks) {
  const days = [];
  for (const week of weeks) {
    for (const day of week.contributionDays) {
      days.push({ date: day.date, count: day.contributionCount });
    }
  }
  // sort by date ascending
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

// 7-day rolling average for a smoother line
function rollingAvg(days, window = 7) {
  return days.map((d, i) => {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(days.length - 1, i + Math.floor(window / 2));
    const slice = days.slice(start, end + 1);
    const avg = slice.reduce((s, x) => s + x.count, 0) / slice.length;
    return { ...d, smooth: avg };
  });
}

// Month label positions
function getMonthLabels(days) {
  const labels = [];
  let lastMonth = -1;
  days.forEach((d, i) => {
    const month = new Date(d.date + "T00:00:00Z").getUTCMonth();
    if (month !== lastMonth) {
      labels.push({
        x: (i / (days.length - 1)) * CHART_W,
        label: new Date(d.date + "T00:00:00Z").toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      });
      lastMonth = month;
    }
  });
  return labels;
}

// Convert data points → SVG polyline coordinates
function toPoints(days, maxCount) {
  if (maxCount === 0) maxCount = 1;
  return days.map((d, i) => {
    const x = PAD_LEFT + (i / (days.length - 1)) * CHART_W;
    const y = PAD_TOP + CHART_H - (d.smooth / maxCount) * CHART_H;
    return { x, y, raw: d };
  });
}

// Catmull-Rom smooth path
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

// Area path (line + close to bottom)
function areaPath(pts) {
  const bottom = PAD_TOP + CHART_H;
  const line = smoothPath(pts);
  return `${line} L ${pts[pts.length - 1].x.toFixed(1)},${bottom} L ${pts[0].x.toFixed(1)},${bottom} Z`;
}

// Find local peak dots (days where count is a local max above threshold)
function findPeaks(days, pts, threshold) {
  const peaks = [];
  for (let i = 1; i < days.length - 1; i++) {
    const prev = days[i - 1].smooth;
    const curr = days[i].smooth;
    const next = days[i + 1].smooth;
    if (curr >= prev && curr >= next && curr >= threshold) {
      peaks.push(pts[i]);
    }
  }
  // limit to top 12 peaks to avoid clutter
  return peaks
    .sort((a, b) => b.raw.count - a.raw.count)
    .slice(0, 12);
}

// ─── Main generator ──────────────────────────────────────────────────────────

export function generateSvg(data, opts = {}) {
  const themeName = opts.theme || "dark";
  const theme = THEMES[themeName] || THEMES.dark;
  const uid = Math.random().toString(36).slice(2, 7);

  const { calendar, summary, displayName, fetchedAt } = data;
  const days = rollingAvg(flattenDays(calendar.weeks));
  const maxCount = Math.max(...days.map(d => d.smooth), 1);
  const pts = toPoints(days, maxCount);
  const threshold = maxCount * 0.6;
  const peaks = findPeaks(days, pts, threshold);
  const monthLabels = getMonthLabels(days);

  const linePath = smoothPath(pts);
  const fillPath = areaPath(pts);

  // ── Glow filter ──
  const glowDefs = theme.glow ? `
  <filter id="glow-${uid}">
    <feGaussianBlur stdDeviation="3" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>` : "";

  // ── Gradient ──
  const gradientDefs = `
  <linearGradient id="area-${uid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="${theme.gradientFrom}"/>
    <stop offset="100%" stop-color="${theme.gradientTo}"/>
  </linearGradient>`;

  // ── Grid lines ──
  const gridSvg = Array.from({ length: GRID_LINES }, (_, i) => {
    const y = PAD_TOP + (CHART_H / GRID_LINES) * (i + 1);
    const val = Math.round(maxCount - (maxCount / GRID_LINES) * (i + 1));
    return `
  <line x1="${PAD_LEFT}" y1="${y.toFixed(1)}" x2="${WIDTH - PAD_RIGHT}" y2="${y.toFixed(1)}"
        stroke="${theme.gridColor}" stroke-width="1" stroke-dasharray="3,4"/>
  <text x="${PAD_LEFT - 4}" y="${(y + 4).toFixed(1)}" font-size="9" fill="${theme.labelText}"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" text-anchor="end">${val}</text>`;
  }).join("");

  // ── Month labels ──
  const monthSvg = monthLabels.map(({ x, label }) => `
  <text x="${(PAD_LEFT + x).toFixed(1)}" y="${PAD_TOP + CHART_H + 14}"
        font-size="10" fill="${theme.labelText}"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${label}</text>`
  ).join("");

  // ── Peak dots ──
  const dotsSvg = peaks.map(pt => `
  <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3"
          fill="${theme.dotColor}" ${theme.glow ? `filter="url(#glow-${uid})"` : ""}>
    <title>${pt.raw.count} contributions on ${formatDate(pt.raw.date)}</title>
  </circle>`).join("");

  // ── Stats bar ──
  const updatedAt = new Date(fetchedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const privateNote = summary.privateCount > 0
    ? ` (incl. ${summary.privateCount} private)` : "";

  const statsY = PAD_TOP + CHART_H + 30;
  const statsSvg = `
  <text x="${PAD_LEFT}" y="${statsY}"
        font-size="11" font-weight="600" fill="${theme.totalHighlight}"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    ${summary.total.toLocaleString()} contributions${escapeXml(privateNote)}
  </text>
  <text x="${PAD_LEFT}" y="${statsY + 15}"
        font-size="10" fill="${theme.statsText}"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    ${summary.commits} commits · ${summary.pullRequests} PRs · ${summary.issues} issues · ${summary.reviews} reviews
  </text>
  <text x="${WIDTH - PAD_RIGHT}" y="${statsY + 15}"
        font-size="10" fill="${theme.statsText}" text-anchor="end"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    Updated ${updatedAt}
  </text>`;

  // ── Axis baseline ──
  const baseY = PAD_TOP + CHART_H;
  const axisSvg = `
  <line x1="${PAD_LEFT}" y1="${baseY}" x2="${WIDTH - PAD_RIGHT}" y2="${baseY}"
        stroke="${theme.gridColor}" stroke-width="1"/>`;

  // ── Header ──
  const glowAttr = theme.glow ? `filter="url(#glow-${uid})"` : "";
  const headerSvg = `
  <text x="${PAD_LEFT}" y="32" font-size="14" font-weight="600" fill="${theme.headerText}"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" ${glowAttr}>
    ${escapeXml(displayName)}'s Contributions
  </text>`;

  return `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${WIDTH}" height="${HEIGHT}"
  viewBox="0 0 ${WIDTH} ${HEIGHT}"
  role="img"
  aria-label="${escapeXml(displayName)}'s GitHub contribution graph"
>
  <defs>
    ${gradientDefs}
    ${glowDefs}
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" rx="6" fill="${theme.background}"/>

  ${headerSvg}
  ${gridSvg}
  ${axisSvg}

  <!-- Area fill -->
  <path d="${fillPath}" fill="url(#area-${uid})"/>

  <!-- Line -->
  <path d="${linePath}" fill="none"
        stroke="${theme.lineColor}" stroke-width="${theme.lineWidth}"
        stroke-linejoin="round" stroke-linecap="round"
        ${theme.glow ? `filter="url(#glow-${uid})"` : ""}/>

  <!-- Peak dots -->
  ${dotsSvg}

  ${monthSvg}
  ${statsSvg}
</svg>`;
}

export function generatePictureSnippet(lightSvgPath, darkSvgPath) {
  return `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${darkSvgPath}">
  <source media="(prefers-color-scheme: light)" srcset="${lightSvgPath}">
  <img alt="GitHub Contribution Graph" src="${lightSvgPath}">
</picture>`;
}