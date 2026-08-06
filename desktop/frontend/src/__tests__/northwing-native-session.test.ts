// Run: tsx src/__tests__/northwing-native-session.test.ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "../lib/northwingCowork.ts"), "utf8");

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

console.log("\nNorthwing native Work session");
ok(/ensureCoworkProject\(workspaceRoot\)/.test(source), "Work creation lazily ensures project metadata");
ok(/SetModelForTab\(tab\.id, spec\.modelRef\)/.test(source), "selected Reasonix model is applied to the native tab");
ok(/SetEffortForTab\(tab\.id, spec\.reasoningEffort\)/.test(source), "selected reasoning effort is applied to the native tab");
ok(/SetTokenModeForTab\(tab\.id, "delivery"\)/.test(source), "Work uses the existing Delivery runtime profile");

const persist = source.indexOf('requiredBinding("UpsertCoworkWork")(workspaceRoot, work)');
const submit = source.indexOf("await submitGoal(tab, spec.objective, brief, spec.title)");
ok(persist >= 0 && submit > persist, "Work policy is persisted before the first provider request");

const openStart = source.indexOf("export async function openCoworkWork");
const openBody = source.slice(openStart, source.indexOf("export async function continueCoworkWork"));
ok(/applyWorkBinding\(tab, work\)/.test(openBody), "opening a saved Work reapplies its model binding");
ok(/compileWorkBrief\(workID, spec\)/.test(source), "initial Goal receives the structured Work contract");
ok(/kind: spec\.kind/.test(source) && /quality: spec\.quality/.test(source), "persisted Work link records Harness policy");
ok(!/opencode-go/.test(source), "native Work launch has no OpenCode-specific dependency");

if (failed) process.exit(1);
console.log("Northwing native Work session tests passed");
