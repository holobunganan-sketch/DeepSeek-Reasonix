import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NorthwingShell } from "../../src/northwing/Shell/NorthwingShell";
import { buildMockGateway, __e2e_setCatalog } from "./mockGateway";
import type { NorthwingDestination } from "../../src/northwing/Navigation/routes";

// Expose for Playwright page.evaluate()
(window as Record<string, unknown>).__NORTHWING_E2E__ = {
  setCatalog: __e2e_setCatalog,
  navigateTo: undefined as ((dest: NorthwingDestination) => void) | undefined,
};

function E2ETestApp() {
  const gateway = buildMockGateway();
  return (
    <NorthwingShell
      initialDestination={{ kind: "home" }}
      gateway={{
        ...gateway,
        onNavigate: (dest: NorthwingDestination) => {
          (window as Record<string, unknown>).__NORTHWING_E2E_NAV__ = dest;
        },
      }}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <E2ETestApp />
  </StrictMode>,
);
