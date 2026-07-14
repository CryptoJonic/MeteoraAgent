from __future__ import annotations

import json
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .config import ConfigError, load_config
from .engine import GalkaLiveEngine, LiveEngineError
from .hyperliquid_gateway import GatewayError, HyperliquidGateway

REPO_ROOT = Path(__file__).resolve().parents[1]


class GalkaRequestHandler(SimpleHTTPRequestHandler):
    engine: GalkaLiveEngine

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        message = fmt % args
        if self.path.startswith("/api/live/status"):
            return
        sys.stdout.write(f"[{self.log_date_time_string()}] {message}\n")
        sys.stdout.flush()

    def end_headers(self) -> None:
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def _json(self, status: int, payload: dict | list) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 64_000:
            raise LiveEngineError("Некорректное тело запроса")
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise LiveEngineError("Некорректный JSON") from exc
        if not isinstance(data, dict):
            raise LiveEngineError("Ожидается JSON-объект")
        return data

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/live/status":
            return self._handle(lambda: self.engine.status())
        if parsed.path == "/api/live/candles":
            query = parse_qs(parsed.query)
            coin = query.get("coin", [""])[0]
            interval = query.get("interval", ["15m"])[0]
            limit = int(query.get("limit", ["1000"])[0])
            return self._handle(lambda: self.engine.candles(coin, interval, limit))
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        try:
            data = self._read_json()
        except LiveEngineError as exc:
            return self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})

        if parsed.path == "/api/live/preview":
            return self._handle(
                lambda: self.engine.preview(str(data.get("coin", "")), float(data.get("galkaPrice", 0)))
            )
        if parsed.path == "/api/live/campaign":
            return self._handle(
                lambda: self.engine.create_campaign(
                    str(data.get("coin", "")),
                    float(data.get("galkaPrice", 0)),
                    str(data.get("confirmation", "")),
                )
            )
        if parsed.path == "/api/live/cancel":
            return self._handle(lambda: self.engine.cancel_waiting_campaign(str(data.get("coin", ""))))
        if parsed.path == "/api/live/emergency":
            return self._handle(
                lambda: self.engine.emergency_close(
                    str(data.get("coin", "")),
                    str(data.get("confirmation", "")),
                )
            )
        return self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "API endpoint not found"})

    def _handle(self, action) -> None:
        try:
            result = action()
            self._json(HTTPStatus.OK, {"ok": True, "data": result})
        except (LiveEngineError, GatewayError, ValueError) as exc:
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
        except Exception as exc:  # do not expose secrets or tracebacks to the browser
            sys.stderr.write(f"LIVE API error: {type(exc).__name__}: {exc}\n")
            sys.stderr.flush()
            self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": "Внутренняя ошибка LIVE-сервера"})


def main() -> int:
    try:
        config = load_config()
        gateway = HyperliquidGateway(config)
        engine = GalkaLiveEngine(config, gateway)
    except (ConfigError, RuntimeError, GatewayError) as exc:
        print(f"Galka LIVE не запущена: {exc}", file=sys.stderr, flush=True)
        return 2

    GalkaRequestHandler.engine = engine
    server = ThreadingHTTPServer((config.host, config.port), GalkaRequestHandler)
    server.daemon_threads = True
    engine.start()

    print(f"Galka LIVE: http://{config.host}:{config.port}/terminal/live.html", flush=True)
    print(f"Сеть: {config.network_name} · аккаунт {config.masked_address}", flush=True)
    print(f"Режим: {'LIVE ENABLED' if config.live_enabled else 'READ ONLY'}", flush=True)
    print(
        f"Плечо: {config.leverage}x isolated · номинал одной GALKA: ${config.total_notional:.2f}",
        flush=True,
    )
    print("Секретный ключ загружен из локального файла и не передаётся браузеру.", flush=True)
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        engine.stop()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
