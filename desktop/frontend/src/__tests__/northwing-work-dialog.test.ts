// Run: tsx src/__tests__/northwing-work-dialog.test.ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "../components/NorthwingWorkDialog.tsx"), "utf8");

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

console.log("\nNorthwing guided Work dialog");
ok(/app\.Models\(\)/.test(source), "dialog reads the configured Reasonix model catalog");
ok(/WORK_KINDS/.test(source) && /WORK_QUALITIES/.test(source) && /SOURCE_POLICIES/.test(source), "dialog exposes fixed Work, quality, and source modes");
ok(/normalizeWorkSpec/.test(source) && /workSpecSummary/.test(source), "dialog previews the compiled Work contract");
ok(/<details/.test(source) && /advanced/i.test(source), "advanced free-text controls are collapsed by default");
ok(/launchCoworkWork\(workspaceRoot, draft\)/.test(source), "guided draft launches the native Work session");
ok(!/API Key/i.test(source), "dialog never asks for an API key");
ok(!/opencode-go/i.test(source), "dialog has no OpenCode-specific model dependency");
ok(/materialsPlaceholder:[\s\S]*sources\/protocol\.pdf/.test(source), "material paths remain optional and project-relative");
ok(/modelRef/.test(source) && /reasoningEffort/.test(source), "model and effort binding are part of the Work draft");

if (failed) process.exit(1);
console.log("Northwing guided Work dialog tests passed");
