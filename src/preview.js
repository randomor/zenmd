import http from "http";
import path from "path";
import fs from "fs/promises";
import { watch } from "fs";
import chalk from "chalk";
import { processFolder } from "./main.js";
import { fileExists } from "./utils.js";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const getMimeType = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_TYPES[extension] || "application/octet-stream";
};

const normalizeHtmlPath = (pathname) => {
  if (!pathname.endsWith(".html")) {
    return pathname;
  }

  let withoutExtension = pathname.slice(0, -5);

  if (withoutExtension.endsWith("/index")) {
    withoutExtension = withoutExtension.slice(0, -6);
    if (withoutExtension === "") {
      return "/";
    }
    return withoutExtension.endsWith("/")
      ? withoutExtension
      : `${withoutExtension}/`;
  }

  return withoutExtension === "" ? "/" : withoutExtension;
};

const resolveOutputFile = async (outputFolder, pathname) => {
  const normalizedPath = path.posix.normalize(pathname);

  if (!normalizedPath.startsWith("/")) {
    return { status: 400 };
  }

  if (normalizedPath.includes("..")) {
    return { status: 403 };
  }

  if (normalizedPath.endsWith(".html")) {
    return { redirect: normalizeHtmlPath(normalizedPath) };
  }

  const hasExtension = path.posix.extname(normalizedPath) !== "";
  const candidates = [];
  const wantsTrailingSlash = !hasExtension && !normalizedPath.endsWith("/");

  if (hasExtension) {
    candidates.push(normalizedPath);
  } else if (normalizedPath.endsWith("/")) {
    candidates.push(path.posix.join(normalizedPath, "index.html"));
  } else {
    candidates.push(`${normalizedPath}.html`);
    candidates.push(path.posix.join(normalizedPath, "index.html"));
  }

  const outputRoot = path.resolve(outputFolder);

  for (const candidate of candidates) {
    const relativeCandidate = candidate.replace(/^\/+/, "");
    const candidatePath = path.resolve(outputRoot, relativeCandidate);

    if (
      candidatePath !== outputRoot &&
      !candidatePath.startsWith(`${outputRoot}${path.sep}`)
    ) {
      continue;
    }

    if (await fileExists(candidatePath)) {
      if (wantsTrailingSlash && candidate.endsWith("/index.html")) {
        return { redirect: `${normalizedPath}/` };
      }
      return { filePath: candidatePath };
    }
  }

  return { status: 404 };
};

const writeResponse = (res, status, message) => {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
};

const buildOnce = async (input, outputFolder, options) => {
  if (await fileExists(outputFolder)) {
    await fs.rm(outputFolder, { recursive: true, force: true });
  }
  await fs.mkdir(outputFolder, { recursive: true });
  await processFolder(input, outputFolder, options);
};

export const startPreviewServer = async ({
  input,
  outputFolder,
  options,
  port = 4173,
}) => {
  const resolvedInput = path.resolve(input);
  const resolvedOutput = path.resolve(outputFolder);
  const isFileInput = resolvedInput.endsWith(".md");
  const watchRoot = isFileInput ? path.dirname(resolvedInput) : resolvedInput;

  const rebuild = async () => {
    console.log(chalk.blue("Rebuilding..."));
    const start = Date.now();
    await buildOnce(resolvedInput, resolvedOutput, options);
    const duration = Date.now() - start;
    console.log(chalk.green(`Rebuild complete in ${duration}ms`));
  };

  await rebuild();

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      writeResponse(res, 400, "Bad request");
      return;
    }

    const url = new URL(req.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname || "/");
    const search = url.search || "";

    const result = await resolveOutputFile(resolvedOutput, pathname);

    if (result.redirect) {
      res.writeHead(302, { Location: `${result.redirect}${search}` });
      res.end();
      return;
    }

    if (!result.filePath) {
      writeResponse(res, result.status || 404, "Not found");
      return;
    }

    try {
      const data = await fs.readFile(result.filePath);
      res.writeHead(200, { "Content-Type": getMimeType(result.filePath) });
      res.end(data);
    } catch (error) {
      writeResponse(res, 500, "Failed to read file");
    }
  });

  server.listen(port, () => {
    console.log(chalk.green(`Preview server running at http://localhost:${port}`));
  });

  let rebuildTimer;
  let isBuilding = false;
  let rebuildQueued = false;

  const scheduleRebuild = () => {
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
    }

    rebuildTimer = setTimeout(async () => {
      if (isBuilding) {
        rebuildQueued = true;
        return;
      }

      isBuilding = true;
      try {
        await rebuild();
      } catch (error) {
        console.error(chalk.red("Rebuild failed:"), error);
      } finally {
        isBuilding = false;
        if (rebuildQueued) {
          rebuildQueued = false;
          scheduleRebuild();
        }
      }
    }, 120);
  };

  try {
    const watcher = watch(watchRoot, { recursive: true }, (_event, file) => {
      if (!file) {
        scheduleRebuild();
        return;
      }

      const changedPath = path.resolve(watchRoot, file);
      if (
        changedPath === resolvedOutput ||
        changedPath.startsWith(`${resolvedOutput}${path.sep}`)
      ) {
        return;
      }

      if (
        changedPath.includes(`${path.sep}node_modules${path.sep}`) ||
        changedPath.includes(`${path.sep}.git${path.sep}`)
      ) {
        return;
      }

      scheduleRebuild();
    });

    process.on("SIGINT", () => {
      watcher.close();
      server.close();
      process.exit(0);
    });
  } catch (error) {
    console.error(chalk.red("Failed to start watcher:"), error);
  }
};
