import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const DOCKER_IMAGE = process.env.OPENCLAW_DOCKER_IMAGE;
const CONTAINER_PORT = parseInt(process.env.OPENCLAW_CONTAINER_PORT || "3000", 10);
const PORT_START = parseInt(process.env.OPENCLAW_PORT_RANGE_START || "4000", 10);
const PORT_END = parseInt(process.env.OPENCLAW_PORT_RANGE_END || "5000", 10);

export function isDockerProvisioningEnabled(): boolean {
  return !!DOCKER_IMAGE;
}

function containerName(userId: string): string {
  return `openclaw-${userId.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 48)}`;
}

async function getUsedHostPorts(): Promise<Set<number>> {
  try {
    const { stdout } = await execFileAsync("docker", [
      "ps", "-a",
      "--filter", "name=openclaw-",
      "--format", "{{.Ports}}",
    ]);
    const used = new Set<number>();
    for (const line of stdout.split("\n")) {
      for (const match of line.matchAll(/:(\d+)->/g)) {
        used.add(parseInt(match[1], 10));
      }
    }
    return used;
  } catch {
    return new Set();
  }
}

async function findFreePort(): Promise<number> {
  const used = await getUsedHostPorts();
  for (let port = PORT_START; port <= PORT_END; port++) {
    if (!used.has(port)) return port;
  }
  throw new Error(`No free ports available in range ${PORT_START}–${PORT_END}`);
}

/**
 * Ensures a Docker container is running for the given user and returns
 * its internal URL (http://localhost:{port}).
 *
 * Safe to call multiple times — re-uses existing containers.
 */
export async function provisionInstance(userId: string): Promise<string> {
  if (!DOCKER_IMAGE) {
    throw new Error("OPENCLAW_DOCKER_IMAGE environment variable is not set");
  }

  const name = containerName(userId);

  // Check if container already exists (running or stopped).
  try {
    const { stdout: stateOut } = await execFileAsync("docker", [
      "inspect", "-f", "{{.State.Status}}", name,
    ]);
    const state = stateOut.trim();

    if (state === "exited" || state === "created") {
      await execFileAsync("docker", ["start", name]);
    }

    // Container exists (and is now running) — get its mapped port.
    const { stdout: portOut } = await execFileAsync("docker", [
      "port", name, String(CONTAINER_PORT),
    ]);
    const portMatch = portOut.match(/:(\d+)/);
    if (!portMatch) throw new Error(`Could not determine host port for container ${name}`);
    console.log(`[docker] reusing container ${name} on port ${portMatch[1]}`);
    return `http://localhost:${portMatch[1]}`;
  } catch (err: any) {
    // "docker inspect" exits non-zero when the container doesn't exist — fall through.
    if (!err.message?.includes("No such")) throw err;
  }

  // Container doesn't exist — create it.
  const port = await findFreePort();
  await execFileAsync("docker", [
    "run", "-d",
    "--name", name,
    "--restart", "unless-stopped",
    "-p", `${port}:${CONTAINER_PORT}`,
    "-e", `OPENCLAW_USER_ID=${userId}`,
    DOCKER_IMAGE,
  ]);

  console.log(`[docker] started container ${name} on port ${port}`);
  return `http://localhost:${port}`;
}
