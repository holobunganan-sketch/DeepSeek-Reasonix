/**
 * Northwing Quick Chat and Convert to Work - structural validation
 * Run: tsx src/__tests__/northwing-quick-chat.test.tsx
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

console.log("\nNorthwing Quick Chat");

// File existence
const chatPath = resolve(dir, "../northwing/QuickChat/NorthwingQuickChat.tsx");
const convertDialogPath = resolve(dir, "../northwing/QuickChat/NorthwingConvertToWorkDialog.tsx");
const convertControllerPath = resolve(dir, "../northwing/QuickChat/convertChatToWork.ts");
const cssPath = resolve(dir, "../northwing/QuickChat/NorthwingQuickChat.css");
ok(existsSync(chatPath), "QuickChat component exists");
ok(existsSync(convertDialogPath), "ConvertToWork dialog exists");
ok(existsSync(convertControllerPath), "convertChatToWork controller exists");
ok(existsSync(cssPath), "QuickChat CSS exists");

// Component checks
const chatSrc = readFileSync(chatPath, "utf8");
ok(/NorthwingQuickChat/.test(chatSrc), "exports NorthwingQuickChat");
ok(/Convert to Work/.test(chatSrc), "has Convert to Work button");
ok(/data-northwing-page="quick-chat"/i.test(chatSrc), "uses data-northwing-page attribute");
ok(/convertChatToWork/.test(chatSrc), "imports convertChatToWork controller");
ok(!/Reasonix/.test(chatSrc), "no Reasonix mention in Quick Chat UI");

// Convert dialog checks
const dialogSrc = readFileSync(convertDialogPath, "utf8");
ok(/NorthwingConvertToWorkDialog/.test(dialogSrc), "exports dialog component");
ok(/role="dialog"/i.test(dialogSrc), "dialog uses dialog role");
ok(/objective/.test(dialogSrc) && /finish/.test(dialogSrc), "prompts for objective");
ok(/"Create Work"/.test(dialogSrc), "confirm button says Create Work");
ok(/role="alert"/i.test(dialogSrc), "error uses alert role");

// Controller checks
const controllerSrc = readFileSync(convertControllerPath, "utf8");
ok(/convertChatToWork/.test(controllerSrc), "exports convertChatToWork");
ok(/EnsureWorkTab/.test(controllerSrc), "uses EnsureWorkTab for native Work binding");
ok(/UpsertCoworkWork/.test(controllerSrc), "persists Work contract");
ok(/SubmitInitialGoalToTab/.test(controllerSrc), "submits conversion goal");
ok(/Conversion from Quick Chat/.test(controllerSrc), "goal brief references chat origin");

// CSS checks
const cssSrc = readFileSync(cssPath, "utf8");
ok(/nw-quick-chat/.test(cssSrc), "CSS has Quick Chat layout");
ok(/nw-convert-dialog/.test(cssSrc), "CSS has dialog layout");
ok(/nw-quick-chat__convert/.test(cssSrc), "CSS has convert button styles");

// Routes: Quick Chat is NOT a session bypass destination
const routesPath = resolve(dir, "../northwing/Navigation/routes.ts");
const routesSrc = readFileSync(routesPath, "utf8");
ok(/isSessionDestination/.test(routesSrc), "isSessionDestination exists");
ok(/"quick-chat"/.test(routesSrc), "quick-chat is in the destination union");
ok(/isSessionDestination[^}]*return[^"]*"work"/.test(routesSrc),
  "isSessionDestination only returns work kind (quick-chat not bypassed)");

if (failed) process.exit(1);
console.log("Northwing Quick Chat tests passed");
