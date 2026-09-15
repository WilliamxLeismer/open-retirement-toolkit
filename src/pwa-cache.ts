export type CacheStrategy = "bypass" | "network-first" | "cache-first";

export interface CacheRequest {
  method: string;
  mode: string;
  url: string;
}

export function cacheStrategyFor(request: CacheRequest, scopeOrigin: string): CacheStrategy {
  if (request.method !== "GET") return "bypass";
  if (new URL(request.url).origin !== scopeOrigin) return "bypass";
  return request.mode === "navigate" ? "network-first" : "cache-first";
}

export function shouldCacheResponse(response: Pick<Response, "ok">): boolean {
  return response.ok;
}

export function appShellAssetUrls(indexHtml: string, indexUrl: string): string[] {
  const base = new URL(indexUrl);
  const urls = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match => new URL(match[1], base))
    .filter(url => url.origin === base.origin)
    .map(url => url.href);
  return [...new Set(urls)];
}
