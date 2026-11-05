#!/usr/bin/env node
// Renders the wrapper and build script templates into a project.
//
// Usage:
//   node render.mjs --binary <name> --scope <npm-scope> --owner <github-owner> --repo <github-repo> \
//     --description "<text>" [--package <npm-name>] [--main ./cmd/<binary>] [--env-prefix <PREFIX_>] [--force]
//
// Platform packages are named @<scope>/<package>-<os>-<cpu>. --package defaults to --binary,
// --main to ./cmd/<binary>. --env-prefix defaults to the binary name upper-cased with dashes
// turned into underscores; a trailing underscore is always added, e.g. MCP_SERVER_FOO_.
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
    force: { type: "boolean", default: false },
  },
});

for (const required of ["binary", "scope", "owner", "repo", "description"]) {
  if (!values[required]) {
    console.error(`missing --${required}`);
    process.exit(2);
  }
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
const files = [
  ...readdirSync(join(assets, "npm")).map((name) => [join(assets, "npm", name), join("npm", name)]),
  ...["build_npm.mjs", "publish_npm.sh"].map((name) => [join(assets, "scripts", name), join("scripts", name)]),
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
