import { describe, expect, it } from "vitest";
import { appShellAssetUrls, cacheStrategyFor, shouldCacheResponse } from "../src/pwa-cache";

describe("PWA cache policy", () => {
  const origin = "https://example.test";

  it("uses the network first for same-origin page navigation", () => {
    expect(cacheStrategyFor({ method: "GET", mode: "navigate", url: `${origin}/plan` }, origin)).toBe("network-first");
  });

  it("uses cached immutable assets before the network", () => {
    expect(cacheStrategyFor({ method: "GET", mode: "cors", url: `${origin}/assets/app-hash.js` }, origin)).toBe("cache-first");
  });

  it("does not intercept mutations or cross-origin requests", () => {
    expect(cacheStrategyFor({ method: "POST", mode: "navigate", url: `${origin}/plan` }, origin)).toBe("bypass");
    expect(cacheStrategyFor({ method: "GET", mode: "cors", url: "https://cdn.example/app.js" }, origin)).toBe("bypass");
  });

  it("caches only successful responses", () => {
    expect(shouldCacheResponse({ ok: true })).toBe(true);
    expect(shouldCacheResponse({ ok: false })).toBe(false);
  });

  it("discovers same-origin hashed assets from the built app shell", () => {
    const html = `<link rel="icon" href="./icon.svg"><link rel="stylesheet" href="/toolkit/assets/app-abc.css"><script src="/toolkit/assets/app-abc.js"></script><script src="https://cdn.example/ignored.js"></script>`;
    expect(appShellAssetUrls(html, `${origin}/toolkit/index.html`)).toEqual([
      `${origin}/toolkit/icon.svg`, `${origin}/toolkit/assets/app-abc.css`, `${origin}/toolkit/assets/app-abc.js`
    ]);
  });

  it("deduplicates repeated app-shell assets", () => {
    expect(appShellAssetUrls('<script src="app.js"></script><script src="app.js"></script>', `${origin}/index.html`)).toEqual([
      `${origin}/app.js`
    ]);
  });
});
