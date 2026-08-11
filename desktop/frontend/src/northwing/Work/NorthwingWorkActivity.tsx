import { Suspense } from "react";
import type { NorthwingDestination } from "../Navigation/routes";
import { useT } from "../../lib/i18n";

export type NorthwingWorkActivityProps = {
  destination: NorthwingDestination;
  SessionWorkspace: React.ComponentType<{ destination: NorthwingDestination }>;
};

export function NorthwingWorkActivity({
  destination,
  SessionWorkspace,
}: NorthwingWorkActivityProps) {
  const t = useT();
  return (
    <div className="nw-work-activity">
      <Suspense
        fallback={
          <div className="nw-work-activity__loading">
            <p>{t("northwing.work.loadingWorkspace")}</p>
          </div>
        }
      >
        <SessionWorkspace destination={destination} />
      </Suspense>
    </div>
  );
}
