// esbuild.mjs
import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import tailwindPostcss from "@tailwindcss/postcss";
import { glob } from "glob";   // ⬅ ADD THIS

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const nodeBuiltins = [
  "fs", "path", "child_process", "node:events",
  "node:path", "node:buffer", "node:fs", "os", "crypto",
];

// ------------------------------
// PATHS
// ------------------------------
const extEntry = path.resolve("src/core/extension.ts");
const extOut = path.resolve("out/extension.js");

const dashEntry = path.resolve("src/components/figma-ui/dashboard/FigmaDashboard.tsx");
const dashOutJS = path.resolve("out/components/figma-ui/dashboard/FigmaDashboard.js");

const rightDashboardEntry = path.resolve("src/components/figma-ui/dashboard/rightDashboard.entry.tsx");
const rightDashboardOutJS = path.resolve("out/components/figma-ui/dashboard/RightDashboard.js");

const editorOverlayEntry = path.resolve("src/components/figma-ui/dashboard/EditorOverlay.tsx");
const editorOverlayOutJS = path.resolve("out/components/figma-ui/dashboard/EditorOverlay.js");

const indexCssInput = path.resolve("src/components/figma-ui/index.css");
const globalsCssInput = path.resolve("src/components/figma-ui/styles/globals.css");

const outCssDir = path.resolve("out/components/figma-ui");
const globalsCssOutDir = path.join(outCssDir, "styles");

// ------------------------------
// CLEAN OLD CSS
// ------------------------------
function cleanOldCSS() {
  const oldCssFiles = [
    path.join(outCssDir, "FigmaDashboard.css"),
    path.join(outCssDir, "index.css"),
    path.join(globalsCssOutDir, "globals.css"),
  ];

  oldCssFiles.forEach((file) => {
    if (fs.existsSync(file)) {fs.unlinkSync(file);}
  });
}

// ------------------------------
// LOGGER PLUGIN
// ------------------------------
const logPlugin = {
  name: "logger",
  setup(build) {
    build.onStart(() => console.log(`[esbuild] Building ${build.initialOptions.outfile}...`));
    build.onEnd(() => console.log("[esbuild] Done."));
  },
};

// ------------------------------
// POSTCSS BUILD
// ------------------------------
async function buildCSS() {
  const files = [
    { input: indexCssInput, output: path.join(outCssDir, "index.css") },
    { input: globalsCssInput, output: path.join(globalsCssOutDir, "globals.css") },
  ];

  for (const f of files) {
    if (!fs.existsSync(f.input)) {continue;}

    const css = fs.readFileSync(f.input, "utf8");
    const result = await postcss([tailwindPostcss, autoprefixer]).process(css, {
      from: f.input,
      to: f.output,
      map: !production ? { inline: false } : false,
    });

    fs.mkdirSync(path.dirname(f.output), { recursive: true });
    fs.writeFileSync(f.output, result.css, "utf8");
    console.log(`[postcss] Built: ${f.output}`);
  }
}

// ------------------------------
// EXTENSION BUNDLE
// ------------------------------
async function buildExtension() {
  await esbuild.build({
    entryPoints: [extEntry],
    outfile: extOut,
    bundle: true,
    platform: "node",
    target: "node18",
    sourcemap: !production,
    minify: production,
    external: ["vscode", ...nodeBuiltins],
    format: "cjs",
    plugins: [logPlugin],
  });
}

