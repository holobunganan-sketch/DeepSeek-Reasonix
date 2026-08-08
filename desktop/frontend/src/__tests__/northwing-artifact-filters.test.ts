import { test } from "node:test";
import { deepStrictEqual } from "node:assert";
import { filterArtifacts, sortArtifactsByTime, type FilterableArtifact } from "../northwing/Artifacts/artifactFilters";

const fixtures: FilterableArtifact[] = [
  {
    id: "a1",
    path: "deliverables/w1/report.docx",
    kind: "docx",
    workId: "w1",
    version: 1,
    final: false,
    projectId: "p1",
    workspace: "/ws/p1",
    createdAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "a2",
    path: "deliverables/w1/slides.pptx",
    kind: "pptx",
    workId: "w1",
    version: 2,
    final: true,
    projectId: "p1",
    workspace: "/ws/p1",
    createdAt: "2026-08-02T12:00:00Z",
  },
  {
    id: "a3",
    path: "deliverables/w2/data.xlsx",
    kind: "xlsx",
    workId: "w2",
    version: 1,
    final: false,
    projectId: "p2",
    workspace: "/ws/p2",
    createdAt: "2026-08-03T08:00:00Z",
  },
];

test("filterArtifacts returns all when no criteria", () => {
  const result = filterArtifacts(fixtures, {});
  deepStrictEqual(result.length, 3);
});

test("filterArtifacts filters by projectId", () => {
  const result = filterArtifacts(fixtures, { projectId: "p1" });
  deepStrictEqual(result.length, 2);
  deepStrictEqual(result.every((a) => a.projectId === "p1"), true);
});

test("filterArtifacts filters by workId", () => {
  const result = filterArtifacts(fixtures, { workId: "w2" });
  deepStrictEqual(result.length, 1);
  deepStrictEqual(result[0].id, "a3");
});

test("filterArtifacts filters by kind", () => {
  const result = filterArtifacts(fixtures, { kind: "docx" });
  deepStrictEqual(result.length, 1);
  deepStrictEqual(result[0].path.endsWith(".docx"), true);
});

test("filterArtifacts filters finalOnly", () => {
  const result = filterArtifacts(fixtures, { finalOnly: true });
  deepStrictEqual(result.length, 1);
  deepStrictEqual(result[0].id, "a2");
});

test("filterArtifacts combines criteria", () => {
  const result = filterArtifacts(fixtures, { projectId: "p1", kind: "docx", workId: "w1" });
  deepStrictEqual(result.length, 1);
  deepStrictEqual(result[0].id, "a1");
});

test("filterArtifacts search matches path", () => {
  const result = filterArtifacts(fixtures, { search: "report" });
  deepStrictEqual(result.length, 1);
  deepStrictEqual(result[0].id, "a1");
});

test("sortArtifactsByTime sorts newest first", () => {
  const sorted = sortArtifactsByTime(fixtures, "newest");
  deepStrictEqual(sorted[0].id, "a3");
  deepStrictEqual(sorted[2].id, "a1");
});

test("sortArtifactsByTime sorts oldest first", () => {
  const sorted = sortArtifactsByTime(fixtures, "oldest");
  deepStrictEqual(sorted[0].id, "a1");
  deepStrictEqual(sorted[2].id, "a3");
});
