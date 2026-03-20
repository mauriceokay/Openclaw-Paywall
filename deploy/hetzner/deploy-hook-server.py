import json
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


DEPLOY_SECRET = os.environ.get("DEPLOY_WEBHOOK_SECRET", "")
DEPLOY_BRANCH = os.environ.get("DEPLOY_GIT_BRANCH", "master")
DEPLOY_REMOTE = os.environ.get("DEPLOY_GIT_REMOTE", "origin")
PORT = int(os.environ.get("PORT", "9000"))
WORKSPACE = "/workspace"
COMPOSE_FILE = f"{WORKSPACE}/deploy/hetzner/docker-compose.yml"
ENV_FILE = f"{WORKSPACE}/deploy/hetzner/.env"

deploy_lock = threading.Lock()


def run_command(command: list[str]) -> tuple[int, str]:
    proc = subprocess.run(
        command,
        cwd=WORKSPACE,
        capture_output=True,
        text=True,
        timeout=1200,
        check=False,
    )
    output = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode, output


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, body: dict):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == "/healthz":
            self._send_json(200, {"ok": True})
            return
        self._send_json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path not in ("/", "/deploy"):
            self._send_json(404, {"error": "not_found"})
            return

        if not DEPLOY_SECRET:
            self._send_json(500, {"error": "DEPLOY_WEBHOOK_SECRET is not configured"})
            return

        token = self.headers.get("X-Deploy-Token", "")
        if token != DEPLOY_SECRET:
            self._send_json(401, {"error": "unauthorized"})
            return

        content_length = int(self.headers.get("Content-Length") or 0)
        raw_body = self.rfile.read(content_length) if content_length > 0 else b""
        ref = None
        if raw_body:
            try:
                payload = json.loads(raw_body.decode("utf-8"))
                ref = payload.get("ref")
            except Exception:
                pass

        if ref and ref != f"refs/heads/{DEPLOY_BRANCH}":
            self._send_json(202, {"ok": True, "ignored": True, "reason": f"ref={ref}"})
            return

        if not deploy_lock.acquire(blocking=False):
            self._send_json(409, {"ok": False, "error": "deploy_already_running"})
            return

        try:
            commands = [
                ["git", "-C", WORKSPACE, "pull", DEPLOY_REMOTE, DEPLOY_BRANCH],
                [
                    "docker",
                    "compose",
                    "--env-file",
                    ENV_FILE,
                    "-f",
                    COMPOSE_FILE,
                    "up",
                    "-d",
                    "--build",
                    "--remove-orphans",
                ],
            ]

            logs: list[str] = []
            for cmd in commands:
                rc, out = run_command(cmd)
                logs.append(f"$ {' '.join(cmd)}\n{out}")
                if rc != 0:
                    self._send_json(
                        500,
                        {
                            "ok": False,
                            "failedCommand": " ".join(cmd),
                            "logs": "\n".join(logs)[-12000:],
                        },
                    )
                    return

            self._send_json(200, {"ok": True, "logs": "\n".join(logs)[-12000:]})
        except subprocess.TimeoutExpired:
            self._send_json(504, {"ok": False, "error": "deploy_timeout"})
        finally:
            deploy_lock.release()

    def log_message(self, _format, *_args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.serve_forever()
