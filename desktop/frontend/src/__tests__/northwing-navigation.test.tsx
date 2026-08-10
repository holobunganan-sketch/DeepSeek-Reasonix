import { test } from "node:test";
import { ok, strictEqual } from "node:assert";
import {
  type NorthwingDestination,
  describeDestination,
  destinationPageName,
  isSessionDestination,
} from "../northwing/Navigation/routes";

test("navigation: home is the default destination kind", () => {
  const home: NorthwingDestination = { kind: "home" };
  strictEqual(home.kind, "home");
  ok(!isSessionDestination(home), "home is not a session destination");
});

test("navigation: all primary destinations describe correctly", () => {
  const destinations: NorthwingDestination[] = [
    { kind: "home" },
    { kind: "projects" },
    { kind: "work-list" },
    { kind: "artifacts" },
    { kind: "quick-chat" },
    { kind: "settings" },
  ];
  for (const dest of destinations) {
    ok(typeof describeDestination(dest) === "string", `${dest.kind} must describe`);
    ok(describeDestination(dest).length > 0, `${dest.kind} description must not be empty`);
  }
});

test("navigation: work is a session destination", () => {
  ok(isSessionDestination({ kind: "work", workspaceRoot: "/ws", workId: "w1" }), "work is session");
});

test("navigation: quick-chat is not a session destination", () => {
  ok(!isSessionDestination({ kind: "quick-chat" }), "chat is not a session destination");
});

test("navigation: artifacts route works", () => {
  strictEqual(describeDestination({ kind: "artifacts" }), "Artifacts");
});

test("navigation: new-work route works", () => {
  strictEqual(describeDestination({ kind: "new-work" }), "New Work");
  strictEqual(destinationPageName({ kind: "new-work" }), "New Work");
  strictEqual(destinationPageName({ kind: "work-list" }), "Work");
  strictEqual(destinationPageName({ kind: "quick-chat" }), "Quick Chat");
});
