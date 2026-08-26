/**
 * generateAllThemes.js
 * Generates one SVG per theme and writes a <picture> snippet for dark/light switching.
 * Run with: node scripts/generateAllThemes.js
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchContributions } from "./fetchContributions.js";
import { generateSvg, generatePictureSnippet, THEMES } from "./generateSvg.js";
import { fetchProjects } from "./fetchProjects.js";
import { generateProjectsSvg } from "./generateProjectsSvg.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(ROOT, "output");
const SNIPPETS_DIR = join(OUTPUT_DIR, "snippets");

const USERNAME = process.env.GITHUB_USERNAME || process.env.GITHUB_ACTOR;
const TOKEN = process.env.GH_PRIVATE_TOKEN;
const YEARS = parseInt(process.env.YEARS || "1", 10);
const MAX_PROJECTS = parseInt(process.env.MAX_PROJECTS || "6", 10);
// Set SKIP_PROJECTS=true to only regenerate the activity graph
const INCLUDE_PROJECTS = process.env.SKIP_PROJECTS !== "true";
// Set INDIVIDUAL_PROJECTS=true to generate individual card SVGs for each project
const INDIVIDUAL_PROJECTS = process.env.INDIVIDUAL_PROJECTS === "true";

// Helper functions for individual project cards
function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
    if (lines.length === 2) break;
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

const STAR_ICON = `<path d="M8 .5l2.245 4.55 5.02.73-3.632 3.54.857 5-4.49-2.36-4.49 2.36.857-5L.735 5.78l5.02-.73z"/>`;
const FORK_ICON = `<path d="M5 3.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0zm0 0v1.5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1.5m0 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0zM8 6.75V9.5a2 2 0 0 1-2 2H4.75m0 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z" fill="none" stroke="currentColor" stroke-width="1"/>`;
const LINK_ICON = `<path d="M6.5 3H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5M9 2h5v5M13.5 2.5l-6 6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`;
const CARD_WIDTH = 390;
const CARD_HEIGHT = 108;
const PAD = 14;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

function generateSingleCardSvg(project, themeName) {
  const baseTheme = THEMES[themeName] || THEMES.dark;
  const theme = {
    ...baseTheme,
    cardBg: themeName === "light" ? "#f6f8fa" : "rgba(255,255,255,0.03)",
    cardBorder: baseTheme.gridColor.replace(/[\d.]+\)$/, "0.5)"),
  };

  const { name, description, url, stars, forks, language, languageColor, homepageUrl } = project;
  const descLines = wrapText(description, 55);
  const linkTarget = homepageUrl || url;

  return `<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${CARD_WIDTH}" height="${CARD_HEIGHT}"
  viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}"
  role="img"
  aria-label="${escapeXml(name)}"
>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="8" fill="${theme.background}"/>

  <a href="${escapeXml(linkTarget)}" target="_blank">
    <g>
      <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="8"
            fill="${theme.cardBg}" stroke="${theme.cardBorder}" stroke-width="1"/>

      <g fill="${theme.headerText}">
        ${LINK_ICON.replace('fill="none"', `fill="none" transform="translate(${PAD},12) scale(0.85)"`)}
      </g>
      <text x="32" y="24" font-size="13" font-weight="600"
            fill="${theme.headerText}" font-family="${FONT}">${escapeXml(name)}</text>

      ${descLines.map((line, i) => `
      <text x="${PAD}" y="${44 + i * 15}" font-size="11"
            fill="${theme.labelText}" font-family="${FONT}">${escapeXml(line)}</text>`).join("")}

      ${language ? `
      <circle cx="${PAD + 4}" cy="${CARD_HEIGHT - 16}" r="5" fill="${languageColor}"/>
      <text x="${PAD + 14}" y="${CARD_HEIGHT - 12}" font-size="10.5" fill="${theme.statsText}"
            font-family="${FONT}">${escapeXml(language)}</text>` : ""}

      <g transform="translate(${CARD_WIDTH - 118}, ${CARD_HEIGHT - 19})" fill="${theme.labelText}">
        ${STAR_ICON}
        <text x="19" y="11" font-size="10.5" fill="${theme.statsText}" font-family="${FONT}">${formatCompact(stars)}</text>
      </g>
      <g transform="translate(${CARD_WIDTH - 56}, ${CARD_HEIGHT - 19})" fill="${theme.labelText}">
        ${FORK_ICON}
        <text x="19" y="11" font-size="10.5" fill="${theme.statsText}" font-family="${FONT}">${formatCompact(forks)}</text>
      </g>
    </g>
  </a>
</svg>`;
}

if (!USERNAME || !TOKEN) {
  console.error("❌ GITHUB_USERNAME and GH_PRIVATE_TOKEN must be set.");
  process.exit(1);
}

async function main() {
  console.log("🎨 Generating all themes…\n");

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  // Fetch once, reuse for all themes
  const data = await fetchContributions(USERNAME, TOKEN, YEARS);

  for (const [name] of Object.entries(THEMES)) {
    const svg = generateSvg(data, { theme: name });
    const path = join(OUTPUT_DIR, `activity-${name}.svg`);
    writeFileSync(path, svg, "utf8");
    console.log(`✓ output/activity-${name}.svg`);
  }

  // Also write the default (dark) as activity.svg for README backwards compat
  const defaultSvg = generateSvg(data, { theme: "dark" });
  writeFileSync(join(OUTPUT_DIR, "activity.svg"), defaultSvg, "utf8");
  console.log("✓ output/activity.svg (dark, default)");

  // Write picture snippet
  const snippet = generatePictureSnippet(
    "./output/activity-light.svg",
    "./output/activity-dark.svg"
  );
  writeFileSync(join(OUTPUT_DIR, "picture-snippet.html"), snippet, "utf8");
  console.log("✓ output/picture-snippet.html");

  // ── Project showcase ──
  if (INCLUDE_PROJECTS) {
    console.log("\n🗂️  Generating project showcase…\n");
    const projectData = await fetchProjects(USERNAME, TOKEN, MAX_PROJECTS);

    // 1. Generate normal collective grid SVGs
    for (const [name] of Object.entries(THEMES)) {
      const svg = generateProjectsSvg(projectData, { theme: name });
      const path = join(OUTPUT_DIR, `projects-${name}.svg`);
      writeFileSync(path, svg, "utf8");
      console.log(`✓ output/projects-${name}.svg`);
    }

    // Default (dark) as projects.svg for README backwards compat
    const defaultProjectsSvg = generateProjectsSvg(projectData, { theme: "dark" });
    writeFileSync(join(OUTPUT_DIR, "projects.svg"), defaultProjectsSvg, "utf8");
    console.log("✓ output/projects.svg (dark, default)");

    // 2. Generate individual cards if requested
    if (INDIVIDUAL_PROJECTS) {
      console.log("\n🎴 Generating individual project cards…\n");
      if (!existsSync(SNIPPETS_DIR)) mkdirSync(SNIPPETS_DIR, { recursive: true });

      for (const project of projectData.projects) {
        const projectId = project.id || project.name.toLowerCase().replace(/\s+/g, "-");
        console.log(`   • ${project.name} (id: ${projectId})`);

        for (const [themeName] of Object.entries(THEMES)) {
          const svg = generateSingleCardSvg(project, themeName);
          const filepath = join(OUTPUT_DIR, `project-${projectId}-${themeName}.svg`);
          writeFileSync(filepath, svg, "utf8");
        }

        // Generate default (dark) card for fallback img src
        const defaultCardSvg = generateSingleCardSvg(project, "dark");
        writeFileSync(join(OUTPUT_DIR, `project-${projectId}.svg`), defaultCardSvg, "utf8");

        // Write snippet
        const snippetHtml = `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/${USERNAME}/Github-Activities/main/output/project-${projectId}-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/${USERNAME}/Github-Activities/main/output/project-${projectId}-light.svg">
  <img alt="${escapeXml(project.name)}" src="https://raw.githubusercontent.com/${USERNAME}/Github-Activities/main/output/project-${projectId}.svg">
</picture>`;

        writeFileSync(join(SNIPPETS_DIR, `${projectId}.html`), snippetHtml, "utf8");
        console.log(`     ✓ Generated individual theme cards and snippet for @${projectId}`);
      }
    }
  } else {
    console.log("\n⏭️  Skipping project showcase (SKIP_PROJECTS=true).");
  }

  console.log("\n✅ All themes generated.");
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});