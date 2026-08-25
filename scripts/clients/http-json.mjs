const defaultWait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchJson(url, options = {}) {
  const {
    fetcher = fetch,
    headers = {},
    retries = 3,
    retryDelayMs = 500,
    throttleMs = 0,
    wait = defaultWait,
  } = options;
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetcher(url, { headers });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      const value = await response.json();
      if (throttleMs) await wait(throttleMs);
      return value;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < retries) await wait(retryDelayMs * (attempt + 1));
    }
  }
  throw new Error(`Failed ${url}: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
}

