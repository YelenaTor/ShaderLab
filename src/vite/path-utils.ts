/** Pure path helpers so the Vite plugin avoids `node:path` (browser dep-optimizer stubs break named exports). */

export function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

export function fileBasename(p: string): string {
  const s = toPosix(p);
  const i = s.lastIndexOf("/");
  return i === -1 ? s : s.slice(i + 1);
}

export function dirnameOf(p: string): string {
  const s = toPosix(p);
  const i = s.lastIndexOf("/");
  if (i < 0) return ".";
  if (i === 0) return "/";
  return s.slice(0, i);
}

export function joinPath(base: string, ...segments: string[]): string {
  let out = toPosix(base).replace(/\/+$/, "");
  for (const seg of segments) {
    const s = toPosix(seg).replace(/^\/+/, "");
    if (!s) continue;
    out += "/" + s;
  }
  return out;
}

/** `path.relative` for paths under the same drive / POSIX tree (Vite `root` + absolute slab id). */
export function relativeFromRoot(root: string, fullPath: string): string {
  const r = toPosix(root).replace(/\/+$/, "");
  const f = toPosix(fullPath);
  if (f === r) return ".";
  const prefix = r + "/";
  if (f.startsWith(prefix)) return f.slice(prefix.length);
  const ra = r.split("/").filter(Boolean);
  const fa = f.split("/").filter(Boolean);
  let k = 0;
  while (k < ra.length && k < fa.length && ra[k] === fa[k]) k++;
  const up = ra.length - k;
  const down = fa.slice(k).join("/");
  const upSeg = up > 0 ? "../".repeat(up) : "";
  return (upSeg + down) || ".";
}
