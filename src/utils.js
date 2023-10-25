export const normalizePath = (pathName) => {
  return pathName.replace(/ /g, '-').trim().toLowerCase();
}