import esbuild from "esbuild";
import fs from "fs";

const testOut = "test-bundle.js";

await esbuild.build({
  entryPoints: ["src/components/figma-ui/dashboard/rightDashboard.entry.tsx"],
  outfile: testOut,
  bundle: true,
  platform: "browser",
  format: "iife",
  splitting: false,
  target: ["es2020"],
  jsx: "automatic",
  jsxImportSource: "react",
  minify: false,
  loader: {
    ".ts": "ts",
    ".tsx": "tsx",
    ".css": "text",
  },
  external: ["fs", "path", "child_process"],
});

const content = fs.readFileSync(testOut, "utf8");
const chars = 100;
console.log(`FIRST ${chars} CHARS:`, content.substring(0, chars));
console.log(`LAST ${chars} CHARS:`, content.substring(content.length - chars));

fs.unlinkSync(testOut);
