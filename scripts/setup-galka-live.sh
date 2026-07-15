#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT_DIR/.venv-live"
REQUIREMENTS="$ROOT_DIR/live/requirements-termux.txt"
CONFIG_DIR="$HOME/.config"
CONFIG_FILE="$CONFIG_DIR/galka-live.env"

if ! command -v python >/dev/null 2>&1; then
  pkg update -y
  pkg install -y python
fi
if ! command -v nano >/dev/null 2>&1; then
  pkg install -y nano
fi

# Android/Termux has no PyPI wheels for several native dependencies.  The
# pinned dependency set avoids pydantic-core/Rust and these packages build the
# remaining small C extensions locally.
pkg install -y clang make pkg-config libffi openssl

cd "$ROOT_DIR"

if [[ -x "$VENV/bin/python" ]]; then
  if ! "$VENV/bin/python" -c 'import hyperliquid, eth_account, eth_utils' >/dev/null 2>&1; then
    echo "Удаляю незавершённое окружение после прошлой ошибки..."
    rm -rf "$VENV"
  fi
fi

if [[ ! -x "$VENV/bin/python" ]]; then
  echo "Создаю отдельное окружение Galka LIVE..."
  python -m venv "$VENV"
fi

"$VENV/bin/python" -m pip install --upgrade pip setuptools wheel
"$VENV/bin/python" -m pip install --no-cache-dir -r "$REQUIREMENTS"

"$VENV/bin/python" - <<'PY'
from importlib.metadata import version

import eth_account
import eth_utils
import hyperliquid

expected = {
    "hyperliquid-python-sdk": "0.24.0",
    "eth-account": "0.10.0",
    "eth-utils": "4.1.1",
    "eth-abi": "5.2.0",
    "eth-keyfile": "0.8.1",
}
for package, wanted in expected.items():
    actual = version(package)
    if actual != wanted:
        raise SystemExit(f"Wrong {package}: {actual}, expected {wanted}")
try:
    version("pydantic-core")
except Exception:
    pass
else:
    raise SystemExit("pydantic-core must not be installed in the Termux LIVE environment")
print("Hyperliquid SDK установлен и проверен.")
PY

mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
if [[ ! -f "$CONFIG_FILE" ]]; then
  cat > "$CONFIG_FILE" <<'EOF'
# Публичный адрес ОСНОВНОГО Hyperliquid-аккаунта, где лежат средства.
HL_ACCOUNT_ADDRESS=0xPASTE_MAIN_ACCOUNT_ADDRESS

# Приватный ключ одобренного API Wallet / Agent Wallet.
# Не вставляй seed-фразу и не используй приватный ключ основного кошелька.
HL_API_SECRET_KEY=0xPASTE_API_WALLET_PRIVATE_KEY

HL_MAINNET=true
HL_LEVERAGE=10
HL_ISOLATED=true

# При депозите около $19 используем $150 номинала: примерно $15 маржи при 10x.
HL_TOTAL_NOTIONAL=150

# LIVE включится только когда обе строки ниже заполнены именно так.
HL_LIVE_ENABLED=NO
HL_LIVE_CONFIRM=NOT_CONFIRMED

GALKA_HOST=127.0.0.1
GALKA_PORT=8098
EOF
fi
chmod 600 "$CONFIG_FILE"

cat <<EOF

Открываю локальный секретный файл:
$CONFIG_FILE

Нужно заменить только:
1. HL_ACCOUNT_ADDRESS — адрес основного счёта Hyperliquid.
2. HL_API_SECRET_KEY — приватный ключ API Wallet.
3. Пока оставить HL_LIVE_ENABLED=NO.
4. Пока оставить HL_LIVE_CONFIRM=NOT_CONFIRMED.

Файл не находится в GitHub и доступен только твоему пользователю Termux.
Не присылай его содержимое и не делай скриншот.
Сохранить в nano: Ctrl+O, Enter. Выйти: Ctrl+X.
EOF

nano "$CONFIG_FILE"
chmod 600 "$CONFIG_FILE"

echo
echo "Настройка завершена. Безопасный запуск с LIVE OFF:"
echo "bash scripts/start-galka-live.sh"
