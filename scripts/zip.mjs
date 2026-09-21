// Zips ./dist into ./release/auto-tab-closer-v<version>.zip for the Chrome Web Store.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const dist = resolve("dist");
if (!existsSync(dist)) {
  console.error("dist/ not found. Run `npm run build` first.");
  process.exit(1);
}
mkdirSync("release", { recursive: true });
const out = resolve("release", `auto-tab-closer-v${pkg.version}.zip`);
rmSync(out, { force: true });
execFileSync("zip", ["-r", "-X", out, "."], { cwd: dist, stdio: "inherit" });
console.log(`wrote ${out}`);
