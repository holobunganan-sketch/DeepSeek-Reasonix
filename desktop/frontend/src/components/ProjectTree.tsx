import { lazy, Suspense, type ComponentProps } from "react";
import { ProjectTree as ReasonixProjectTree } from "./ReasonixProjectTree";

const NorthwingProjectCenter = lazy(() => import("./NorthwingProjectCenter").then((module) => ({
  default: module.NorthwingProjectCenter,
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

// Work is a native project action that creates an ordinary Reasonix project tab
// with Goal and Delivery enabled. The complete Reasonix tree remains the sole
// owner of navigation, topics, sessions, and project lifecycle. The Work UI is
// loaded on demand so document previews do not expand the initial app chunk.
export function ProjectTree(props: ProjectTreeProps) {
  return (
    <>
      <Suspense fallback={null}>
        <NorthwingProjectCenter
          activeWorkspaceRoot={props.activeWorkspaceRoot}
          refreshSignal={props.refreshSignal}
          onAddProject={props.onAddProject}
        />
      </Suspense>
      <ReasonixProjectTree {...props} />
    </>
  );
}
