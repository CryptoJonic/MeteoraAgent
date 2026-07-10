#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

PORT="${1:-8080}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${TMPDIR:-/tmp}/galka-terminal-${PORT}.log"
URL="http://127.0.0.1:${PORT}/terminal/"

if ! command -v python >/dev/null 2>&1; then
  echo "Python не найден. Устанавливаю..."
  pkg update -y
  pkg install python -y
fi

cd "$ROOT_DIR"

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

echo "Galka Terminal запущен: $URL"
echo "Чтобы остановить сервер, вернись в Termux и нажми Ctrl+C."

if command -v termux-open-url >/dev/null 2>&1; then
  termux-open-url "$URL" || true
else
  echo "Открой адрес вручную в браузере: $URL"
fi

wait "$SERVER_PID"
