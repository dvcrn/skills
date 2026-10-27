import assert from "node:assert/strict";
import { test } from "node:test";
import { commandNames, programsIn } from "./commands.mjs";

test("finds commands behind separators, assignments and wrappers", () => {
  for (const snippet of [
    'agy "prompt"',
    "codex 'p'",
    "codex $ARGS",
    "cd repo && codex exec",
    "x; codex exec",
    "FOO=1 codex exec",
    "timeout 600 codex exec",
    "npx codex exec",
    "cat f | xargs codex exec",
    "exec codex exec",
    "codex\texec",
    "codex",
    "OUT=$(codex exec -o x)",
    "$ codex exec",
    "if codex exec \\",
    "while ! codex exec; do",
  ]) {
    assert.ok(commandNames(snippet).includes(snippet.includes("agy") ? "agy" : "codex"), snippet);
  }
});

test("joins backslash continuations", () => {
  assert.deepEqual(commandNames("agy --model x \\\n  -p hi"), ["agy"]);
});

test("ignores prose, tables and non-shell fences", () => {
  const md = [
    "codex is great at this",
    "| codex model | notes |",
    "(codex is the default)",
    "Use the `codex` CLI.",
    "```json",
    '{ "command": "codex" }',
    "```",
  ].join("\n");
  assert.equal(programsIn("SKILL.md", md).size, 0);
});

test("reads shell fences and inline code in Markdown", () => {
  const md = "Run `fnox -P cloud get X` or:\n\n```bash\nagy -p hi\n```\n\nAlso !`jules --help`.";
  assert.deepEqual([...programsIn("SKILL.md", md)].sort(), ["agy", "fnox", "jules"]);
});

test("reads non-Markdown files as shell", () => {
  assert.ok(programsIn("start.sh", "#!/bin/sh\nset -e\nlitestream restore db").has("litestream"));
});
