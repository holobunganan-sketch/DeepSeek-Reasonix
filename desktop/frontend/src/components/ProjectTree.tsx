import { lazy, Suspense, type ComponentProps } from "react";
import { ProjectTree as ReasonixProjectTree } from "./ReasonixProjectTree";

const NorthwingCoworkRail = lazy(() => import("./NorthwingCoworkRail").then((module) => ({
  default: module.NorthwingCoworkRail,
})));

export {
  CLASSIC_TOPIC_PREVIEW_LIMIT,
  activeSessionAncestorKeys,
  arrangeClassicProjectTree,
  classicTopicWindow,
  defaultExpandedProjectTreeKeys,
  projectTreeDedupedExactTime,
  projectTreeFolderDisclosure,
  projectTreeReadActivityKey,
  projectTreeShouldRenderTopicActions,
  projectTreeShouldSuppressOpenForRename,
  projectTreeTopicArchiveBlocked,
  projectTreeTopicHasUnreadActivity,
  projectTreeTopicHoverCardModel,
  projectTreeTopicMenuOffersPin,
  projectTreeTopicMetaLine,
  projectTreeTopicOpenRequest,
  splitPinnedProjectTree,
} from "./ReasonixProjectTree";

export type {
  ProjectTreeFolderDisclosure,
  ProjectTreeTopicHoverCard,
  ProjectTreeTopicOpenRequest,
} from "./ReasonixProjectTree";

type ProjectTreeProps = ComponentProps<typeof ReasonixProjectTree>;

// Northwing adds a compact Chat/Work control surface above the complete
// Reasonix project tree. Loading the product rail separately keeps the mature
// Reasonix navigation path in the initial bundle while CoWork capabilities load
// on demand without changing execution or project-tree ownership.
export function ProjectTree(props: ProjectTreeProps) {
  return (
    <>
      <Suspense fallback={null}>
        <NorthwingCoworkRail
          activeWorkspaceRoot={props.activeWorkspaceRoot}
          refreshSignal={props.refreshSignal}
          onAddProject={props.onAddProject}
        />
      </Suspense>
      <ReasonixProjectTree {...props} />
    </>
  );
}
