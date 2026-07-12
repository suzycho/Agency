// The content endpoint, signed-in users only.
//   GET  — return the latest content.json from the GitHub repo.
//   POST — validate the submitted content and commit it to the repo, which
//          triggers a redeploy of the site with the new copy.
const { readSession, sendJson, requireConfig } = require("./_lib.js");

const CONTENT_PATH = "content.json";
const MAX_CONTENT_BYTES = 200 * 1024;

function githubConfig() {
  return {
    token: process.env.GITHUB_TOKEN || "",
    repo: process.env.GITHUB_REPO || "suzycho/agency",
    branch: process.env.GITHUB_BRANCH || "main",
  };
}

async function githubRequest(path, options = {}) {
  const { token } = githubConfig();
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "skeptical-cms",
      ...(options.headers || {}),
    },
  });
}

// Keep saves shaped like the content model so a bug in the editor can't
// commit something the site can't render.
function validateContent(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "Content must be a JSON object.";
  }
  const requiredArrays = ["services", "caseStudies", "bios", "clients"];
  for (const key of requiredArrays) {
    if (!Array.isArray(content[key])) return `"${key}" must be a list.`;
  }
  const requiredObjects = ["hero", "about", "contact", "footer"];
  for (const key of requiredObjects) {
    if (!content[key] || typeof content[key] !== "object" || Array.isArray(content[key])) {
      return `"${key}" must be an object.`;
    }
  }
  if (JSON.stringify(content).length > MAX_CONTENT_BYTES) {
    return "Content is too large.";
  }
  return null;
}

module.exports = async (req, res) => {
  if (!requireConfig(res)) return;

  const session = readSession(req);
  if (!session) {
    return sendJson(res, 401, { error: "Not signed in." });
  }

  const { token, repo, branch } = githubConfig();
  if (!token) {
    return sendJson(res, 500, { error: "Server is not configured: set the GITHUB_TOKEN environment variable." });
  }

  if (req.method === "GET") {
    const response = await githubRequest(
      `/repos/${repo}/contents/${CONTENT_PATH}?ref=${encodeURIComponent(branch)}`
    );
    if (!response.ok) {
      console.error(`[cms] GitHub read failed (${response.status}): ${await response.text()}`);
      return sendJson(res, 502, { error: `Could not load content from GitHub (${response.status}).` });
    }
    const file = await response.json();
    let content;
    try {
      content = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
    } catch {
      return sendJson(res, 502, { error: "content.json in the repo is not valid JSON." });
    }
    return sendJson(res, 200, { content });
  }

  if (req.method === "POST") {
    const content = req.body && req.body.content;
    const problem = validateContent(content);
    if (problem) {
      return sendJson(res, 400, { error: problem });
    }

    // Fetch the current sha right before writing — required by the GitHub
    // contents API to update an existing file.
    const current = await githubRequest(
      `/repos/${repo}/contents/${CONTENT_PATH}?ref=${encodeURIComponent(branch)}`
    );
    if (!current.ok) {
      console.error(`[cms] GitHub sha lookup failed (${current.status}): ${await current.text()}`);
      return sendJson(res, 502, { error: `Could not reach GitHub to save (${current.status}).` });
    }
    const { sha } = await current.json();

    const body = JSON.stringify(content, null, 2) + "\n";
    const write = await githubRequest(`/repos/${repo}/contents/${CONTENT_PATH}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Update site content via CMS (${session.email})`,
        content: Buffer.from(body, "utf8").toString("base64"),
        sha,
        branch,
      }),
    });
    if (!write.ok) {
      console.error(`[cms] GitHub write failed (${write.status}): ${await write.text()}`);
      return sendJson(res, 502, { error: `GitHub rejected the save (${write.status}).` });
    }
    const result = await write.json();
    return sendJson(res, 200, {
      ok: true,
      commit: result.commit && result.commit.sha,
      message: "Saved. The live site updates in a minute or two once the deploy finishes.",
    });
  }

  return sendJson(res, 405, { error: "Method not allowed" });
};
