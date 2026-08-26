/**
 * fetchProjects.js
 * Fetches a user's showcased repositories from the GitHub GraphQL API.
 * Prefers the repos the user has manually pinned on their profile (pinnedItems).
 * Falls back to their top repositories by star count if nothing is pinned.
 *
 * NEW: Supports manual configuration via projects-config.json when USE_MANUAL_CONFIG=true
 */

import fetch from "node-fetch";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONFIG_PATH = join(ROOT, "projects-config.json");

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

const PINNED_QUERY = `
  query PinnedRepos($username: String!, $count: Int!) {
    user(login: $username) {
      pinnedItems(first: $count, types: REPOSITORY) {
        totalCount
        nodes {
          ... on Repository {
            name
            description
            url
            homepageUrl
            isPrivate
            isArchived
            stargazerCount
            forkCount
            primaryLanguage { name color }
            updatedAt
          }
        }
      }
    }
  }
`;

const TOP_REPOS_QUERY = `
  query TopRepos($username: String!, $count: Int!) {
    user(login: $username) {
      repositories(
        first: $count
        ownerAffiliations: OWNER
        privacy: PUBLIC
        isFork: false
        orderBy: { field: STARGAZERS, direction: DESC }
      ) {
        nodes {
          name
          description
          url
          homepageUrl
          isPrivate
          isArchived
          stargazerCount
          forkCount
          primaryLanguage { name color }
          updatedAt
        }
      }
    }
  }
`;

async function graphql(query, variables, token) {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "github-activity-graph/1.0",
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        throw new Error(
            `GitHub API returned HTTP ${response.status}: ${response.statusText}\n` +
            "Check that your GH_PRIVATE_TOKEN is valid and not expired."
        );
    }

    const json = await response.json();

    if (json.errors && json.errors.length > 0) {
        const messages = json.errors.map((e) => e.message).join("\n  ");
        throw new Error(`GitHub GraphQL errors:\n  ${messages}`);
    }

    return json.data;
}

/**
 * Normalize a raw GraphQL repository node into the shape generateProjectsSvg.js expects.
 */
function normalizeRepo(repo) {
    return {
        name: repo.name,
        description: repo.description || "",
        url: repo.url,
        homepageUrl: repo.homepageUrl || null,
        stars: repo.stargazerCount ?? 0,
        forks: repo.forkCount ?? 0,
        language: repo.primaryLanguage?.name || null,
        languageColor: repo.primaryLanguage?.color || "#8b949e",
        isArchived: !!repo.isArchived,
        updatedAt: repo.updatedAt,
    };
}

/**
 * Loads projects from the manual config file (projects-config.json).
 */
function loadManualConfig() {
    if (!existsSync(CONFIG_PATH)) {
        throw new Error(
            `projects-config.json not found at ${CONFIG_PATH}.\n` +
            "Create one with manual project definitions or set USE_MANUAL_CONFIG=false."
        );
    }

    let config;
    try {
        const raw = readFileSync(CONFIG_PATH, "utf8");
        config = JSON.parse(raw);
    } catch (err) {
        throw new Error(
            `Failed to parse projects-config.json: ${err.message}\n` +
            "Ensure it's valid JSON."
        );
    }

    if (!Array.isArray(config.projects)) {
        throw new Error(
            'projects-config.json must have a "projects" array at the root.'
        );
    }

    // Validate required fields
    config.projects.forEach((proj, idx) => {
        const required = ["id", "name", "url"];
        for (const field of required) {
            if (!proj[field]) {
                throw new Error(
                    `Project at index ${idx} is missing required field: "${field}"`
                );
            }
        }
        // Ensure numeric fields are numbers
        proj.stars = proj.stars ?? 0;
        proj.forks = proj.forks ?? 0;
        proj.description = proj.description || "";
        proj.language = proj.language || null;
        proj.languageColor = proj.languageColor || "#8b949e";
        proj.homepageUrl = proj.homepageUrl || null;
        proj.isArchived = proj.isArchived ?? false;
        proj.updatedAt = proj.updatedAt || new Date().toISOString();
    });

    return config.projects;
}

/**
 * Fetches the repositories to showcase on a profile page.
 * @param {string} username - GitHub username
 * @param {string} token    - GitHub Personal Access Token (public_repo / read:user scope)
 * @param {number} [count=6] - Max number of projects to fetch (1–12)
 * @returns {Promise<Object>} { username, projects, source, fetchedAt }
 */
export async function fetchProjects(username, token, count = 6) {
    const useManualConfig = process.env.USE_MANUAL_CONFIG === "true";

    // Manual config mode
    if (useManualConfig) {
        console.log("Using manual configuration from projects-config.json…");
        const projects = loadManualConfig();
        const safeCount = Math.min(Math.max(parseInt(count, 10) || 6, 1), 12);
        const limited = projects.slice(0, safeCount);

        console.log(`✓ Loaded ${limited.length} project(s) from config (source: manual)`);

        return {
            username: username || "User",
            projects: limited,
            source: "manual-config",
            fetchedAt: new Date().toISOString(),
        };
    }

    // GitHub API mode (original behavior)
    if (!token) {
        throw new Error(
            "GH_PRIVATE_TOKEN is not set. " +
            "Create a token at https://github.com/settings/tokens."
        );
    }

    if (!username) {
        throw new Error(
            "GITHUB_USERNAME is not set. " +
            "Add your GitHub username to the workflow or .env file."
        );
    }

    const safeCount = Math.min(Math.max(parseInt(count, 10) || 6, 1), 12);

    console.log(`Fetching pinned repositories for @${username}…`);
    const pinnedData = await graphql(PINNED_QUERY, { username, count: safeCount }, token);

    if (!pinnedData?.user) {
        throw new Error(
            `User "@${username}" not found or token lacks required scope.`
        );
    }

    let nodes = pinnedData.user.pinnedItems.nodes || [];
    let source = "pinned";

    // Fallback: nothing pinned → use top starred repos instead
    if (nodes.length === 0) {
        console.log(`  ↳ No pinned repos found, falling back to top starred repos…`);
        const topData = await graphql(TOP_REPOS_QUERY, { username, count: safeCount }, token);
        nodes = topData?.user?.repositories?.nodes || [];
        source = "top-starred";
    }

    // Never show archived repos in the showcase
    const projects = nodes
        .filter((r) => !r.isArchived)
        .map(normalizeRepo)
        .slice(0, safeCount);

    console.log(`✓ Fetched ${projects.length} project(s) (source: ${source})`);

    return {
        username,
        projects,
        source,
        fetchedAt: new Date().toISOString(),
    };
}