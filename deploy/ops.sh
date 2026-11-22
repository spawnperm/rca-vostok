#!/usr/bin/env bash
# Attach to the production operations tmux session.
#
# Usage (from WSL):  ./deploy/ops.sh
# Creates the session if it is missing, then attaches. Because `tmux attach`
# requires a real terminal, this is intended to be run interactively — it is
# not meant for non-interactive CI use.
set -euo pipefail

SESSION="${TMUX_SESSION:-rca-ops}"
HOST="${RCA_PROD_HOST:-vostok-prod}"

# `-t` requests a TTY, which tmux needs to attach to an interactive session.
exec ssh -t "$HOST" "tmux has-session -t $SESSION 2>/dev/null && tmux attach -t $SESSION || {
  echo 'session $SESSION is missing; recreate it with deploy/setup-tmux.sh' >&2
  exit 1
}"
