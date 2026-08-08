import App from "./App";

// SessionWorkspace adapts the existing Reasonix App controller so it can be
// mounted by the NorthwingShell when the user enters a Quick Chat or Work
// session. Over time, the true session workspace components will replace this
// adapter without changing the shell boundary.
export default function SessionWorkspace() {
  return <App />;
}
