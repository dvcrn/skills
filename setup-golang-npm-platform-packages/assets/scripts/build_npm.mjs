// Builds one npm package per platform under dist/npm/ and pins them as
// optionalDependencies of npm/package.json at the wrapper's version.
import { execFileSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const PLATFORM_PREFIX = "__PLATFORM_PREFIX__";
const BIN = "__BINARY__";
const MAIN = "__MAIN__";
const OUT_DIR = "dist/npm";

// os/cpu use Node's process.platform/process.arch names so npm can filter them.
const TARGETS = [
  { os: "darwin", cpu: "arm64", goos: "darwin", goarch: "arm64" },
  { os: "darwin", cpu: "x64", goos: "darwin", goarch: "amd64" },
  { os: "linux", cpu: "arm64", goos: "linux", goarch: "arm64" },
  { os: "linux", cpu: "x64", goos: "linux", goarch: "amd64" },
  { os: "linux", cpu: "arm", goos: "linux", goarch: "arm", goarm: "7" },
  { os: "win32", cpu: "arm64", goos: "windows", goarch: "arm64" },
  { os: "win32", cpu: "x64", goos: "windows", goarch: "amd64" },
];

const mainPkgPath = "npm/package.json";
const mainPkg = JSON.parse(await readFile(mainPkgPath, "utf8"));
const { version, repository, license } = mainPkg;

await rm(OUT_DIR, { recursive: true, force: true });

const optionalDependencies = {};
for (const t of TARGETS) {
  const name = `${PLATFORM_PREFIX}-${t.os}-${t.cpu}`;
  const dir = path.join(OUT_DIR, `${BIN}-${t.os}-${t.cpu}`);
  const exe = t.os === "win32" ? `${BIN}.exe` : BIN;

  console.log(`building ${name}@${version}`);
  execFileSync(
    "go",
    [
      "build",
      "-trimpath",
      "-buildvcs=false",
      `-ldflags=-s -w -buildid= -X main.version=${version}`,
      "-o",
      path.join(dir, "bin", exe),
      MAIN,
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        CGO_ENABLED: "0",
        GOOS: t.goos,
        GOARCH: t.goarch,
        ...(t.goarm ? { GOARM: t.goarm } : {}),
      },
    },
  );

  const pkg = {
    name,
    version,
    description: `${t.os}-${t.cpu} binary for ${mainPkg.name}`,
    ...(repository ? { repository } : {}),
    ...(license ? { license } : {}),
    os: [t.os],
    cpu: [t.cpu],
    files: ["bin"],
    publishConfig: { access: "public" },
  };
  await writeFile(path.join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  optionalDependencies[name] = version;
}

mainPkg.optionalDependencies = optionalDependencies;
await writeFile(mainPkgPath, `${JSON.stringify(mainPkg, null, 2)}\n`);
console.log(`pinned ${TARGETS.length} platform packages at ${version}`);
