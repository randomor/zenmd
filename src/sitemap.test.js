import assert from "node:assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { describe, it } from "node:test";
import { buildSitemapTree, scanMarkdownMetadata } from "./sitemap.js";

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

describe("scanMarkdownMetadata", () => {
  it("prefers nav_title over title for sitemap entries", async () => {
    const inputFolder = await fs.mkdtemp(
      path.join(os.tmpdir(), "zenmd-sitemap-nav-")
    );
    const outputFolder = await fs.mkdtemp(
      path.join(os.tmpdir(), "zenmd-sitemap-out-")
    );

    try {
      const inputFile = path.join(inputFolder, "page.md");
      await fs.writeFile(
        inputFile,
        [
          "---",
          "title: Page Title",
          "nav_title: Nav Label",
          "---",
          "",
          "# Heading",
          "",
        ].join("\n")
      );

      const metadata = await scanMarkdownMetadata(
        inputFile,
        inputFolder,
        outputFolder
      );

      assert(metadata, "metadata should be returned");
      assert.strictEqual(metadata.title, "Nav Label");
    } finally {
      await fs.rm(inputFolder, { recursive: true, force: true });
      await fs.rm(outputFolder, { recursive: true, force: true });
    }
  });

  it("supports nav-title over title for sitemap entries", async () => {
    const inputFolder = await fs.mkdtemp(
      path.join(os.tmpdir(), "zenmd-sitemap-navdash-")
    );
    const outputFolder = await fs.mkdtemp(
      path.join(os.tmpdir(), "zenmd-sitemap-outdash-")
    );

    try {
      const inputFile = path.join(inputFolder, "page.md");
      await fs.writeFile(
        inputFile,
        [
          "---",
          "title: Page Title",
          "nav-title: Nav Dash",
          "---",
          "",
          "# Heading",
          "",
        ].join("\n")
      );

      const metadata = await scanMarkdownMetadata(
        inputFile,
        inputFolder,
        outputFolder
      );

      assert(metadata, "metadata should be returned");
      assert.strictEqual(metadata.title, "Nav Dash");
    } finally {
      await fs.rm(inputFolder, { recursive: true, force: true });
      await fs.rm(outputFolder, { recursive: true, force: true });
    }
  });
});
