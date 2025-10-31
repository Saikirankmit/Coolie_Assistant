export function getApiBase(): string {
  const envBase = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  // Ensure no trailing slash for consistency
  const base = envBase ? envBase.replace(/\/$/, '') : '';
  return base; // empty means same-origin
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  if (!path.startsWith('/')) path = '/' + path;
  return base ? `${base}${path}` : path;
}

export async function apiFetch(inputPath: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(inputPath);
  return fetch(url, init);
}