// ------------------------------
// DASHBOARD BUNDLES
// ------------------------------
async function buildDashboard() {
  cleanOldCSS();
  
  // Delete any TypeScript-compiled dashboard files so esbuild can rebundle them
  const dashboardOutDir = path.resolve("out/components/figma-ui");
  if (fs.existsSync(dashboardOutDir)) {
    fs.rmSync(dashboardOutDir, { recursive: true });
  }
  
  await buildCSS();

  const bundles = [
    { entry: dashEntry, out: dashOutJS, name: "DevPilotApp" },
    { entry: rightDashboardEntry, out: rightDashboardOutJS, name: "DevPilotRightDashboard" },
    { entry: editorOverlayEntry, out: editorOverlayOutJS, name: "DevPilotEditorOverlay" },
  ];

  for (const b of bundles) {
    if (!fs.existsSync(b.entry)) {continue;}
    const outDir = path.dirname(b.out);
    const name = path.basename(b.out, ".js");
    fs.mkdirSync(outDir, { recursive: true });

    // Build dashboard as IIFE (no globalName to avoid double-wrapping)
    // We'll wrap it ourselves with require shim below
    const buildResult = await esbuild.build({
      entryPoints: [b.entry],
      outfile: b.out,
      bundle: true,
      platform: "browser",
      format: "iife",
      splitting: false,
      target: ["es2020"],
      jsx: "automatic",
      jsxImportSource: "react",
      metafile: true,
      sourcemap: !production,
      minify: production,
      loader: {
        ".ts": "ts",
        ".tsx": "tsx",
        ".js": "js",
        ".jsx": "jsx",
        ".css": "text",
      },
      // Keep node builtins external
      external: [...nodeBuiltins],
      plugins: [logPlugin],
    });

    console.log(`[build] Built ${b.name} ->`, path.join(outDir, `${name}.js`));

    // Inject synthetic require shim WRAPPED around the bundle
    let bundleContent = fs.readFileSync(b.out, "utf8");
    
    // Find where actual code ends and license comments begin
    // esbuild format is: (() => { code })() then /*! License comments
    let actualCode = bundleContent;
    let licenseBlock = "";
    
    // Try to find the license marker
    const licenseIndex = bundleContent.indexOf("/*! Bundled license");
    if (licenseIndex > 0) {
      // Include the })(); that comes before the license
      actualCode = bundleContent.substring(0, licenseIndex).trimEnd();
      licenseBlock = bundleContent.substring(licenseIndex);
    }
    
    // Remove trailing })(); from actual code since we'll add our own
    actualCode = actualCode.replace(/\}\)\(\);\s*$/, "").trimEnd();
    
    // Make sure we have valid code before wrapping
    if (!actualCode.includes("(() =>") && !actualCode.includes("(function")) {
      console.error(`[ERROR] Bundle for ${b.out} appears invalid - no IIFE found`);
      continue;
    }
    
    const wrappedContent = `(function() {
  const modules = {};
  const require = function(id) {
    if (modules[id]) return modules[id].exports;
    const module = { exports: {} };
    modules[id] = module;
    return module.exports;
  };
  const module = { exports: {} };
  const exports = module.exports;
  
  // esbuild IIFE bundle wrapped for webview compatibility
  ${actualCode}
})(); // closing esbuild's inner IIFE
})(); // closing outer wrapper function

${licenseBlock}`;
    
    fs.writeFileSync(b.out, wrappedContent, "utf8");
    console.log(`[inject] Wrapped IIFE with require shim for ${b.out}`);

    // Write metafile summary to help debugging bundling and external dependencies
    if (!production && buildResult.metafile) {
      try {
        const mf = await esbuild.analyzeMetafile(buildResult.metafile, { verbose: true });
        console.log(`[esbuild] Metafile analysis for ${b.name}:\n`, mf);
      } catch (e) {}
    }
  }
  }
// ------------------------------
async function buildAll() {
  await buildExtension();
  await buildDashboard();
}

// ------------------------------
// FIXED WATCH MODE
// ------------------------------
if (watch) {
  console.log("[esbuild] Watch mode enabled.");
  buildAll().then(() => {
    esbuild.context({
      entryPoints: [],
    });
  });

  // Minimal watcher: rerun full build on every change
  fs.watch("src", { recursive: true }, (event, file) => {
    console.log(`[esbuild] Change detected: ${file}`);
    buildAll().catch((e) => console.error(e));
  });

} else {
  buildAll().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
