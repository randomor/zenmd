import assert from "node:assert";
import { describe, it } from "node:test";
import { buildSitemapTree } from "./sitemap.js";

describe("buildSitemapTree", () => {
  it("merges index pages into their folder nodes", () => {
    const entries = [
      {
        title: "Home",
        relative_path: "/",
        relativeFilePath: "index.md",
        order: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        tags: [],
      },
      {
        title: "Projects",
        relative_path: "/projects/",
        relativeFilePath: "projects/index.md",
        order: 1,
        createdAt: "2024-01-03T00:00:00.000Z",
        updatedAt: "2024-01-04T00:00:00.000Z",
        tags: [],
      },
      {
        title: "Zenmd",
        relative_path: "/projects/zenmd",
        relativeFilePath: "projects/zenmd.md",
        order: 2,
        createdAt: "2024-01-05T00:00:00.000Z",
        updatedAt: "2024-01-06T00:00:00.000Z",
        tags: [],
      },
    ];

    const tree = buildSitemapTree(entries);
    const projectsNode = tree.children.find(
      (child) => child.relative_path === "/projects/"
    );

    assert(projectsNode, "projects node should exist");
    assert.strictEqual(projectsNode.title, "Projects");
    assert.strictEqual(projectsNode.createdAt, "2024-01-03T00:00:00.000Z");
    assert.strictEqual(projectsNode.order, 1);
    assert.strictEqual(projectsNode.children.length, 1);
    assert.strictEqual(projectsNode.children[0].relative_path, "/projects/zenmd");
  });
});
