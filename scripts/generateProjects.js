/**
 * generateProjects.js  —  Entry point for the project showcase
 * Usage:
 *   node scripts/generateProjects.js
 *   THEME=cyberpunk MAX_PROJECTS=4 node scripts/generateProjects.js
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchProjects } from "./fetchProjects.js";
import { generateProjectsSvg } from "./generateProjectsSvg.js";
import { THEMES } from "./generateSvg.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Config from environment ──────────────────────────────────────────────────
const USERNAME = process.env.GITHUB_USERNAME || process.env.GITHUB_ACTOR;
const TOKEN = process.env.GH_PRIVATE_TOKEN;
const THEME = process.env.THEME || "dark";
const MAX_PROJECTS = parseInt(process.env.MAX_PROJECTS || "6", 10);
const OUTPUT_DIR = join(ROOT, "output");

// ─── Validation ───────────────────────────────────────────────────────────────
if (!USERNAME) {
    console.error("❌ GITHUB_USERNAME is not set.");
    console.error("   Set it in your GitHub Actions workflow or .env file.");
    process.exit(1);
}

if (!TOKEN) {
    console.error("❌ GH_PRIVATE_TOKEN is not set.");
    console.error("   Create one at https://github.com/settings/tokens");
    process.exit(1);
}

if (!THEMES[THEME]) {
    console.error(`❌ Unknown theme: "${THEME}". Available: ${Object.keys(THEMES).join(", ")}`);
    process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n🗂️  GitHub Project Showcase Generator`);
    console.log(`   User:  @${USERNAME}`);
    console.log(`   Theme: ${THEME}`);
    console.log(`   Max:   ${MAX_PROJECTS} project(s)`);
    console.log("");

    // 1. Fetch pinned (or top starred) repositories
    const data = await fetchProjects(USERNAME, TOKEN, MAX_PROJECTS);

    // 2. Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`✓ Created output/ directory`);
    }

    // 3. Generate and write SVG
    const svg = generateProjectsSvg(data, { theme: THEME });
    const svgPath = join(OUTPUT_DIR, "projects.svg");
    writeFileSync(svgPath, svg, "utf8");
    console.log(`✓ Wrote ${THEME} SVG → output/projects.svg`);

    // 4. Print summary
    console.log(`\n📦 Project Summary:`);
    console.log(`   Source:   ${data.source === "pinned" ? "pinned repos" : "top starred repos (no pins found)"}`);
    console.log(`   Showing:  ${data.projects.length} repositories`);
    data.projects.forEach((p) => {
        console.log(`     • ${p.name}  ★${p.stars}  ⑂${p.forks}${p.language ? `  ${p.language}` : ""}`);
    });
    console.log(`\n✅ Done! Embed with:\n`);
    console.log(`   <img src="./output/projects.svg">\n`);
}

main().catch((err) => {
    console.error(`\n❌ Error: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
});