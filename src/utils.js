import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

export const normalizePath = (pathName) => {
  return pathName
    .trim()
    .replace(/(\s|%20)/g, "-")
    .toLowerCase();
};

export const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

export const folderEmpty = async (folderPath) => {
  try {
    const outputFiles = await fs.readdir(folderPath);
    return outputFiles.length === 0;
  } catch {
    return false;
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find a custom layout.html in the directory tree; if none found,
 * fall back to a built-in layout based on the requested option.
 * @param currentFile - the source markdown file path
 * @param inputFolder - the root input folder for custom layouts
 * @param layoutOption - 'default', 'matrix', or 'cyberpunk'
 */
export const findLayout = async (
  currentFile,
  inputFolder,
  layoutOption = "default"
) => {
  // Search for a custom layout.html in current or parent directories
  let currentDir = currentFile;
  const customName = "layout.html";
  do {
    currentDir = path.dirname(currentDir);
    const filePath = path.join(currentDir, customName);
    if (await fileExists(filePath)) {
      return filePath;
    }
  } while (path.resolve(currentDir) !== path.resolve(inputFolder));

  // No custom layout found: use a built-in layout.
  // Array of available alternative layouts (excluding 'default' as it's the fallback).
  const SUPPORTED_ALTERNATIVE_LAYOUTS = ["matrix", "cyberpunk"];
  let layoutFileName;

  if (SUPPORTED_ALTERNATIVE_LAYOUTS.includes(layoutOption)) {
    layoutFileName = `${layoutOption}_layout.html`;
  } else {
    // Fallback to 'default_layout.html' if layoutOption is 'default'
    // or not in the supported alternative layouts.
    layoutFileName = "default_layout.html";
  }

  return path.join(__dirname, "./static/", layoutFileName);
};

export const isUrl = (string) => {
  try {
    new URL(string);
  } catch (_) {
    return false;
  }
  return true;
};

async function findImageRecursive(
  imageName,
  currentSearchDir,
  initialDirParam = null,
  baseDirParam = null
) {
  const initialDir =
    initialDirParam === null ? currentSearchDir : initialDirParam;
  const baseDir = baseDirParam === null ? initialDir : baseDirParam;

  // Normalize slashes for path separator check and for returned paths
  const normalizedImageName = imageName.replace(/\\/g, "/");

  if (normalizedImageName.includes("/")) {
    // imageName is a path (e.g., "folder/image.png")
    const absoluteImagePath = path.resolve(baseDir, normalizedImageName);
    try {
      const stats = await fs.stat(absoluteImagePath);
      if (stats.isFile()) {
        return path.relative(initialDir, absoluteImagePath).replace(/\\/g, "/");
      } else {
        return null; // Exists but is not a file
      }
    } catch (error) {
      // Does not exist or other fs error
      return null;
    }
  } else {
    // imageName is a simple filename (e.g., "image.png")
    // 1. Check directly in currentSearchDir
    try {
      const directFilePath = path.join(currentSearchDir, normalizedImageName);
      const stats = await fs.stat(directFilePath);
      if (stats.isFile()) {
        return path.relative(initialDir, directFilePath).replace(/\\/g, "/");
      }
    } catch (e) {
      // Not found directly in currentSearchDir or error, proceed to scan subdirectories
    }

    // 2. Scan subdirectories
    try {
      const entries = await fs.readdir(currentSearchDir, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".git") {
            continue;
          }
          const subDirPath = path.join(currentSearchDir, entry.name);
          // Recursively call with the simple imageName, new subDirPath, but same initialDir and baseDir
          const result = await findImageRecursive(
            normalizedImageName,
            subDirPath,
            initialDir,
            baseDir
          );
          if (result) {
            return result.replace(/\\/g, "/"); // Ensure forward slashes
          }
        }
      }
    } catch (error) {
      // Ignore errors like EACCES (permission denied) or ENOENT (file not found for readdir itself)
      if (error.code !== "EACCES" && error.code !== "ENOENT") {
        console.error(`Error reading directory ${currentSearchDir}:`, error);
      }
    }
    return null; // Not found in this path
  }
}

export { findImageRecursive };

const isPlainObject = (value) => {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const deepMerge = (...objects) => {
  const result = {};

  for (const current of objects) {
    if (!isPlainObject(current)) {
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (isPlainObject(value)) {
        const existing = result[key];
        result[key] = isPlainObject(existing)
          ? deepMerge(existing, value)
          : deepMerge(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          isPlainObject(item) ? deepMerge(item) : item
        );
      } else {
        result[key] = value;
      }
    }
  }

  return result;
};
