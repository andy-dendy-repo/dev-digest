#!/usr/bin/env bash
set -eu
mkdir -p server/src/modules/repos
cp "$(dirname "$0")/files/sync-service.ts" server/src/modules/repos/sync-service.ts
