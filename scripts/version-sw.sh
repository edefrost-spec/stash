#!/usr/bin/env bash
# Patches the service worker cache name with the current git SHA.
# Run as a Vercel build command so deployed assets always bust stale caches.
# The VERCEL_GIT_COMMIT_SHA env var is injected automatically by Vercel.

set -e

if [ -n "$VERCEL_GIT_COMMIT_SHA" ]; then
  SHA="${VERCEL_GIT_COMMIT_SHA:0:7}"
else
  # Fallback for local testing
  SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
fi

echo "Stamping sw.js cache version: stash-$SHA"
sed -i "s/stash-v[0-9]*/stash-$SHA/" web/sw.js
