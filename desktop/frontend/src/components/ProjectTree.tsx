import type { ComponentProps } from "react";
import { NorthwingProjectCenter } from "./NorthwingProjectCenter";
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

// Northwing adds one compact CoWork projection above the existing Reasonix
// project tree. The original component remains intact in ReasonixProjectTree:
// all session navigation, topic actions, delivery worktrees, search, sorting,
// shortcuts, and runtime status behavior continue through the same props.
export function ProjectTree(props: ProjectTreeProps) {
  return (
    <>
      <NorthwingProjectCenter
        activeWorkspaceRoot={props.activeWorkspaceRoot}
        refreshSignal={props.refreshSignal}
        onAddProject={props.onAddProject}
      />
      <ReasonixProjectTree {...props} />
    </>
  );
}
