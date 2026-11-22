#!/usr/bin/env bash
# Create the production operations tmux session (idempotent).
#
# Layout:
#   window 1 "logs"   — pane 1: app logs (follow), pane 2: shell
#   window 2 "status" — `watch docker compose ps`
#   window 3 "shell"  — spare shell
#
# Safe to run repeatedly: an existing session is left untouched.
set -euo pipefail

SESSION="${TMUX_SESSION:-rca-ops}"
APP_DIR="${RCA_APP_DIR:-/opt/rca-vostok}"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "session '$SESSION' already exists — nothing to do" >&2
  tmux ls
  exit 0
fi

cd "$APP_DIR"

tmux new-session -d -s "$SESSION" -n logs -c "$APP_DIR"
tmux send-keys -t "$SESSION:1" 'docker compose logs -f --tail=50 app' C-m

tmux split-window -v -t "$SESSION:1" -c "$APP_DIR" -l 40%
tmux send-keys -t "$SESSION:1.2" "cd $APP_DIR && echo 'shell in $APP_DIR — Ctrl-b c for a new window'" C-m

tmux new-window -t "$SESSION" -n status -c "$APP_DIR"
tmux send-keys -t "$SESSION:2" \
  "watch -n 5 -t 'docker compose ps --format \"table {{.Name}}\t{{.Status}}\"'" C-m

tmux new-window -t "$SESSION" -n shell -c "$APP_DIR"

tmux select-window -t "$SESSION:1"
tmux select-pane -t "$SESSION:1.1"

echo "created tmux session '$SESSION'" >&2
