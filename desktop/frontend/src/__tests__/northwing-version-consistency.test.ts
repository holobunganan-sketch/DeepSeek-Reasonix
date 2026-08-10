import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(resolve(here, relative), "utf8");
const wails = JSON.parse(read("../../../wails.json")) as { info?: { productVersion?: string } };
const frontend = JSON.parse(read("../../package.json")) as { version?: string };
const releaseNotes = read("../../../../docs/NORTHWING_RELEASE_NOTES.md");
const releaseWorkflow = read("../../../../.github/workflows/northwing-release.yml");

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

console.log("\nNorthwing 0.3.1 version consistency");
ok(wails.info?.productVersion === "0.3.1", "Wails product authority is 0.3.1");
ok(frontend.version === wails.info?.productVersion, "frontend package matches the product authority");
ok(/^# Northwing 0\.3\.1$/m.test(releaseNotes), "release notes match the product authority");
ok(/resolve-northwing-release-version\.ps1/.test(releaseWorkflow), "release derives its version from the shared resolver");
ok(!/(?:Version|version)\s*[:=]\s*["']0\.3\.1["']/.test(releaseWorkflow), "release workflow does not duplicate a hard-coded version");

if (failed) process.exit(1);
console.log("Northwing version consistency tests passed");
