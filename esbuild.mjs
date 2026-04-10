import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const extensionConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  sourcemap: !production,
  minify: production,
  treeShaking: true,
};

/** @type {esbuild.BuildOptions} */
const webviewConfig = {
  entryPoints: ["src/webview/main.ts"],
  bundle: true,
  outfile: "dist/webview.js",
  format: "iife",
  platform: "browser",
  sourcemap: !production,
  minify: production,
  treeShaking: true,
  // KaTeX 需要的 CSS 作为文件复制
  loader: {
    ".woff2": "file",
    ".woff": "file",
    ".ttf": "file",
  },
};

async function main() {
  if (watch) {
    const extCtx = await esbuild.context(extensionConfig);
    const webCtx = await esbuild.context(webviewConfig);
    await Promise.all([extCtx.watch(), webCtx.watch()]);
    console.log("[watch] Build started...");
  } else {
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(webviewConfig),
    ]);
    console.log(production ? "[prod] Build complete." : "[dev] Build complete.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
