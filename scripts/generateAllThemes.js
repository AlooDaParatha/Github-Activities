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

const USERNAME = process.env.GITHUB_USERNAME || process.env.GITHUB_ACTOR;
const TOKEN = process.env.GH_PRIVATE_TOKEN;
const YEARS = parseInt(process.env.YEARS || "1", 10);
const MAX_PROJECTS = parseInt(process.env.MAX_PROJECTS || "6", 10);
// Set SKIP_PROJECTS=true to only regenerate the activity graph
const INCLUDE_PROJECTS = process.env.SKIP_PROJECTS !== "true";

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
  } else {
    console.log("\n⏭️  Skipping project showcase (SKIP_PROJECTS=true).");
  }

  console.log("\n✅ All themes generated.");
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});