import { Router } from "express";
import { spawn } from "child_process";
import { getSessionEmail } from "../sessionAuth";

const router = Router();

type CliResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
};

function runCli(
  command: string,
  args: string[],
  timeoutMs = 120_000,
  envOverrides: Record<string, string> = {},
): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      env: { ...process.env, ...envOverrides },
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let resolved = false;

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      try {
        child.kill();
      } catch {}
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr: `${stderr}\nTimeout after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr: `${stderr}\n${err.message}`,
      });
    });

    child.on("close", (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
      });
    });
  });
}

function runShell(script: string, timeoutMs = 120_000): Promise<CliResult> {
  return runCli("bash", ["-lc", script], timeoutMs);
}

async function hasNemoClawBinary(): Promise<boolean> {
  const check = await runShell("command -v nemoclaw >/dev/null 2>&1", 15_000);
  return check.ok;
}

async function ensureNemoClawInstalled(): Promise<CliResult> {
  if (await hasNemoClawBinary()) {
    return { ok: true, code: 0, stdout: "nemoclaw already installed", stderr: "" };
  }

  const installScript = `
set -euo pipefail
if command -v nemoclaw >/dev/null 2>&1; then
  echo "nemoclaw already installed"
  exit 0
fi
WORKDIR="/tmp/nemoclaw-source"
rm -rf "$WORKDIR"
git clone --depth 1 https://github.com/NVIDIA/NemoClaw.git "$WORKDIR"
OPENCLAW_VERSION=$(node -e 'const fs=require("fs");const pkg=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write((pkg.dependencies&&pkg.dependencies.openclaw)||"");' "$WORKDIR/package.json")
if [ -z "$OPENCLAW_VERSION" ]; then
  echo "Failed to resolve openclaw dependency version from NemoClaw package.json" >&2
  exit 1
fi
mkdir -p "$WORKDIR/node_modules/openclaw"
PACK_DIR=$(mktemp -d)
npm pack "openclaw@$OPENCLAW_VERSION" --pack-destination "$PACK_DIR" >/dev/null
tar xzf "$PACK_DIR"/openclaw-*.tgz -C "$WORKDIR/node_modules/openclaw" --strip-components=1
rm -rf "$PACK_DIR"
cd "$WORKDIR"
npm install --ignore-scripts
cd nemoclaw
npm install --ignore-scripts
npm run build
cd ..
npm link
command -v nemoclaw >/dev/null 2>&1
nemoclaw --version
`;

  return runShell(installScript, 1_200_000);
}

async function getNemoStatus() {
  const version = await runCli("nemoclaw", ["--version"], 20_000);
  if (!version.ok) {
    return {
      installed: false,
      ready: false,
      version: null as string | null,
      output: "",
      error: "NemoClaw is not installed yet. Use Run Onboard to install and configure it automatically.",
    };
  }

  const sandboxStatus = await runCli("nemoclaw", ["my-assistant", "status"], 45_000);
  return {
    installed: true,
    ready: sandboxStatus.ok,
    version: (version.stdout || version.stderr || "").trim() || null,
    output: `${(sandboxStatus.stdout || "").trim()}`.trim(),
    error: sandboxStatus.ok ? "" : (sandboxStatus.stderr || sandboxStatus.stdout || "").trim(),
  };
}

router.get("/nemoclaw/status", async (req, res) => {
  const email = getSessionEmail(req);
  if (!email) return res.status(401).json({ error: "Authentication required" });
  const status = await getNemoStatus();
  return res.json(status);
});

router.post("/nemoclaw/onboard", async (req, res) => {
  const email = getSessionEmail(req);
  if (!email) return res.status(401).json({ error: "Authentication required" });

  const install = await ensureNemoClawInstalled();
  if (!install.ok) {
    return res.status(500).json({
      ok: false,
      code: install.code,
      stdout: install.stdout,
      stderr: install.stderr,
      step: "install",
    });
  }

  // Non-interactive quick onboarding. If upstream requires API key prompts,
  // the output is returned so the UI can guide the user.
  const onboard = await runCli(
    "nemoclaw",
    ["onboard", "--non-interactive"],
    600_000,
    {
      NVIDIA_API_KEY: process.env.NVIDIA_API_KEY ?? "",
    },
  );
  return res.json({
    ok: onboard.ok,
    code: onboard.code,
    stdout: `${install.stdout}\n${onboard.stdout}`,
    stderr: onboard.stderr,
  });
});

router.post("/nemoclaw/start", async (req, res) => {
  const email = getSessionEmail(req);
  if (!email) return res.status(401).json({ error: "Authentication required" });

  const install = await ensureNemoClawInstalled();
  if (!install.ok) {
    return res.status(500).json({
      ok: false,
      code: install.code,
      stdout: install.stdout,
      stderr: install.stderr,
      step: "install",
    });
  }

  const result = await runCli("nemoclaw", ["start"], 120_000);
  return res.json({
    ok: result.ok,
    code: result.code,
    stdout: `${install.stdout}\n${result.stdout}`,
    stderr: result.stderr,
  });
});

router.get("/nemoclaw/launch", async (req, res) => {
  const email = getSessionEmail(req);
  if (!email) return res.status(401).json({ error: "Authentication required" });

  // NemoClaw itself is CLI-first; once running, users continue in OpenClaw chat.
  return res.json({
    launchUrl: "/openclaw",
  });
});

export default router;
