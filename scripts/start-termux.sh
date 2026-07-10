#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Compatibility bridge: early installations were pinned to a merged feature branch.
# Preserve local edits, migrate to main, then restart this script from the current version.
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  CURRENT_BRANCH="$(git branch --show-current || true)"
  if [[ -n "$CURRENT_BRANCH" && "$CURRENT_BRANCH" != "main" ]]; then
    echo "Обнаружена старая ветка: $CURRENT_BRANCH. Переключаю проект на main..."
    if [[ -n "$(git status --porcelain)" ]]; then
      STASH_NAME="galka-auto-backup-$(date +%Y%m%d-%H%M%S)"
      git stash push -u -m "$STASH_NAME" >/dev/null
      echo "Локальные изменения сохранены в git stash: $STASH_NAME"
    fi
    git fetch origin main
    if git show-ref --verify --quiet refs/heads/main; then
      git switch main
    else
      git switch -c main --track origin/main
    fi
    git pull --ff-only origin main
    exec bash "$ROOT_DIR/scripts/start-termux.sh" "${1:-}"
  fi
fi

if ! command -v python >/dev/null 2>&1; then
  echo "Python не найден. Устанавливаю..."
  pkg update -y
  pkg install python -y
fi

REQUESTED_PORT="${1:-}"
if [[ -n "$REQUESTED_PORT" ]]; then
  PORT="$REQUESTED_PORT"
else
  PORT="$(python - <<'PY'
import socket
for port in range(8080, 8090):
    with socket.socket() as s:
        try:
            s.bind(('127.0.0.1', port))
        except OSError:
            continue
        print(port)
        break
else:
    raise SystemExit('Нет свободного порта 8080–8089')
PY
)"
fi

LOG_FILE="${TMPDIR:-/tmp}/galka-terminal-${PORT}.log"
VERSION="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
URL="http://127.0.0.1:${PORT}/terminal/?v=${VERSION}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

python -m http.server "$PORT" --bind 127.0.0.1 >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
sleep 1

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "Не удалось запустить терминал. Лог: $LOG_FILE"
  cat "$LOG_FILE"
  exit 1
fi

echo "Galka Terminal v2 запущен: $URL"
echo "История BTC загружается автоматически."
echo "Чтобы остановить сервер, вернись в Termux и нажми Ctrl+C."

if command -v termux-open-url >/dev/null 2>&1; then
  termux-open-url "$URL" || true
else
  echo "Открой адрес вручную в браузере: $URL"
fi

wait "$SERVER_PID"
