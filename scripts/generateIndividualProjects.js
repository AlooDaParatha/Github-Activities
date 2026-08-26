/**
 * generateIndividualProjects.js
 * Generates individual SVG cards for each project (one card per SVG file).
 * Each project gets one SVG per theme (dark, light, cyberpunk, minimal).
 * Usage:
 *   node scripts/generateIndividualProjects.js
 *   USE_MANUAL_CONFIG=true node scripts/generateIndividualProjects.js
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchProjects } from "./fetchProjects.js";
import { THEMES } from "./generateSvg.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Config ───────────────────────────────────────────────────────────────────
const USERNAME = process.env.GITHUB_USERNAME || process.env.GITHUB_ACTOR;
const TOKEN = process.env.GH_PRIVATE_TOKEN;
const MAX_PROJECTS = parseInt(process.env.MAX_PROJECTS || "12", 10);
const OUTPUT_DIR = join(ROOT, "output");
const SNIPPETS_DIR = join(OUTPUT_DIR, "snippets");

// ─── Card Layout Constants ────────────────────────────────────────────────────
const CARD_WIDTH = 390;
const CARD_HEIGHT = 108;
const PAD = 14;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

// ─── Utility Functions ────────────────────────────────────────────────────────
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

// ─── Icons ────────────────────────────────────────────────────────────────────
const STAR_ICON = `<path d="M8 .5l2.245 4.55 5.02.73-3.632 3.54.857 5-4.49-2.36-4.49 2.36.857-5L.735 5.78l5.02-.73z"/>`;
const FORK_ICON = `<path d="M5 3.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0zm0 0v1.5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1.5m0 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0zM8 6.75V9.5a2 2 0 0 1-2 2H4.75m0 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z" fill="none" stroke="currentColor" stroke-width="1"/>`;
const LINK_ICON = `<path d="M6.5 3H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5M9 2h5v5M13.5 2.5l-6 6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`;

// ─── Single Card SVG Generator ────────────────────────────────────────────────
function generateSingleCardSvg(project, themeName) {
    const baseTheme = THEMES[themeName] || THEMES.dark;

    // Extend base theme with card-specific colors
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

      <!-- repo name with link icon -->
      <g fill="${theme.headerText}">
        ${LINK_ICON.replace('fill="none"', `fill="none" transform="translate(${PAD},12) scale(0.85)"`)}
      </g>
      <text x="32" y="24" font-size="13" font-weight="600"
            fill="${theme.headerText}" font-family="${FONT}">${escapeXml(name)}</text>

      <!-- description (up to 2 lines) -->
      ${descLines.map((line, i) => `
      <text x="${PAD}" y="${44 + i * 15}" font-size="11"
            fill="${theme.labelText}" font-family="${FONT}">${escapeXml(line)}</text>`).join("")}

      <!-- language pill -->
      ${language ? `
      <circle cx="${PAD + 4}" cy="${CARD_HEIGHT - 16}" r="5" fill="${languageColor}"/>
      <text x="${PAD + 14}" y="${CARD_HEIGHT - 12}" font-size="10.5" fill="${theme.statsText}"
            font-family="${FONT}">${escapeXml(language)}</text>` : ""}

      <!-- stats (stars and forks) -->
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

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n🎴 GitHub Individual Project Card Generator`);
    console.log(`   User:  @${USERNAME || "User"}`);
    console.log(`   Max:   ${MAX_PROJECTS} project(s)`);
    console.log("");

    // 1. Fetch projects (from config or API)
    const data = await fetchProjects(USERNAME, TOKEN, MAX_PROJECTS);

    if (data.projects.length === 0) {
        console.log("⚠️  No projects to generate. Exiting.");
        return;
    }

    // 2. Ensure output directories exist
    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`✓ Created output/ directory`);
    }
    if (!existsSync(SNIPPETS_DIR)) {
        mkdirSync(SNIPPETS_DIR, { recursive: true });
        console.log(`✓ Created output/snippets/ directory`);
    }

    // 3. Generate individual cards for each project × each theme
    console.log(`\n📦 Generating individual cards:\n`);

    for (const project of data.projects) {
        const projectId = project.id || project.name.toLowerCase().replace(/\s+/g, "-");
        console.log(`   • ${project.name} (id: ${projectId})`);

        for (const [themeName] of Object.entries(THEMES)) {
            const svg = generateSingleCardSvg(project, themeName);
            const filename = `project-${projectId}-${themeName}.svg`;
            const filepath = join(OUTPUT_DIR, filename);
            writeFileSync(filepath, svg, "utf8");
        }

        // Generate picture snippet HTML
        const snippetHtml = `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./output/project-${projectId}-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./output/project-${projectId}-light.svg">
  <img alt="${escapeXml(project.name)}" src="./output/project-${projectId}-dark.svg">
</picture>`;

        const snippetPath = join(SNIPPETS_DIR, `${projectId}.html`);
        writeFileSync(snippetPath, snippetHtml, "utf8");

        console.log(`     ✓ Generated ${Object.keys(THEMES).length} theme SVGs + snippet`);
    }

    // 4. Print summary
    console.log(`\n✅ Done!`);
    console.log(`   Generated: ${data.projects.length} projects × ${Object.keys(THEMES).length} themes = ${data.projects.length * Object.keys(THEMES).length} SVG files`);
    console.log(`   Snippets:  output/snippets/{project-id}.html`);
    console.log(`\n📝 Usage example:\n`);
    console.log(`   <picture>`);
    console.log(`     <source media="(prefers-color-scheme: dark)" srcset="./output/project-{id}-dark.svg">`);
    console.log(`     <source media="(prefers-color-scheme: light)" srcset="./output/project-{id}-light.svg">`);
    console.log(`     <img alt="Project Name" src="./output/project-{id}-dark.svg">`);
    console.log(`   </picture>\n`);
}

main().catch((err) => {
    console.error(`\n❌ Error: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
});
