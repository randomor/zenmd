import path from "path";
import fs from "fs/promises";

export const fileExists = async (path) => {
  try {
    await fs.access(path);
    return true;
  } catch (error) {
    return false;
  }
};

export const findLayout = async (inputFile, inputFolder, layoutName) => {
  if (layoutName === "matrix") {
    return path.join(process.cwd(), "src", "static", "matrix_layout.html");
  }

  let currentFolder = path.dirname(inputFile);
  while (currentFolder.startsWith(inputFolder)) {
    const layoutPath = path.join(currentFolder, "layout.html");
    if (await fileExists(layoutPath)) {
      return layoutPath;
    }
    if (currentFolder === inputFolder) {
      break;
    }
    currentFolder = path.dirname(currentFolder);
  }

  return path.join(process.cwd(), "src", "static", "default_layout.html");
};

export const normalizePath = (p) => {
  if (typeof p !== 'string') {
    console.warn('normalizePath received a non-string argument:', p);
    return p;
  }
  let normalized = p.trim(); // Trim whitespace
  normalized = normalized.replace(/%20/g, ' '); // Replace %20 with space
  normalized = normalized.replace(/\s+/g, '-'); // Replace spaces with hyphens
  normalized = normalized.toLowerCase(); // Convert to lowercase
  normalized = normalized.split('\\').join('/'); // Normalize slashes
  return normalized;
};
