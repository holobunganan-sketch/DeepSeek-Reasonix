import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../..");
const read = (relative: string) => {
  const path = resolve(root, relative);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};
const workflow = read(".github/workflows/northwing-release.yml");
const defender = read("scripts/scan-northwing-windows-defender.ps1");
const nativeSmoke = read("scripts/smoke-northwing-native-window.ps1");

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

console.log("\nNorthwing stable release gates");
ok(!/UnsignedTestArtifact|AllowUnsignedTestArtifact/.test(workflow), "stable release has no unsigned test escape hatch");
ok(/NORTHWING_WINDOWS_RELEASE_CREDENTIAL/.test(workflow), "stable release requires the signing credential");
ok(/-PrepareCredential/.test(workflow) && /-SignPayload/.test(workflow) && /-SignSetup/.test(workflow), "payload and setup signing are explicit gates");
ok(/go test \.\/\.\.\./.test(workflow), "root Go suite gates release");
ok(/working-directory: desktop[\s\S]{0,160}go test \.\/\.\.\./.test(workflow), "desktop Go suite gates release");
for (const command of ["pnpm install --frozen-lockfile", "pnpm typecheck", "pnpm test", "pnpm build", "pnpm test:e2e"]) {
  ok(workflow.includes(command), `${command} gates release`);
}
ok(/verify-northwing-windows\.ps1/.test(workflow) && !/verify-northwing-windows\.ps1[^\n]*AllowUnsigned/.test(workflow), "formal Windows package verification gates release");
ok(/smoke-northwing-native-window\.ps1[^\n]*-RequireInteractiveWindow/.test(workflow), "interactive native window smoke gates stable release");
ok(/GetWindowText/.test(nativeSmoke) && /GetClientRect/.test(nativeSmoke), "native smoke verifies window title and 1240×720 client geometry");
ok(
  /SystemParametersInfo/.test(nativeSmoke) &&
    /workArea/.test(nativeSmoke) &&
    /work-area-constrained/.test(nativeSmoke) &&
    /760/.test(nativeSmoke) &&
    /480/.test(nativeSmoke),
  "native smoke distinguishes an OS work-area clamp from an invalid default or undersized window",
);
ok(/IsIconic/.test(nativeSmoke) && /IsZoomed/.test(nativeSmoke), "native smoke verifies minimize, maximize, and restore state");
ok(/secondLaunch/.test(nativeSmoke) && /WM_CLOSE/.test(nativeSmoke), "native smoke verifies single-instance launch and normal close");
ok(/scan-northwing-windows-defender\.ps1[^\n]*-RequireScanner/.test(workflow), "Defender availability and clean scans gate release");
ok(/northwing\.exe/.test(defender) && /northwing-update-helper\.exe/.test(defender) && /windows-x64-setup\.exe/.test(defender), "Defender scans setup, app, and update helper separately");
ok(/Get-MpComputerStatus/.test(defender) && /Get-FileHash/.test(defender), "Defender report records engine/signature metadata and SHA-256");
ok(/northwing-update\.json/.test(workflow) && /northwing-update\.json\.sig/.test(workflow), "signed update manifest is published with stable packages");
const defenderGate = workflow.indexOf("scan-northwing-windows-defender.ps1");
ok(defenderGate >= 0 && workflow.indexOf("Publish GitHub Release") > defenderGate, "publication occurs only after Defender verification");

if (failed) process.exit(1);
console.log("Northwing stable release gate tests passed");
