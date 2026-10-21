#!/usr/bin/env node
// Renders the npm wrapper templates in assets/npm into a project's npm/ directory.
//
// Usage:
//   node render.mjs --binary <name> --owner <github-owner> --repo <github-repo> \
//     --description "<text>" [--package <npm-name>] [--env-prefix <PREFIX_>] [--out npm] [--force]
//
// --package defaults to --binary. --env-prefix defaults to the binary name upper-cased with
// dashes turned into underscores; a trailing underscore is always added, e.g. MCP_SERVER_FOO_.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    binary: { type: "string" },
    package: { type: "string" },
    owner: { type: "string" },
    repo: { type: "string" },
    description: { type: "string" },
    "env-prefix": { type: "string" },
    out: { type: "string", default: "npm" },
    force: { type: "boolean", default: false },
  },
});

for (const required of ["binary", "owner", "repo", "description"]) {
  if (!values[required]) {
    console.error(`missing --${required}`);
    process.exit(2);
  }
}

const envPrefix = (values["env-prefix"] ?? values.binary.toUpperCase().replace(/[^A-Z0-9]+/g, "_")).replace(/_*$/, "_");

const tokens = {
  __BINARY__: values.binary,
  __PACKAGE__: values.package ?? values.binary,
  __OWNER__: values.owner,
  __REPO__: values.repo,
  __DESCRIPTION__: values.description,
  __ENV_PREFIX__: envPrefix,
};

const assets = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "npm");
mkdirSync(values.out, { recursive: true });

for (const name of readdirSync(assets)) {
  const target = join(values.out, name);
  if (existsSync(target) && !values.force) {
    console.error(`${target} exists; pass --force to overwrite`);
    process.exit(1);
  }

  let text = readFileSync(join(assets, name), "utf8");
  for (const [token, value] of Object.entries(tokens)) {
    text = text.replaceAll(token, value);
  }

  const leftover = text.match(/__[A-Z_]+__/);
  if (leftover) {
    console.error(`${name}: unreplaced token ${leftover[0]}`);
    process.exit(1);
  }

  writeFileSync(target, text);
  console.log(`wrote ${target}`);
}
