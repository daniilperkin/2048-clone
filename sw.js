/* Service worker for the multi-file build (index.html + js/ + style/):
 * offline play after the first visit. The single-file bundle (2048.html)
 * is self-contained and never registers this worker.
 *
 * Network-first: assets have no content-hash in their names, so serving
 * from the network whenever it is reachable keeps `npm start` iterations
 * fresh; the cache is the offline fallback and is refreshed on every
 * successful fetch. The doodle theme's tile SVGs (build/tiles/*.svg) are
 * deliberately NOT precached — they are generated assets that may be
 * absent in a bare deploy, and one missing file would fail the whole
 * install; they are cached at runtime when the theme is used.
 *
 * Bump CACHE_VERSION when shipping shell changes so browsers still on an
 * older cache-first worker pick up the new files.
 */
"use strict";

const CACHE_VERSION = "v3";
const CACHE_NAME = `2048-shell-${CACHE_VERSION}`;

// The boot shell — kept in sync with index.html by test/pwa.test.js.
const APP_SHELL = [
  "./",
  "./index.html",
  "./style/main.css",
  "./favicon.ico",
  "./manifest.webmanifest",
  "./js/directions.js",
  "./js/themes.js",
  "./js/view_transitions.js",
  "./js/sound_manager.js",
  "./js/keyboard_input_manager.js",
  "./js/html_actuator.js",
  "./js/tile.js",
  "./js/random.js",
  "./js/grid.js",
  "./js/local_storage_manager.js",
  "./js/stats.js",
  "./js/share.js",
  "./js/preferences.js",
  "./js/game_manager.js",
  "./js/application.js",
  "./meta/apple-touch-icon.png",
  "./meta/apple-touch-startup-image-640x1096.png",
  "./meta/apple-touch-startup-image-640x920.png",
  "./meta/icon-192.png",
  "./meta/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// Network-first for same-origin GETs; the cache answers when offline.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || Response.error()))
  );
});
