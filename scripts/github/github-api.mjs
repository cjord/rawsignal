export function createGitHubApi(token, fetcher = fetch) {
  if (!token) throw new Error("GitHub authentication is required; never paste credentials into chat");
  return async (path, {method = "GET", body} = {}) => {
    if (!path.startsWith("/repos/") || path.includes("://")) throw new Error("Unexpected API path");
    const response = await fetcher(`https://api.github.com${path}`, {
      method,
      headers: {Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"},
      ...(body ? {body: JSON.stringify(body)} : {}),
      signal: AbortSignal.timeout(20000), redirect: "error",
    });
    // Never print response bodies: they can contain private repository/account information.
    // Never automatically retry a POST after an ambiguous network response.
    if (!response.ok) throw new Error(`GitHub ${method} failed (${response.status}); no write retry performed`);
    try {
      return await response.json();
    } catch {
      throw new Error("GitHub returned an unreadable response; inspect before retrying any write");
    }
  };
}

export async function listAllIssues(api, repository) {
  const issues = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await api(`/repos/${repository}/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error("Unexpected issue response");
    issues.push(...batch);
    if (batch.length < 100) return issues;
  }
  throw new Error("Issue pagination limit reached; refusing to publish from partial data");
}
