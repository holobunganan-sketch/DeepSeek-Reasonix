// Windows workspace paths are case-insensitive and may cross the Wails bridge
// with either slash style. Keep the original string for display and native
// calls, but use this key whenever product data is compared or deduplicated.
export function northwingWorkspaceIdentity(value: string): string {
  const trimmed = value.trim();
  const windowsPath = /^[a-z]:[\\/]/i.test(trimmed) || /^\\\\/.test(trimmed);
  if (!windowsPath) {
    return trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
  }
  return trimmed
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function sameNorthwingWorkspace(left: string, right: string): boolean {
  return northwingWorkspaceIdentity(left) === northwingWorkspaceIdentity(right);
}
