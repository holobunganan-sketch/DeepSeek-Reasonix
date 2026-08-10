/**
 * Northwing New Work - structural UI validation
 * Run: tsx src/__tests__/northwing-new-work.test.tsx
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

console.log("\nNorthwing New Work form");

// File existence
const componentPath = resolve(dir, "../northwing/NewWork/NorthwingNewWork.tsx");
const controllerPath = resolve(dir, "../northwing/NewWork/newWorkController.ts");
const cssPath = resolve(dir, "../northwing/NewWork/NorthwingNewWork.css");
ok(existsSync(componentPath), "NewWork component file exists");
ok(existsSync(controllerPath), "NewWork controller file exists");
ok(existsSync(cssPath), "NewWork CSS file exists");

// Component source checks
const componentSrc = readFileSync(componentPath, "utf8");
ok(/NewWorkFormState/.test(componentSrc), "defines NewWorkFormState type");
ok(/objective/.test(componentSrc) && /materials/.test(componentSrc), "form has objective and materials fields");
ok(/outputType/.test(componentSrc) && /quality/.test(componentSrc), "form has outputType and quality fields");
ok(/sourcePolicy/.test(componentSrc) && /modelRef/.test(componentSrc), "form has sourcePolicy and modelRef fields");
ok(/showAdvanced/.test(componentSrc), "advanced controls are collapsed by default");
ok(/data-northwing-page="new-work"/i.test(componentSrc), "renders with northwing data page attribute");
ok(/role="dialog"/i.test(componentSrc), "uses dialog role for accessibility");
ok(/"Start Work"/.test(componentSrc), "primary CTA is Start Work");
ok(/What do you want to finish/.test(componentSrc), "prompts for objective");
ok(/aria-expanded=/.test(componentSrc), "advanced toggle has aria-expanded");
ok(/role="alert"/i.test(componentSrc), "error messages use alert role");
ok(!/Reasonix/.test(componentSrc), "no Reasonix mention in New Work UI");

// Controller checks
const controllerSrc = readFileSync(controllerPath, "utf8");
ok(/launchNewWork/.test(controllerSrc), "exports launchNewWork");
ok(/launchCoworkWork/.test(controllerSrc), "launchNewWork delegates to the shared durable Work lifecycle");
ok(/kind: form\.outputType/.test(controllerSrc), "launchNewWork maps the form output type into the shared Work specification");

// CSS checks
const cssSrc = readFileSync(cssPath, "utf8");
ok(/nw-new-work__card/.test(cssSrc), "CSS defines card layout");
ok(/nw-new-work__advanced-toggle/.test(cssSrc), "CSS defines advanced toggle");
ok(/nw-new-work__error/.test(cssSrc), "CSS defines error state");
ok(/nw-new-work__actions/.test(cssSrc), "CSS defines action bar");

// Launch path check
const coworkPath = resolve(dir, "../lib/northwingCowork.ts");
const coworkSrc = readFileSync(coworkPath, "utf8");
ok(/EnsureWorkTab/.test(coworkSrc), "launchCoworkWork uses EnsureWorkTab for native Work identity");
ok(/prepareCoworkProject/.test(coworkSrc), "launchCoworkWork prepares the Project before native Work identity");
ok(/ValidateCoworkProjectWritable/.test(coworkSrc), "launchCoworkWork preflights Project writability");

if (failed) process.exit(1);
console.log("Northwing New Work tests passed");
