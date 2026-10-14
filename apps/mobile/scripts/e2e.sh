#!/usr/bin/env bash
# Runs the Maestro flows in .maestro.
#   npm run e2e                     iOS or Android: the booted simulator or emulator
#   npm run e2e -- --device <id>    pick a device when more than one is running
#   npm run e2e -- web              web, in headless Chromium
# Needs Metro running (`npm start`). Native runs need the dev client installed.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${JAVA_HOME:-}" ] && command -v brew >/dev/null; then
  export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
fi
export MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

if [ "${1:-}" = web ]; then
  shift
  exec maestro test --headless "$@" .maestro/web
fi
exec maestro test "$@" .maestro
