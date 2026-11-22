#!/usr/bin/env bash
# Attach to the local development tmux session (WSL).
#
# Unlike deploy/ops.sh this does not go over SSH: the dev stack runs inside the
# same WSL instance, so a plain `tmux attach` is enough.
#
# Usage (from WSL): ./deploy/ops-dev.sh
set -euo pipefail

SESSION="${TMUX_SESSION:-rca-dev}"

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "session '$SESSION' is missing; recreate it with deploy/setup-tmux-dev.sh" >&2
  exit 1
fi

exec tmux attach -t "$SESSION"
