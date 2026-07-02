import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const python = "python";
const venvPython = "apps\\api\\.venv\\Scripts\\python.exe";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(venvPython)) {
  run(python, ["-m", "venv", "apps/api/.venv"]);
}

run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"]);
run(venvPython, ["-m", "pip", "install", "-e", "apps/api"]);
