// Extracts the programs a skill's Markdown or shell files run, so sync can
// check them against the CLIs declared in skills.json `requires`.

const SHELL_FENCES = new Set(["", "bash", "sh", "shell", "zsh", "console"]);
const WRAPPERS = new Set(["sudo", "env", "exec", "npx", "xargs", "time", "nohup", "command"]);
const KEYWORDS = new Set(["if", "then", "else", "elif", "while", "until", "do", "!", "{"]);

/** Shell snippets in Markdown: fenced shell blocks and inline code spans. */
export function shellSnippets(markdown) {
  const snippets = [];
  const prose = markdown.replace(
    /^(\s*)(```+|~~~+)\s*([\w-]*)[^\n]*\n([\s\S]*?)^\1\2\s*$/gm,
    (_, _indent, _fence, lang, body) => {
      if (SHELL_FENCES.has(lang.toLowerCase())) snippets.push(body);
      return "";
    },
  );
  // A one-word span like `agy` names a tool in prose; only spans with arguments are commands.
  for (const m of prose.matchAll(/`([^`\n]+)`/g))
    if (/\S\s+\S/.test(m[1])) snippets.push(m[1].replace(/^!/, ""));
  return snippets;
}

/** First word of every simple command in a shell snippet, after assignments and wrappers. */
export function commandNames(snippet) {
  const names = [];
  const lines = snippet.replace(/\\\n/g, " ").split("\n");
  for (const line of lines) {
    for (const part of line.split(/&&|\|\||[;|()`]/)) {
      const words = part.trim().replace(/^\$\s+/, "").split(/\s+/).filter(Boolean);
      while (words.length > 0) {
        const w = words[0];
        if (/^\w+=/.test(w)) words.shift();
        else if (w === "timeout") words.splice(0, /^\d/.test(words[1] ?? "") ? 2 : 1);
        else if (WRAPPERS.has(w) || KEYWORDS.has(w)) words.shift();
        else break;
      }
      if (words[0] && /^[\w.+-]+$/.test(words[0])) names.push(words[0]);
    }
  }
  return names;
}

/** Programs run by a skill file's text; `.md` files are scanned for shell snippets only. */
export function programsIn(file, text) {
  const snippets = file.endsWith(".md") ? shellSnippets(text) : [text];
  return new Set(snippets.flatMap(commandNames));
}
