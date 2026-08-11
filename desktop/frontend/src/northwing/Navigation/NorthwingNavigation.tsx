import { Home, FolderKanban, Briefcase, Package, Settings, Plus } from "lucide-react";
import type { NorthwingDestination } from "./routes";
import { sameNorthwingWorkspace } from "../../lib/northwingWorkspaceIdentity";
import { useT } from "../../lib/i18n";

export type NorthwingNavigationProps = {
  current: NorthwingDestination;
  onNavigate: (destination: NorthwingDestination) => void;
  onNewWork: () => void;
};

type NavItem = {
  label: string;
  destination: NorthwingDestination;
  icon: React.ReactNode;
};

export function NorthwingNavigation({ current, onNavigate, onNewWork }: NorthwingNavigationProps) {
  const t = useT();
  const primaryItems: NavItem[] = [
    { label: t("northwing.nav.home"), destination: { kind: "home" }, icon: <Home size={18} aria-hidden="true" /> },
    { label: t("northwing.nav.projects"), destination: { kind: "projects" }, icon: <FolderKanban size={18} aria-hidden="true" /> },
    { label: t("northwing.nav.work"), destination: { kind: "work-list" }, icon: <Briefcase size={18} aria-hidden="true" /> },
    { label: t("northwing.nav.artifacts"), destination: { kind: "artifacts" }, icon: <Package size={18} aria-hidden="true" /> },
  ];

  const secondaryItems: NavItem[] = [
    { label: t("northwing.nav.settings"), destination: { kind: "settings" }, icon: <Settings size={18} aria-hidden="true" /> },
  ];

  const isActive = (destination: NorthwingDestination) => {
    if (destination.kind !== current.kind) return false;
    if (destination.kind === "project" && current.kind === "project") {
      return sameNorthwingWorkspace(destination.workspaceRoot, current.workspaceRoot);
    }
    if (destination.kind === "work" && current.kind === "work") {
      return sameNorthwingWorkspace(destination.workspaceRoot, current.workspaceRoot) && destination.workId === current.workId;
    }
    return true;
  };

  return (
    <nav className="northwing-navigation" aria-label={t("northwing.nav.label")}>
      <div className="northwing-navigation__brand">
        <span className="northwing-navigation__logo">Northwing</span>
      </div>

      <button
        type="button"
        className="northwing-navigation__new-work nw-btn nw-btn--primary"
        aria-label={t("northwing.nav.newWork")}
        onClick={onNewWork}
      >
        <Plus size={18} aria-hidden="true" />
        <span>{t("northwing.nav.newWork")}</span>
      </button>

      <ul className="northwing-navigation__list" role="list">
        {primaryItems.map((item) => (
          <li key={item.label}>
            <a
              href="#"
              role="link"
              aria-current={isActive(item.destination) ? "page" : undefined}
              className={`northwing-navigation__link nw-link${isActive(item.destination) ? " nw-link--active" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.destination);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>

      <div className="northwing-navigation__divider" role="separator" />

      <ul className="northwing-navigation__list" role="list">
        {secondaryItems.map((item) => (
          <li key={item.label}>
            <a
              href="#"
              role="link"
              aria-current={isActive(item.destination) ? "page" : undefined}
              className={`northwing-navigation__link nw-link${isActive(item.destination) ? " nw-link--active" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.destination);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
