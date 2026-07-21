#!/usr/bin/env python3
"""Mercury Web macOS launcher — starts uvicorn and opens the default browser."""

from __future__ import annotations

import atexit
import logging
import os
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

HOST = "127.0.0.1"
DEFAULT_PORT = 6789
APP_NAME = "Mercury Web"


def _setup_paths() -> Path:
    if getattr(sys, "frozen", False):
        bundle = Path(sys._MEIPASS)
        backend = bundle / "backend"
    else:
        backend = Path(__file__).resolve().parents[1] / "backend"
    os.environ.setdefault("PYTHONPATH", str(backend))
    if str(backend) not in sys.path:
        sys.path.insert(0, str(backend))
    return backend


def _logs_dir() -> Path:
    if getattr(sys, "frozen", False):
        path = Path.home() / "Library" / "Logs" / APP_NAME
    else:
        path = Path(__file__).resolve().parents[1] / "data" / "logs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _setup_logging() -> None:
    log_file = _logs_dir() / "launcher.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stderr),
        ],
    )


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex((HOST, port)) == 0


def _pick_port() -> int:
    if not _port_in_use(DEFAULT_PORT):
        return DEFAULT_PORT
    logging.warning("Port %s is in use, searching for a free port", DEFAULT_PORT)
    for port in range(DEFAULT_PORT + 1, DEFAULT_PORT + 20):
        if not _port_in_use(port):
            return port
    raise RuntimeError(f"No free port found near {DEFAULT_PORT}")


def _wait_for_health(port: int, timeout: float = 30.0) -> None:
    url = f"http://{HOST}:{port}/api/health"
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as resp:
                if resp.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.25)
    raise RuntimeError(f"Server did not become ready at {url}")


def _open_browser(url: str) -> None:
    subprocess.run(["open", url], check=False)


class ServerProcess:
    def __init__(self, backend: Path, port: int) -> None:
        self.backend = backend
        self.port = port
        self._proc: subprocess.Popen[str] | None = None
        self._thread: threading.Thread | None = None

    @property
    def url(self) -> str:
        return f"http://{HOST}:{self.port}"

    def start(self) -> None:
        env = os.environ.copy()
        env["PYTHONPATH"] = str(self.backend)

        if getattr(sys, "frozen", False):
            # Run uvicorn in-process when frozen (PyInstaller bundles Python).
            self._start_inprocess()
        else:
            self._start_subprocess(env)

        _wait_for_health(self.port)
        logging.info("Server ready at %s", self.url)
        _open_browser(self.url)

    def _start_subprocess(self, env: dict[str, str]) -> None:
        cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            HOST,
            "--port",
            str(self.port),
            "--app-dir",
            str(self.backend),
        ]
        self._proc = subprocess.Popen(
            cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        atexit.register(self.stop)

        def pump() -> None:
            assert self._proc is not None and self._proc.stdout is not None
            for line in self._proc.stdout:
                logging.info("[uvicorn] %s", line.rstrip())

        self._thread = threading.Thread(target=pump, daemon=True)
        self._thread.start()

    def _start_inprocess(self) -> None:
        import uvicorn

        config = uvicorn.Config(
            "app.main:app",
            host=HOST,
            port=self.port,
            log_level="info",
        )
        server = uvicorn.Server(config)

        def run() -> None:
            server.run()

        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()
        self._server = server
        atexit.register(self.stop)

    def stop(self) -> None:
        if self._proc is not None and self._proc.poll() is None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()
            self._proc = None
        if hasattr(self, "_server"):
            self._server.should_exit = True


def main() -> None:
    _setup_logging()
    backend = _setup_paths()
    port = _pick_port()
    server = ServerProcess(backend, port)

    def handle_signal(signum: int, _frame: object) -> None:
        logging.info("Received signal %s, shutting down", signum)
        server.stop()
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    try:
        server.start()
        logging.info("Mercury Web is running. Press Ctrl+C to quit.")
        while True:
            if server._proc is not None and server._proc.poll() is not None:
                raise RuntimeError("uvicorn exited unexpectedly")
            time.sleep(1)
    except KeyboardInterrupt:
        logging.info("Interrupted by user")
    finally:
        server.stop()


if __name__ == "__main__":
    main()
