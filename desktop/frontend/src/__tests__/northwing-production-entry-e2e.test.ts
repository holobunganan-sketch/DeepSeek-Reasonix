import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(resolve(here, relative), "utf8");
const bridge = read("../../e2e/production-entry/bridge.ts");
const config = read("../../playwright.config.ts");
const specs = [
  read("../../e2e/northwing-brand.spec.ts"),
  read("../../e2e/northwing-bundle.spec.ts"),
  read("../../e2e/northwing-work-path.spec.ts"),
  read("../../e2e/northwing-production-entry.spec.ts"),
].join("\n");

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

console.log("\nNorthwing production-entry E2E boundary");
ok(/await import\("\.\.\/\.\.\/src\/main\.tsx"\)/.test(bridge), "controlled bridge imports the real production entry");
ok(!/createRoot|<NorthwingShell/.test(bridge), "E2E bridge does not define a second React bootstrap");
ok(/window\.go\s*=/.test(bridge) && /window\.runtime\s*=/.test(bridge), "controlled injection is limited to the Wails bridge layer");
ok(!specs.includes("/e2e/test-app/index.html"), "all browser specs use the production entry");
ok(!existsSync(resolve(here, "../../e2e/test-app/main.tsx")), "independent mock application bootstrap is removed");
for (const [width, height] of [[760, 480], [1024, 640], [1240, 720], [1440, 900]]) {
  ok(config.includes(`width: ${width}, height: ${height}`), `${width}×${height} viewport is a Playwright project`);
}
ok(/fresh workspace creates Project and durable Work/.test(specs), "first Project/Work creation runs through production wiring");
ok(/Artifact preview, open, reveal, final/.test(specs), "Artifact production actions are covered");
ok(/Windows controls call the real bridge contract/.test(specs), "Windows controls are covered through production wiring");

if (failed) process.exit(1);
console.log("Northwing production-entry E2E boundary tests passed");
