/// <reference lib="webworker" />

import { appShellAssetUrls, cacheStrategyFor, shouldCacheResponse } from "./pwa-cache";

declare const self: ServiceWorkerGlobalScope;

const CACHE = "ort-v2";
const APP_SHELL = ["./index.html", "./manifest.webmanifest", "./icon.svg"];

const cacheAppShell = async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(APP_SHELL);
  const index = await cache.match("./index.html");
  if (index) {
    const indexUrl = new URL("./index.html", self.registration.scope).href;
    await cache.addAll(appShellAssetUrls(await index.text(), indexUrl));
  }
};

const cacheResponse = async (request: Request | string, response: Response) => {
  if (shouldCacheResponse(response)) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
};

const networkFirst = async (request: Request): Promise<Response> => {
  try {
    return await cacheResponse("./index.html", await fetch(request));
  } catch {
    return (await caches.match("./index.html")) ?? Response.error();
  }
};

const cacheFirst = async (request: Request): Promise<Response> => {
  const cached = await caches.match(request);
  if (cached) return cached;
  return cacheResponse(request, await fetch(request));
};

self.addEventListener("install", event => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const strategy = cacheStrategyFor(event.request, self.location.origin);
  if (strategy === "network-first") event.respondWith(networkFirst(event.request));
  if (strategy === "cache-first") event.respondWith(cacheFirst(event.request));
});
