/**
 * fetchContributions.js
 * Fetches contribution calendar data from GitHub GraphQL API.
 * Retrieves BOTH public and private contributions (same as GitHub profile page).
 * Repository names and metadata are NEVER exposed — only anonymous counts and colors.
 */

import fetch from "node-fetch";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

/**
 * GraphQL query to fetch the contribution calendar.
 * `contributionCalendar` mirrors what GitHub shows on your public profile page.
 * Private contributions are included when the token has the `read:user` scope.
 * No repository names or private metadata are returned — only counts and colors.
 */
const CONTRIBUTION_QUERY = `
  query ContributionGraph($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      name
      login
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          colors
          weeks {
            firstDay
            contributionDays {
              date
              weekday
              contributionCount
              color
            }
          }
        }
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalRepositoryContributions
        restrictedContributionsCount
      }
    }
  }
`;

/**
 * Fetches contribution data for a given GitHub username.
 * @param {string} username - GitHub username
 * @param {string} token    - GitHub Personal Access Token (read:user scope required)
 * @param {number} [years=1] - How many years of history to fetch (1–5)
 * @returns {Promise<Object>} Parsed contribution data
 */
export async function fetchContributions(username, token, years = 1) {
  if (!token) {
    throw new Error(
      "GH_PRIVATE_TOKEN is not set. " +
      "Create a token at https://github.com/settings/tokens with read:user scope."
    );
  }

  if (!username) {
    throw new Error(
      "GITHUB_USERNAME is not set. " +
      "Add your GitHub username to the workflow or .env file."
    );
  }

  const now = new Date();
  const to = now.toISOString();
  const from = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  console.log(`Fetching contributions for @${username} (${from.slice(0, 10)} → ${to.slice(0, 10)})…`);

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "github-activity-graph/1.0",
    },
    body: JSON.stringify({
      query: CONTRIBUTION_QUERY,
      variables: { username, from, to },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API returned HTTP ${response.status}: ${response.statusText}\n` +
      "Check that your GH_PRIVATE_TOKEN is valid and not expired."
    );
  }

  const json = await response.json();

  // Surface GraphQL-level errors
  if (json.errors && json.errors.length > 0) {
    const messages = json.errors.map((e) => e.message).join("\n  ");
    throw new Error(`GitHub GraphQL errors:\n  ${messages}`);
  }

  if (!json.data?.user) {
    throw new Error(
      `User "@${username}" not found or token lacks read:user scope.\n` +
      "Make sure GH_PRIVATE_TOKEN has the 'read:user' permission."
    );
  }

  const { user } = json.data;
  const { contributionsCollection } = user;
  const { contributionCalendar } = contributionsCollection;

  // Log contribution summary (counts only — no repo names)
  console.log(`✓ Fetched ${contributionCalendar.totalContributions} total contributions`);
  if (contributionsCollection.restrictedContributionsCount > 0) {
    console.log(
      `  ↳ Includes ${contributionsCollection.restrictedContributionsCount} private contributions`
    );
  }

  return {
    username: user.login,
    displayName: user.name || user.login,
    calendar: contributionCalendar,
    summary: {
      total: contributionCalendar.totalContributions,
      commits: contributionsCollection.totalCommitContributions,
      issues: contributionsCollection.totalIssueContributions,
      pullRequests: contributionsCollection.totalPullRequestContributions,
      reviews: contributionsCollection.totalPullRequestReviewContributions,
      repositories: contributionsCollection.totalRepositoryContributions,
      // restrictedContributionsCount = private contributions included but anonymized
      privateCount: contributionsCollection.restrictedContributionsCount,
    },
    fetchedAt: now.toISOString(),
  };
}
