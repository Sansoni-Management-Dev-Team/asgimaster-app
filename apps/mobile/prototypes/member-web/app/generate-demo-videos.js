// Development-only original assets. Usage: node app/generate-demo-videos.js /path/to/ffmpeg
// No footage, logo, music or recordings from third parties are used.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lessons } from "./home-model.js";

const ffmpeg = process.argv[2];
if (!ffmpeg) throw new Error("Pass an ffmpeg executable path.");
const output = fileURLToPath(new URL("./assets/video/", import.meta.url));
mkdirSync(output, { recursive: true });
const tokens = readFileSync(new URL("../design-system/tokens.css", import.meta.url), "utf8");
const color = name => tokens.match(new RegExp(`--color-${name}: (#[0-9a-f]+);`, "i"))[1];
const dark = color("background-end"), light = color("background-start");

for (const lesson of lessons) {
  const duration = lesson.minutes * 60;
  // Static, text-free gradient. Keep full lesson durations so saved positions,
  // seeking and completion continue to exercise the real media element.
  const source = `gradients=s=640x360:r=2:c0=${light}:c1=${dark}:x0=0:y0=0:x1=640:y1=360:n=2:speed=0:d=${duration}`;
  const path = output + lesson.id + ".mp4";
  if (!existsSync(path) || process.argv.includes("--force")) {
    const result = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", source, "-an", "-c:v", "libx264", "-profile:v", "baseline", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-crf", "20", "-g", "20", "-movflags", "+faststart", path], { encoding: "utf8", windowsHide: true });
    if (result.status !== 0) throw new Error(result.stderr || result.error?.message);
  }
  writeFileSync(output + lesson.id + ".vtt", "WEBVTT\n\nNOTE\nSilent decorative gradient placeholder. No caption cues.\n");
  console.log(`${lesson.id}: ${duration}s`);
}
writeFileSync(output + "poster.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" preserveAspectRatio="none"><defs><linearGradient id="video-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="640" y2="360"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs><rect width="640" height="360" fill="url(#video-gradient)"/></svg>`);
