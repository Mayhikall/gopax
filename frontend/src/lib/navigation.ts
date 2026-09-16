export const pathFor = (path: string, demo = false) =>
  demo ? `/preview?screen=${encodeURIComponent(path)}` : path;
