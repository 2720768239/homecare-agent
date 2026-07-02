import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const rootDir = process.cwd();
const apiDir = path.join(rootDir, "apps", "api");
const pythonCommand = isWindows
  ? path.join(apiDir, ".venv", "Scripts", "python.exe")
  : path.join(apiDir, ".venv", "bin", "python");

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findPort(startPort, host) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await canListen(port, host)) {
      return port;
    }
  }
  throw new Error(`No available port found from ${startPort} to ${startPort + 19}`);
}

function prefixOutput(child, label) {
  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`.replaceAll("\n", `\n[${label}] `));
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`.replaceAll("\n", `\n[${label}] `));
  });
}

const webPort = await findPort(3000);
const apiPort = await findPort(8000, "127.0.0.1");
const apiBaseUrl = `http://localhost:${apiPort}`;

console.log(`Starting web on http://localhost:${webPort}`);
console.log(`Starting api on ${apiBaseUrl}`);

const web = spawn(
  npmCommand,
  ["run", "dev", "--prefix", "apps/web", "--", "-p", String(webPort)],
  {
    env: {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
    },
    stdio: ["inherit", "pipe", "pipe"],
    shell: isWindows,
  },
);

const api = spawn(
  pythonCommand,
  ["-m", "uvicorn", "main:app", "--reload", "--port", String(apiPort)],
  {
    cwd: apiDir,
    stdio: ["inherit", "pipe", "pipe"],
    shell: false,
  },
);

prefixOutput(web, "web");
prefixOutput(api, "api");

function stopChildren() {
  for (const child of [web, api]) {
    if (!child.killed) {
      child.kill();
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopChildren();
    process.exit(0);
  });
}

for (const [label, child] of [
  ["web", web],
  ["api", api],
]) {
  child.on("exit", (code, signal) => {
    if (code !== 0 && signal === null) {
      console.error(`${label} exited with code ${code}`);
      stopChildren();
      process.exit(code ?? 1);
    }
  });
}
