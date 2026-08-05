// Run: tsx src/__tests__/northwing-branding.test.ts
import { brandText } from "../lib/i18n";

let failed = 0;
function equal(got: string, want: string, label: string) {
  if (got === want) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}\n`);
  }
}

console.log("\nNorthwing branding boundary");
equal(
  brandText("sidebar.navigation", "Reasonix navigation"),
  "Northwing navigation",
  "product chrome uses the Northwing name",
);
equal(
  brandText("approval.configWriteReason", "Reasonix-managed configuration file"),
  "Reasonix-managed configuration file",
  "kernel-owned configuration keeps its technical name",
);
equal(
  brandText("settings.effortProtocolDefault.auto", "Reasonix infers protocol defaults"),
  "Reasonix infers protocol defaults",
  "kernel protocol explanations keep the Reasonix term",
);

if (failed) process.exit(1);
console.log("Northwing branding boundary tests passed");
