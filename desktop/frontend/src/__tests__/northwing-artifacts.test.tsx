import { test } from "node:test";
import { ok, deepStrictEqual } from "node:assert";
import { filterArtifacts, sortArtifactsByTime, type FilterableArtifact } from "../northwing/Artifacts/artifactFilters";

const fixtures: FilterableArtifact[] = [
  {
    id: "a1", path: "deliverables/w1/report.docx", kind: "docx", workId: "w1",
    version: 1, final: false, projectId: "p1", workspace: "/ws/p1", createdAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "a2", path: "deliverables/w1/slides.pptx", kind: "pptx", workId: "w1",
    version: 3, final: true, projectId: "p1", workspace: "/ws/p1", createdAt: "2026-08-05T14:00:00Z",
  },
  {
    id: "a3", path: "deliverables/w2/data.xlsx", kind: "xlsx", workId: "w2",
    version: 1, final: false, projectId: "p2", workspace: "/ws/p2", createdAt: "2026-08-03T08:00:00Z",
  },
];

test("artifact-filter: all passed on empty criteria", () => {
  deepStrictEqual(filterArtifacts(fixtures, {}).length, 3);
});

test("artifact-filter: projectId filter", () => {
  const r = filterArtifacts(fixtures, { projectId: "p1" });
  deepStrictEqual(r.length, 2);
  ok(r.every((a) => a.projectId === "p1"));
});

test("artifact-filter: workId filter", () => {
  deepStrictEqual(filterArtifacts(fixtures, { workId: "w2" }).length, 1);
});

test("artifact-filter: kind filter", () => {
  const r = filterArtifacts(fixtures, { kind: "docx" });
  deepStrictEqual(r.length, 1);
  ok(r[0].kind === "docx");
});

test("artifact-filter: finalOnly", () => {
  const r = filterArtifacts(fixtures, { finalOnly: true });
  deepStrictEqual(r.length, 1);
  deepStrictEqual(r[0].id, "a2");
});

test("artifact-filter: combined criteria", () => {
  const r = filterArtifacts(fixtures, { projectId: "p1", kind: "docx", workId: "w1" });
  deepStrictEqual(r.length, 1);
  deepStrictEqual(r[0].id, "a1");
});

test("artifact-filter: search in path", () => {
  deepStrictEqual(filterArtifacts(fixtures, { search: "report" }).length, 1);
});

test("artifact-sort: newest first", () => {
  const sorted = sortArtifactsByTime(fixtures, "newest");
  deepStrictEqual(sorted[0].id, "a2");
  deepStrictEqual(sorted[2].id, "a1");
});

test("artifact-sort: oldest first", () => {
  const sorted = sortArtifactsByTime(fixtures, "oldest");
  deepStrictEqual(sorted[0].id, "a1");
  deepStrictEqual(sorted[2].id, "a2");
});

test("artifact-catalog: artifact summary maps to filter criteria", () => {
  const fromCatalog = fixtures.map((a) => ({
    id: a.id, path: a.path, kind: a.kind, workId: a.workId,
    version: a.version, final: a.final, projectId: a.projectId,
    workspace: a.workspace, createdAt: a.createdAt,
  }));
  const docxOnly = filterArtifacts(fromCatalog, { kind: "docx" });
  deepStrictEqual(docxOnly.length, 1);
  deepStrictEqual(docxOnly[0].path.endsWith(".docx"), true);

  const finalArtifacts = filterArtifacts(fromCatalog, { finalOnly: true });
  deepStrictEqual(finalArtifacts.length, 1);
  deepStrictEqual(finalArtifacts[0].version, 3);
  deepStrictEqual(finalArtifacts[0].kind, "pptx");
});
