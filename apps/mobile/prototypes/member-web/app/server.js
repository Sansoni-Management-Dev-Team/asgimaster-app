// Local development server. Byte ranges are essential for mobile media seeking.
import http from "node:http";
import { createReadStream } from "node:fs";
import { stat, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm", ".vtt": "text/vtt; charset=utf-8" };

export function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || "");
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < size ? { start, end } : null;
}

export const server = http.createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405, { Allow: "GET, HEAD" }); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const route = pathname === "/" ? "/app/index.html" : pathname;
    const base = route.startsWith("/app/") ? path.join(root, "app") : route.startsWith("/design-system/") ? path.join(root, "design-system") : null;
    if (!base) { response.writeHead(404); response.end("Not found"); return; }
    let file = path.resolve(root, "." + route);
    const inside = value => value.startsWith(base + path.sep);
    if (file !== base && !inside(file)) { response.writeHead(403); response.end(); return; }
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    file = await realpath(file);
    if (!inside(file)) { response.writeHead(403); response.end(); return; }
    const info = await stat(file);
    const headers = { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" };
    let start = 0, end = info.size - 1, code = 200;
    if (request.headers.range) {
      const range = parseRange(request.headers.range, info.size);
      if (!range) { response.writeHead(416, { ...headers, "Content-Range": `bytes */${info.size}` }); response.end(); return; }
      ({ start, end } = range); code = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
    }
    headers["Content-Length"] = Math.max(0, end - start + 1);
    response.writeHead(code, headers);
    if (request.method === "HEAD" || info.size === 0) { response.end(); return; }
    const stream = createReadStream(file, { start, end });
    stream.on("error", () => response.destroy());
    response.on("close", () => stream.destroy());
    stream.pipe(response);
  } catch (error) {
    if (!response.headersSent) response.writeHead(error instanceof URIError ? 400 : 404);
    response.end("Not found");
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 4173);
  server.listen(port, "127.0.0.1", () => console.log(`Master App running at http://127.0.0.1:${port}/app/`));
}
