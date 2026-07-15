from __future__ import annotations

import os
import re
import stat
from dataclasses import dataclass
from pathlib import Path

ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
SECRET_RE = re.compile(r"^0x[a-fA-F0-9]{64}$")


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class LiveConfig:
    account_address: str
    api_secret_key: str
    mainnet: bool
    live_enabled: bool
    leverage: int
    isolated: bool
    total_notional: float
    host: str
    port: int
    config_path: Path
    data_dir: Path

    @property
    def network_name(self) -> str:
        return "mainnet" if self.mainnet else "testnet"

    @property
    def masked_address(self) -> str:
        return f"{self.account_address[:6]}…{self.account_address[-4:]}"


def _parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ConfigError(f"Invalid config line: {raw_line}")
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _check_permissions(path: Path) -> None:
    if not path.exists():
        raise ConfigError(f"Config file not found: {path}. Run bash scripts/setup-galka-live.sh")
    mode = stat.S_IMODE(path.stat().st_mode)
    if mode & (stat.S_IRWXG | stat.S_IRWXO):
        raise ConfigError(
            f"Unsafe permissions on {path}: run chmod 600 {path} before starting live trading"
        )


def load_config(path: str | Path | None = None) -> LiveConfig:
    config_path = Path(
        path
        or os.environ.get("GALKA_LIVE_CONFIG")
        or Path.home() / ".config" / "galka-live.env"
    ).expanduser()
    _check_permissions(config_path)
    values = _parse_env(config_path)

    account_address = values.get("HL_ACCOUNT_ADDRESS", "").strip()
    api_secret_key = values.get("HL_API_SECRET_KEY", "").strip()
    if not ADDRESS_RE.fullmatch(account_address):
        raise ConfigError("HL_ACCOUNT_ADDRESS must be the 0x address of the main Hyperliquid account")
    if not SECRET_RE.fullmatch(api_secret_key):
        raise ConfigError("HL_API_SECRET_KEY must be the 0x private key of the approved API wallet")

    leverage = int(values.get("HL_LEVERAGE", "10"))
    if leverage < 1 or leverage > 10:
        raise ConfigError("HL_LEVERAGE must be between 1 and 10 for this first live version")

    total_notional = float(values.get("HL_TOTAL_NOTIONAL", "150"))
    if total_notional < 80 or total_notional > 200:
        raise ConfigError("HL_TOTAL_NOTIONAL must be between $80 and $200 for the guarded first version")

    live_enabled = (
        values.get("HL_LIVE_ENABLED", "NO").strip().upper() == "YES"
        and values.get("HL_LIVE_CONFIRM", "").strip() == "I_UNDERSTAND_REAL_MONEY"
    )
    host = values.get("GALKA_HOST", "127.0.0.1").strip()
    if host not in {"127.0.0.1", "localhost"}:
        raise ConfigError("GALKA_HOST must remain 127.0.0.1 or localhost")
    port = int(values.get("GALKA_PORT", "8098"))
    if not 1024 <= port <= 65535:
        raise ConfigError("GALKA_PORT is invalid")

    data_dir = Path(values.get("GALKA_DATA_DIR", str(Path.home() / ".local" / "share" / "galka-live"))).expanduser()
    data_dir.mkdir(parents=True, exist_ok=True)
    try:
        data_dir.chmod(0o700)
    except OSError:
        pass

    return LiveConfig(
        account_address=account_address.lower(),
        api_secret_key=api_secret_key,
        mainnet=_bool(values.get("HL_MAINNET"), True),
        live_enabled=live_enabled,
        leverage=leverage,
        isolated=_bool(values.get("HL_ISOLATED"), True),
        total_notional=total_notional,
        host="127.0.0.1",
        port=port,
        config_path=config_path,
        data_dir=data_dir,
    )
