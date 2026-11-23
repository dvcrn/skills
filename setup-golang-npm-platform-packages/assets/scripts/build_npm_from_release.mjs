// Repackages the GoReleaser archives of the GitHub release matching the
// wrapper version into one npm package per platform under dist/npm/, and pins
// them as optionalDependencies of npm/package.json.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const REPO = "__OWNER__/__REPO__";
const PLATFORM_PREFIX = "__PLATFORM_PREFIX__";
const BIN = "__BINARY__";
// GoReleaser project_name: archives are <ARCHIVE_PREFIX>_<version>_<arch>.<ext>.
const ARCHIVE_PREFIX = "__BINARY__";
const OUT_DIR = "dist/npm";

// os/cpu use Node's names so npm can filter them; arch and ext must match the
// GoReleaser archive names. Windows is zip only with a format_overrides entry.
const TARGETS = [
  { os: "darwin", cpu: "arm64", arch: "darwin_arm64", ext: "tar.gz" },
  { os: "darwin", cpu: "x64", arch: "darwin_amd64", ext: "tar.gz" },
  { os: "linux", cpu: "arm64", arch: "linux_arm64", ext: "tar.gz" },
  { os: "linux", cpu: "x64", arch: "linux_amd64", ext: "tar.gz" },
  { os: "linux", cpu: "arm", arch: "linux_armv7", ext: "tar.gz" },
  { os: "win32", cpu: "arm64", arch: "windows_arm64", ext: "tar.gz" },
  { os: "win32", cpu: "x64", arch: "windows_amd64", ext: "tar.gz" },
];

const mainPkgPath = "npm/package.json";
const mainPkg = JSON.parse(await readFile(mainPkgPath, "utf8"));
const { version, repository, license } = mainPkg;
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version) || version === "0.0.0") {
  throw new Error(`npm/package.json version "${version}" must be the tag of an existing ${REPO} release, e.g. 1.2.3`);
}

// Archives are kept across runs so a re-run only downloads what is missing;
// checksums.txt is always refreshed in case the release assets were replaced.
const download = path.join("dist/release", version);
const gh = (...args) =>
  execFileSync("gh", ["release", "download", version, "--repo", REPO, "--dir", download, ...args], { stdio: "inherit" });
gh("--clobber", "--pattern", "checksums.txt");
gh("--skip-existing", "--pattern", `${ARCHIVE_PREFIX}_${version}_*`);

const checksums = new Map(
  (await readFile(path.join(download, "checksums.txt"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => line.split(/\s+/).reverse()),
);

await rm(OUT_DIR, { recursive: true, force: true });

const optionalDependencies = {};
for (const t of TARGETS) {
  const name = `${PLATFORM_PREFIX}-${t.os}-${t.cpu}`;
  const dir = path.join(OUT_DIR, `${BIN}-${t.os}-${t.cpu}`);
  const exe = t.os === "win32" ? `${BIN}.exe` : BIN;
  const archive = `${ARCHIVE_PREFIX}_${version}_${t.arch}.${t.ext}`;
  const archivePath = path.join(download, archive);

  const sum = createHash("sha256").update(await readFile(archivePath)).digest("hex");
  if (checksums.get(archive) !== sum) {
    throw new Error(`checksum mismatch for ${archive}; delete ${download} and re-run`);
  }

  const binDir = path.join(dir, "bin");
  await mkdir(binDir, { recursive: true });
  if (t.ext === "zip") {
    execFileSync("unzip", ["-q", "-o", archivePath, exe, "-d", binDir]);
  } else {
    execFileSync("tar", ["-xzf", archivePath, "-C", binDir, exe]);
  }

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
  console.log(`packaged ${name}@${version} from ${archive}`);
}

mainPkg.optionalDependencies = optionalDependencies;
await writeFile(mainPkgPath, `${JSON.stringify(mainPkg, null, 2)}\n`);
console.log(`pinned ${TARGETS.length} platform packages at ${version}`);
