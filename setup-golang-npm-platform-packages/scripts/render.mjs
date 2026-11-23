#!/usr/bin/env node
// Renders the wrapper and build script templates into a project.
//
// Usage:
//   node render.mjs --binary <name> --scope <npm-scope> --owner <github-owner> --repo <github-repo> \
//     --description "<text>" [--package <npm-name>] [--main ./cmd/<binary>] [--env-prefix <PREFIX_>] \
//     [--from-release] [--force]
//
// Platform packages are named @<scope>/<package>-<os>-<cpu>. --package defaults to --binary,
// --main to ./cmd/<binary>. --env-prefix defaults to the binary name upper-cased with dashes
// turned into underscores; a trailing underscore is always added, e.g. MCP_SERVER_FOO_.
// --from-release writes a build_npm.mjs that repackages the GoReleaser archives of
// <owner>/<repo> instead of running go build.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    binary: { type: "string" },
    package: { type: "string" },
    scope: { type: "string" },
    owner: { type: "string" },
    repo: { type: "string" },
    description: { type: "string" },
    main: { type: "string" },
    "env-prefix": { type: "string" },
    "from-release": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});

for (const required of ["binary", "scope", "owner", "repo", "description"]) {
  if (!values[required]) {
    console.error(`missing --${required}`);
    process.exit(2);
  }
}

if (values["from-release"] && values.main) {
  console.error("--main cannot be used with --from-release");
  process.exit(2);
}

const pkgName = values.package ?? values.binary;
const scope = values.scope.replace(/^@/, "");
const envPrefix = (values["env-prefix"] ?? values.binary.toUpperCase().replace(/[^A-Z0-9]+/g, "_")).replace(/_*$/, "_");

const tokens = {
  __BINARY__: values.binary,
  __PACKAGE__: pkgName,
  __OWNER__: values.owner,
  __REPO__: values.repo,
  // Lands inside a JSON string in package.json.
  __DESCRIPTION__: JSON.stringify(values.description).slice(1, -1),
  __ENV_PREFIX__: envPrefix,
  __PLATFORM_PREFIX__: `@${scope}/${pkgName.replace(/^@[^/]+\//, "")}`,
  __MAIN__: values.main ?? `./cmd/${values.binary}`,
};

const assets = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const buildScript = values["from-release"] ? "build_npm_from_release.mjs" : "build_npm.mjs";
const files = [
  ...readdirSync(join(assets, "npm")).map((name) => [join(assets, "npm", name), join("npm", name)]),
  [join(assets, "scripts", buildScript), join("scripts", "build_npm.mjs")],
  [join(assets, "scripts", "publish_npm.sh"), join("scripts", "publish_npm.sh")],
];

const existing = files.map(([, target]) => target).filter((target) => existsSync(target));
if (existing.length && !values.force) {
  console.error(`${existing.join(", ")} exist; pass --force to overwrite`);
  process.exit(1);
}

const rendered = files.map(([source, target]) => {
  const text = readFileSync(source, "utf8").replace(/__[A-Z_]+__/g, (token) => {
    if (!(token in tokens)) {
      console.error(`${target}: unknown token ${token}`);
      process.exit(1);
    }
    return tokens[token];
  });
  return [target, text];
});

for (const [target, text] of rendered) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
  console.log(`wrote ${target}`);
}
