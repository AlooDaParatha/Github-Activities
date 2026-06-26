/**
 * index.js  —  Entry point
 * Usage:
 *   node scripts/index.js
 *   THEME=cyberpunk node scripts/index.js
 *   THEME=dark YEARS=1 node scripts/index.js
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchContributions } from "./fetchContributions.js";
import { generateSvg, THEMES } from "./generateSvg.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Config from environment ──────────────────────────────────────────────────
const USERNAME   = process.env.GITHUB_USERNAME || process.env.GITHUB_ACTOR;
const TOKEN      = process.env.GH_PRIVATE_TOKEN;
const THEME      = process.env.THEME || "dark";
const YEARS      = parseInt(process.env.YEARS || "1", 10);
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
  console.error("   Required scope: read:user");
  process.exit(1);
}

if (!THEMES[THEME]) {
  console.error(`❌ Unknown theme: "${THEME}". Available: ${Object.keys(THEMES).join(", ")}`);
  process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 GitHub Activity Graph Generator`);
  console.log(`   User:  @${USERNAME}`);
  console.log(`   Theme: ${THEME}`);
  console.log(`   Years: ${YEARS}`);
  console.log("");

  // 1. Fetch contribution data from GitHub GraphQL API
  const data = await fetchContributions(USERNAME, TOKEN, YEARS);

  // 2. Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✓ Created output/ directory`);
  }

  // 3. Generate and write SVG
  const svg = generateSvg(data, { theme: THEME });
  const svgPath = join(OUTPUT_DIR, "activity.svg");
  writeFileSync(svgPath, svg, "utf8");
  console.log(`✓ Wrote ${THEME} SVG → output/activity.svg`);

  // 4. Print summary
  const { summary } = data;
  console.log(`\n📊 Contribution Summary:`);
  console.log(`   Total:       ${summary.total.toLocaleString()}`);
  console.log(`   Commits:     ${summary.commits.toLocaleString()}`);
  console.log(`   Pull Reqs:   ${summary.pullRequests.toLocaleString()}`);
  console.log(`   Issues:      ${summary.issues.toLocaleString()}`);
  console.log(`   Reviews:     ${summary.reviews.toLocaleString()}`);
  if (summary.privateCount > 0) {
    console.log(`   Private:     ${summary.privateCount.toLocaleString()} (anonymized)`);
  }
  console.log(`\n✅ Done! Embed with:\n`);
  console.log(`   <img src="./output/activity.svg">\n`);
}

main().catch((err) => {
  console.error(`\n❌ Error: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
