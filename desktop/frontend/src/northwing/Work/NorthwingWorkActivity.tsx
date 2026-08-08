import { Suspense } from "react";
import type { NorthwingDestination } from "../Navigation/routes";

export type NorthwingWorkActivityProps = {
  destination: NorthwingDestination;
  SessionWorkspace: React.ComponentType<{ destination: NorthwingDestination }>;
};

export function NorthwingWorkActivity({
  destination,
  SessionWorkspace,
}: NorthwingWorkActivityProps) {
  return (
    <div className="nw-work-activity">
      <Suspense
        fallback={
          <div className="nw-work-activity__loading">
            <p>Loading workspace...</p>
          </div>
        }
      >
        <SessionWorkspace destination={destination} />
      </Suspense>
    </div>
  );
}

