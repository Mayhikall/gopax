#!/usr/bin/env node
/**
 * Privy v3.44+ bug: SignRequestScreen crashes when rendered before navigation
 * data is available (s.signMessage is undefined). This postinstall script
 * guards the destructuring so it falls back to an empty object.
 */
const fs = require("fs");
const path = require("path");

const base = path.join(
  __dirname,
  "..",
  "node_modules",
  "@privy-io",
  "react-auth",
  "dist",
);

const patches = [
  // ESM
  ...findFiles(path.join(base, "esm"), /SignRequestScreen.*\.mjs$/),
  // CJS
  ...findFiles(path.join(base, "cjs"), /SignRequestScreen.*\.js$/),
];

let patched = 0;
for (const file of patches) {
  let src = fs.readFileSync(file, "utf8");
  // Match both minified variable names (s.signMessage or a.signMessage)
  const re = /\}=([a-z])\.signMessage,/g;
  if (re.test(src)) {
    src = src.replace(re, "}=($1?.signMessage||{}),");
    fs.writeFileSync(file, src);
    patched++;
    console.log("Patched:", path.relative(process.cwd(), file));
  }
}

if (patched === 0) console.log("No Privy SignRequestScreen files needed patching.");
else console.log(`Patched ${patched} file(s).`);

function findFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => pattern.test(f)).map((f) => path.join(dir, f));
}
