// The one HTTP retry policy (decision D8): every external JSON fetch in the sync
// pipeline and the Worker goes through here — bounded retries, linear backoff, and an
// optional throttle for rate-limited sources.
export type FetchJsonOptions = {
  fetcher?: typeof fetch;
  headers?: Record<string, string>;
  retries?: number;
  retryDelayMs?: number;
  throttleMs?: number;
  wait?: (ms: number) => Promise<void>;
};

const defaultWait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function fetchWithRetries<T>(url: string, options: FetchJsonOptions, read: (response: Response) => Promise<T>): Promise<T> {
  const {
    fetcher = fetch,
    headers = {},
    retries = 3,
    retryDelayMs = 500,
    throttleMs = 0,
    wait = defaultWait,
  } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetcher(url, { headers });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      const value = await read(response);
      if (throttleMs) await wait(throttleMs);
      return value;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < retries) await wait(retryDelayMs * (attempt + 1));
    }
  }
  // The query string is stripped from the error: request URLs can carry API keys
  // (Alpha Vantage), and failure text flows into job responses and logs.
  throw new Error(`Failed ${url.split("?")[0]}: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
}

export function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  return fetchWithRetries(url, options, response => response.json());
}

export function fetchText(url: string, options: FetchJsonOptions = {}): Promise<string> {
  return fetchWithRetries(url, options, response => response.text());
}
