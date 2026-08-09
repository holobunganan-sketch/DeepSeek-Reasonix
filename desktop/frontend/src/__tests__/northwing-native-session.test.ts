/**
 * Northwing native session identity - contract tests
 * Run: tsx src/__tests__/northwing-native-session.test.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write("  PASS  " + label + "\n");
  else {
    failed += 1;
    process.stdout.write("  FAIL  " + label + "\n");
  }
}

console.log("\nNorthwing native session identity");

// Go backend: TabMeta and WorkTabMeta expose SessionKind / WorkID
const tabsGoPath = resolve(dir, "../../../../desktop/tabs.go");
ok(existsSync(tabsGoPath), "desktop/tabs.go exists");
const tabsGo = readFileSync(tabsGoPath, "utf8");
ok(/SessionKind\s+agent\.SessionKind\s+`json:"sessionKind"`/.test(tabsGo),
  "TabMeta exposes native SessionKind");
ok(/WorkID\s+string\s+`json:"workId,omitempty"`/.test(tabsGo),
  "TabMeta exposes WorkID for Work sessions");

// Go backend: EnsureWorkTab exists
ok(/func \(a \*App\) EnsureWorkTab/.test(tabsGo),
  "Go EnsureWorkTab method exists");
ok(/agent\.SessionKindWork/.test(tabsGo),
  "Go sets SessionKind=work in EnsureWorkTab");

// Agent layer: SessionKind types
const sessionIdentityGoPath = resolve(dir, "../../../../internal/agent/session_identity.go");
ok(existsSync(sessionIdentityGoPath), "internal/agent/session_identity.go exists");
const sessionIdentityGo = readFileSync(sessionIdentityGoPath, "utf8");
ok(/SessionKindChat\s+SessionKind\s+=\s+"chat"/.test(sessionIdentityGo),
  "SessionKindChat constant exists");
ok(/SessionKindWork\s+SessionKind\s+=\s+"work"/.test(sessionIdentityGo),
  "SessionKindWork constant exists");

// Bridge: EnsureWorkTab exists in TypeScript bridge
const bridgePath = resolve(dir, "../lib/bridge.ts");
ok(existsSync(bridgePath), "bridge.ts exists");
const bridgeSrc = readFileSync(bridgePath, "utf8");
ok(/EnsureWorkTab\(workspaceRoot: string, workID: string\): Promise<TabMeta>/.test(bridgeSrc),
  "TypeScript bridge declares EnsureWorkTab");

// northwingCowork.ts: launchCoworkWork uses EnsureWorkTab
const coworkPath = resolve(dir, "../lib/northwingCowork.ts");
const coworkSrc = readFileSync(coworkPath, "utf8");
ok(/EnsureWorkTab/.test(coworkSrc),
  "northwingCowork.ts references EnsureWorkTab");

// Migration/summary: 0.2 Work projects expose native SessionKind=work
const summaryPath = resolve(dir, "../../../../internal/cowork/summary.go");
ok(existsSync(summaryPath), "internal/cowork/summary.go exists");
const summarySrc = readFileSync(summaryPath, "utf8");
ok(/SessionKind/.test(summarySrc) && /"work"/.test(summarySrc),
  "summary.go exposes SessionKind=work for active Works");

// NewWork controller: uses EnsureWorkTab
const controllerPath = resolve(dir, "../northwing/NewWork/newWorkController.ts");
const controllerSrc = readFileSync(controllerPath, "utf8");
ok(/app\.EnsureWorkTab/.test(controllerSrc),
  "newWorkController calls EnsureWorkTab directly");

if (failed) process.exit(1);
console.log("Northwing native session identity tests passed");
