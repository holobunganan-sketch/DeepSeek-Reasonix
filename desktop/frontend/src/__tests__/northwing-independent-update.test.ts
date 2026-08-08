// Run: tsx src/__tests__/northwing-independent-update.test.ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const source = (path: string) => readFileSync(resolve(dir, path), "utf8");
const updater = source("../../../northwing_updater.go");
const releaseIdentity = source("../../../../internal/northwing/release_identity.go");
const hook = source("../lib/useUpdater.ts");
const bridge = source("../lib/northwingBridgeAugment.ts");
const installer = source("../../../../scripts/windows/northwing-installer.nsi");
const packager = source("../../../../scripts/package-northwing-windows.ps1");
const workflow = source("../../../../.github/workflows/northwing-release.yml");
const baseline = source("../../../../docs/REASONIX_BASELINE.md");

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

console.log("\nNorthwing independent update boundary");
ok(
  /ReleaseRepository = "holobunganan-sketch\/DeepSeek-Reasonix"/.test(releaseIdentity) &&
    /ReleasePageURL = "https:\/\/github\.com\/holobunganan-sketch\/DeepSeek-Reasonix\/releases"/.test(releaseIdentity) &&
    /LatestReleaseAPIURL = "https:\/\/api\.github\.com\/repos\/holobunganan-sketch\/DeepSeek-Reasonix\/releases\/latest"/.test(releaseIdentity) &&
    /northwing\.ReleaseRepository/.test(updater) &&
    /northwing\.LatestReleaseAPIURL/.test(updater) &&
    /northwing\.ReleasePageURL/.test(updater) &&
    !/holobunganan-sketch\/DeepSeek-Reasonix/.test(updater),
  "runtime uses the centralized independent Northwing release identity",
);
ok(!/esengine\/DeepSeek-Reasonix/.test(updater), "Northwing updater has no upstream Reasonix release endpoint");
ok(/ApplyNorthwingUpdateRequest/.test(updater), "Northwing has a dedicated verified apply binding");
ok(/ApplyNorthwingUpdateRequest/.test(hook) && !/app\.(?:CheckUpdate|ApplyUpdateRequest|OpenDownloadPage)\(/.test(hook), "frontend never hands a Northwing release to the inherited updater");
ok(/ApplyNorthwingUpdateRequest/.test(bridge), "Wails augmentation exposes the Northwing apply binding");
ok(/northwing-update-helper\.exe/.test(packager) && /northwing-update-helper\.exe/.test(installer), "helper is packaged and installed with Northwing");
ok(/SetOverwrite try/.test(installer) && /MB_RETRYCANCEL/.test(installer), "installer retries or aborts locked executable replacement without Ignore");
ok(/northwing-update\.json/.test(workflow) && /Northwing-\$\{\{ steps\.version\.outputs\.version \}\}/.test(workflow), "release publishes Northwing update metadata and Northwing-only artifacts");
ok(/not synchronized, rebased, merged, packaged, or distributed automatically/.test(baseline), "frozen-kernel policy is explicit");

if (failed) process.exit(1);
console.log("Northwing independent update boundary tests passed");
