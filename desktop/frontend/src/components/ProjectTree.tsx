import type { ComponentProps } from "react";
import { NorthwingCoworkRail } from "./NorthwingCoworkRail";
import { ProjectTree as ReasonixProjectTree } from "./ReasonixProjectTree";

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
// Reasonix project tree. Reasonix remains the only execution and navigation
// implementation underneath this product layer.
export function ProjectTree(props: ProjectTreeProps) {
  return (
    <>
      <NorthwingCoworkRail
        activeWorkspaceRoot={props.activeWorkspaceRoot}
        refreshSignal={props.refreshSignal}
        onAddProject={props.onAddProject}
      />
      <ReasonixProjectTree {...props} />
    </>
  );
}
