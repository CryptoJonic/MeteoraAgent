#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

REPO="$HOME/GalkaLive"
BRANCH="agent/galka-live-hardening-v3"
PATCH_SHA="98414f915ce0ff2aae06edb63ead566ffd51abe734d17edcf4c9db76396069d7"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$HOME/GalkaLive-backups/$STAMP"
CONFIG="$HOME/.config/galka-live.env"
STATE_DIR="$HOME/.local/share/galka-live"
PRESERVE_JSON="research/galka_lab/output/galka-stats-v1.json"
STASHED=0

fail() {
  printf '\nОШИБКА: %s\n' "$*" >&2
  printf 'Резервная копия: %s\n' "$BACKUP_ROOT" >&2
  exit 1
}
trap 'fail "команда завершилась на строке $LINENO"' ERR

[[ -d "$REPO/.git" ]] || fail "не найден Git-репозиторий $REPO"
mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

printf '[1/10] Останавливаю локальный LIVE-сервер, если он запущен...\n'
pkill -f 'python.*-m live.server' 2>/dev/null || true
pkill -f 'live/server.py' 2>/dev/null || true
sleep 1

printf '[2/10] Создаю резервную копию конфигурации, state и локальных изменений...\n'
if [[ -f "$CONFIG" ]]; then
  mkdir -p "$BACKUP_ROOT/config"
  cp -p "$CONFIG" "$BACKUP_ROOT/config/galka-live.env"
fi
if [[ -d "$STATE_DIR" ]]; then
  cp -a "$STATE_DIR" "$BACKUP_ROOT/galka-live-state"
fi
cd "$REPO"
git status --short > "$BACKUP_ROOT/git-status.txt"
git diff --binary > "$BACKUP_ROOT/working-tree.patch" || true
git diff --cached --binary > "$BACKUP_ROOT/index.patch" || true
if [[ -f "$PRESERVE_JSON" ]]; then
  mkdir -p "$BACKUP_ROOT/preserve/$(dirname "$PRESERVE_JSON")"
  cp -p "$PRESERVE_JSON" "$BACKUP_ROOT/preserve/$PRESERVE_JSON"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  git stash push --include-untracked -m "pre-galka-hardening-v3-$STAMP" >/dev/null
  STASHED=1
fi

printf '[3/10] Получаю подготовленную ветку из GitHub...\n'
git fetch origin "$BRANCH"
git switch -C "$BRANCH" "origin/$BRANCH"

printf '[4/10] Восстанавливаю и проверяю hardened-патч...\n'
[[ -f .galka-hardening/READY ]] || fail "в ветке отсутствует .galka-hardening/READY"
cat .galka-hardening/part-* > "$BACKUP_ROOT/hardening.patch.b64"
base64 --decode "$BACKUP_ROOT/hardening.patch.b64" > "$BACKUP_ROOT/hardening.patch.gz"
gzip -dc "$BACKUP_ROOT/hardening.patch.gz" > "$BACKUP_ROOT/hardening.patch"
printf '%s  %s\n' "$PATCH_SHA" "$BACKUP_ROOT/hardening.patch" | sha256sum --check -
patch --dry-run --batch --forward -p1 < "$BACKUP_ROOT/hardening.patch"
patch --batch --forward -p1 < "$BACKUP_ROOT/hardening.patch"
rm -rf .galka-hardening
rm -f .github/workflows/apply-galka-hardening-v3.yml
chmod +x scripts/setup-galka-live.sh scripts/start-galka-live.sh \
  scripts/verify-galka-live.sh scripts/check-galka-live-account.sh

printf '[5/10] Принудительно оставляю реальную торговлю выключенной...\n'
if [[ -f "$CONFIG" ]]; then
  sed -i 's/^HL_LIVE_ENABLED=.*/HL_LIVE_ENABLED=NO/' "$CONFIG"
  sed -i 's/^HL_LIVE_CONFIRM=.*/HL_LIVE_CONFIRM=NOT_CONFIRMED/' "$CONFIG"
  chmod 600 "$CONFIG"
fi

printf '[6/10] Проверяю синтаксис кода...\n'
python -m compileall -q live tests
if command -v node >/dev/null 2>&1; then
  node --check terminal/live.js
  node --check terminal/vendor/galka-chart.js
  node scripts/check-live-secret-isolation.mjs
  node scripts/check-live-terminal.mjs
fi
for script in scripts/*.sh; do
  bash -n "$script"
done

printf '[7/10] Проверяю Python-окружение и устанавливаю pinned-зависимости при необходимости...\n'
if [[ ! -x .venv-live/bin/python ]]; then
  command -v pkg >/dev/null 2>&1 || fail "скрипт нужно запускать в Termux"
  pkg install -y python clang make pkg-config libffi openssl
  python -m venv .venv-live
fi
.venv-live/bin/python -m pip install --upgrade pip setuptools wheel
.venv-live/bin/python -m pip install --no-cache-dir -r live/requirements-termux.txt

printf '[8/10] Запускаю полный локальный набор проверок...\n'
bash scripts/verify-galka-live.sh

printf '[9/10] Создаю commit и отправляю рабочий код в GitHub...\n'
git add -A
# Никогда не добавлять пользовательскую статистику, даже если она появилась в рабочем дереве.
git reset -- "$PRESERVE_JSON" 2>/dev/null || true
git diff --cached --check
if ! git diff --cached --quiet; then
  git -c user.name='CryptoJonic' \
      -c user.email='173195477+CryptoJonic@users.noreply.github.com' \
      commit -m 'Harden Galka Hyperliquid LIVE v3'
fi
git push --set-upstream origin "$BRANCH"

printf '[10/10] Возвращаю отдельно сохранённый пользовательский JSON...\n'
if [[ -f "$BACKUP_ROOT/preserve/$PRESERVE_JSON" ]]; then
  mkdir -p "$(dirname "$PRESERVE_JSON")"
  cp -p "$BACKUP_ROOT/preserve/$PRESERVE_JSON" "$PRESERVE_JSON"
fi

printf '\nГОТОВО. Hardened-код установлен и отправлен в GitHub.\n'
printf 'Ветка: %s\n' "$BRANCH"
printf 'Резервная копия: %s\n' "$BACKUP_ROOT"
if [[ "$STASHED" -eq 1 ]]; then
  printf 'Прочие старые локальные изменения сохранены в git stash и не потеряны.\n'
fi
printf 'LIVE оставлен выключенным. Следующая безопасная проверка:\n'
printf '  cd %q && bash scripts/check-galka-live-account.sh\n' "$REPO"
