import { build } from "esbuild";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

await mkdir("dist/web/assets", { recursive: true });
await mkdir("dist/extension", { recursive: true });
const notices = [
  "VeilX is licensed under GPLv3; see the repository LICENSE.",
  ...(await Promise.all(
    [
      "compromise/LICENSE",
      "motion/LICENSE.md",
      "motion-dom/LICENSE.md",
      "motion-utils/LICENSE.md",
      "tailwindcss/LICENSE",
    ].map(
      async (path) =>
        `${path}\n${await readFile(`node_modules/${path}`, "utf8")}`,
    ),
  )),
].join("\n\n");
await writeFile("dist/extension/THIRD_PARTY_LICENSES.txt", notices);
await writeFile("dist/web/assets/THIRD_PARTY_LICENSES.txt", notices);
await cp("LICENSE", "dist/extension/LICENSE.txt");
const workspace = (await readFile("ui/workspace.html", "utf8")).replace(
  /<section\b/,
  "<section data-veilx-private",
);
for (const [source, destination] of [
  ["web/index.html", "dist/web/index.html"],
  ["extension/panel.html", "dist/extension/panel.html"],
]) {
  const template = await readFile(source, "utf8");
  if (!template.includes("<!-- WORKSPACE -->"))
    throw new Error(`Missing workspace slot: ${source}`);
  await writeFile(
    destination,
    template.replace("<!-- WORKSPACE -->", workspace),
  );
}
const common = {
  bundle: true,
  minify: true,
  target: "chrome135",
  legalComments: "eof",
  logLevel: "warning",
};
await build({
  ...common,
  entryPoints: ["web/app.mjs"],
  outfile: "dist/web/assets/app.js",
  format: "esm",
});
await build({
  ...common,
  entryPoints: ["web/fixture.mjs"],
  outfile: "dist/web/assets/fixture.js",
  format: "esm",
});
for (const name of ["background", "panel", "content"])
  await build({
    ...common,
    entryPoints: [`extension/${name}.mjs`],
    outfile: `dist/extension/${name}.js`,
    format: name === "content" ? "iife" : "esm",
  });
execFileSync(
  process.execPath,
  [
    "node_modules/@tailwindcss/cli/dist/index.mjs",
    "-i",
    "ui/styles.css",
    "-o",
    "dist/web/assets/styles.css",
    "--minify",
  ],
  { stdio: "inherit" },
);
await cp("dist/web/assets/styles.css", "dist/extension/styles.css");
await cp("web/fixture.html", "dist/web/assets/fixture.html");
await cp("ui/icon.svg", "dist/web/assets/icon.svg");
await cp("ui/icon.svg", "dist/extension/icon.svg");
await cp("extension/manifest.json", "dist/extension/manifest.json");
for (const size of [16, 32, 48, 128])
  await cp(`extension/icon${size}.png`, `dist/extension/icon${size}.png`);
execFileSync("python3", ["scripts/package-extension.py"], { stdio: "inherit" });
console.log("Built local website, MV3 extension, and dist/veilx-extension.zip");
