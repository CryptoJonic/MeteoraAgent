#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v python >/dev/null 2>&1; then
  echo "Python не найден. Устанавливаю..."
  pkg update -y
  pkg install python -y
fi

PORT="$(python - <<'PY'
import socket
for port in range(8090, 8100):
    with socket.socket() as sock:
        try:
            sock.bind(('127.0.0.1', port))
        except OSError:
            continue
        print(port)
        break
else:
    raise SystemExit('Нет свободного порта 8090–8099')
PY
)"

LOG_FILE="${TMPDIR:-/tmp}/galka-manual-auto-${PORT}.log"
VERSION="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
URL="http://127.0.0.1:${PORT}/terminal/manual-auto-bootstrap.html?v=${VERSION}"

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
  echo "Не удалось запустить Manual Galka Auto Paper. Лог: $LOG_FILE"
  cat "$LOG_FILE"
  exit 1
fi

echo "Manual Galka Auto Paper запущен отдельно: $URL"
echo "Режим: лимитки ниже GALKA, полный выход при возврате ровно к GALKA."
echo "RECLAIM и trailing в этой исследовательской версии отключены."
echo "Используется отдельный origin и отдельное хранилище galka-manual-auto-v1."
echo "Основной Galka Pro и его позиции не изменяются."
echo "Чтобы остановить сервер, вернись в Termux и нажми Ctrl+C."

if command -v termux-open-url >/dev/null 2>&1; then
  termux-open-url "$URL" || true
else
  echo "Открой адрес вручную: $URL"
fi

wait "$SERVER_PID"
