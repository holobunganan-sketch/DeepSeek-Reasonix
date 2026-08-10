import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const helper = readFileSync(resolve(here, "../../../../cmd/northwing-update-helper/main_windows.go"), "utf8");

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

console.log("\nNorthwing update helper security boundary");
ok(!/cmd\.exe/i.test(helper), "cleanup never launches cmd.exe");
ok(!/powershell\.exe/i.test(helper), "cleanup never launches PowerShell");
ok(!/\bping\b/i.test(helper), "cleanup never uses ping as a delay");
ok(!/MOVEFILE_DELAY_UNTIL_REBOOT/.test(helper), "per-user cleanup does not require administrator-only delayed-reboot deletion");
ok(/--cleanup-after-pid/.test(helper), "a native helper child waits for the update process before cleanup");
ok(/validateCleanupTarget/.test(helper), "cleanup validates that the staging directory owns the running helper");
ok(/cleanup-error\.log/.test(helper), "cleanup failures leave a diagnostic in the staging directory");

if (failed) process.exit(1);
console.log("Northwing update helper security boundary tests passed");
