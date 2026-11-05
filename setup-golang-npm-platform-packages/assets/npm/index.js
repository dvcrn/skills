#!/usr/bin/env node
const fs = require("fs");
const { spawn } = require("child_process");

const { startUpdateCheck } = require("./update_check");

const exe = process.platform === "win32" ? "__BINARY__.exe" : "__BINARY__";
const platformPackage = `__PLATFORM_PREFIX__-${process.platform}-${process.arch}`;

const PKG = (() => {
  try {
    return require("./package.json");
  } catch {
    return null;
  }
})();

function main() {
  let binPath;
  try {
    binPath = require.resolve(`${platformPackage}/bin/${exe}`);
  } catch {
    console.error(
      `__BINARY__: ${platformPackage} is not installed. ` +
        "Either this platform is unsupported or optional dependencies were " +
        "omitted (--omit=optional / --no-optional).",
    );
    process.exit(1);
  }

  if (process.platform !== "win32") {
    try {
      fs.chmodSync(binPath, 0o755);
    } catch {}
  }

  const child = spawn(binPath, process.argv.slice(2), {
    stdio: "inherit",
    windowsHide: true,
  });

  // An MCP client or `docker stop` signals only the wrapper; pass it on so the
  // binary is not orphaned.
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => child.kill(sig));
  }

  // Best-effort update notice (cached + short timeout).
  // Aborts on command exit so it never delays shutdown.
  const updateAbort = new AbortController();
  startUpdateCheck({
    installedVersion: PKG && PKG.version,
    signal: updateAbort.signal,
  });

  child.on("exit", (code) => {
    try {
      updateAbort.abort();
    } catch {}
    process.exitCode = code == null ? 1 : code;
  });
  child.on("error", (err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

main();
