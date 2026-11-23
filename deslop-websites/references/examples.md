# Deslop Websites Examples

## R1. Shell, Palette, and Glows

Bad:

```html
<body class="bg-slate-950 text-slate-400 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]">
  <div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
    <div class="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-purple-600/30 blur-3xl"></div>
    <div class="absolute top-20 right-1/4 h-96 w-96 rounded-full bg-cyan-500/25 blur-3xl"></div>
  </div>
  <h1 class="bg-gradient-to-r from-white via-purple-400 to-cyan-400 bg-clip-text text-5xl font-extrabold text-transparent">
    Supercharge your workflow at scale
  </h1>
  <button class="relative overflow-hidden rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 px-6 py-3 text-white shadow-lg shadow-purple-500/30">
    Generate with AI
  </button>
</body>
```

Why: the dark grid, ambient neon orbs, clipped purple-to-cyan title gradient, glowing pill CTA, and low-contrast `slate-400` body copy reproduce the default LLM SaaS template regardless of what the product actually is.

Better:

```html
<body class="bg-stone-50 text-stone-900 antialiased">
  <main class="mx-auto max-w-3xl px-6 py-20">
    <h1 class="text-4xl font-semibold tracking-tight text-stone-950">
      Postgres backups to S3 in one binary
    </h1>
    <p class="mt-4 text-lg text-stone-700">
      Continuous WAL archiving and point-in-time recovery configured from a single TOML file.
    </p>
    <a href="/docs/install" class="mt-8 inline-block rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800">
      Read the install guide
    </a>
  </main>
</body>
```

Not a finding: a dark theme requested by the user, inherited from an existing brand system, or implemented via `prefers-color-scheme: dark` with solid neutral surfaces, readable contrast, and a single restrained accent color.

## R2. Typography and Inline Decoration

Bad:

```html
<h2 class="font-sans text-4xl font-bold tracking-tight text-white">
  Ship at <span class="font-serif italic bg-gradient-to-r from-pink-400 to-indigo-400 bg-clip-text text-transparent">unprecedented</span>
  velocity with <span class="underline decoration-wavy decoration-amber-400">10x faster</span> builds ✨
</h2>
```

Why: mixing one italic serif word, a hot text gradient, a wavy marker underline, and a trailing sparkle emoji inside one sans-serif heading manufactures emphasis where the words carry no specifics.

Better:

```html
<h2 class="text-3xl font-semibold tracking-tight text-neutral-900">
  Incremental builds finish in under two seconds
</h2>
```

Not a finding: a site set intentionally in a serif display face across all headings, or normal `<em>` emphasis in prose where stress changes how a sentence reads.

## R3. Layout, Cards, and Borders

Bad:

```html
<div class="grid grid-cols-12 gap-4">
  <div class="col-span-7 rounded-2xl border border-white/10 border-l-4 border-l-purple-500 bg-white/5 p-6 backdrop-blur-md">
    <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-2xl">⚡</div>
    <h3 class="text-lg font-semibold text-white">⚡ Instant Sync</h3>
    <div class="mt-4 rounded-xl border border-white/10 border-l-4 border-l-cyan-400 bg-white/5 p-4">
      📦 Zero-config local cache
    </div>
  </div>
  <div class="col-span-5 rounded-2xl border border-white/10 border-l-4 border-l-emerald-400 bg-white/5 p-6 backdrop-blur-md">
    <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-2xl">🚀</div>
    <h3 class="text-lg font-semibold text-white">🚀 Edge Ready</h3>
  </div>
</div>
```

Why: two short facts are padded into a 7/5 bento grid with frosted glass, emoji squircles, multicolored `border-l-4` stripes, and a card nested inside another card.

Better:

```html
<dl class="divide-y divide-neutral-200 border-y border-neutral-200">
  <div class="py-5 sm:grid sm:grid-cols-3 sm:gap-4">
    <dt class="font-medium text-neutral-900">Local SQLite replica</dt>
    <dd class="mt-1 text-neutral-700 sm:col-span-2 sm:mt-0">
      Reads hit the on-disk database directly; writes replicate over WebSockets when online.
    </dd>
  </div>
  <div class="py-5 sm:grid sm:grid-cols-3 sm:gap-4">
    <dt class="font-medium text-neutral-900">Single static binary</dt>
    <dd class="mt-1 text-neutral-700 sm:col-span-2 sm:mt-0">
      Runs on Linux and macOS without a separate daemon or runtime dependency.
    </dd>
  </div>
</dl>
```

Not a finding: a genuine multi-panel application dashboard where cells hold distinct widgets (a time-series chart, a log table, and a filter sidebar) whose shapes require different column spans; a multi-column pricing table comparing real plans; or a `border-l-2` rule on a `<blockquote>`, active sidebar link, or form validation error banner.

## R4. Fake Telemetry and Badge Clutter

Bad:

```html
<div class="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-200">
  <span class="relative flex h-2 w-2">
    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
    <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
  </span>
  ✨ v2.0 Now Live · All Systems Operational →
</div>
```

Why: hardcoded `animate-ping` status dots on static HTML lie about live telemetry, and stacking an eyebrow pill above every hero creates visual noise before the page says what it is.

Better:

```html
<p class="text-sm text-neutral-600">
  <a href="/changelog/2.0" class="underline underline-offset-4 hover:text-neutral-900">
    Release 2.0: streaming snapshots and S3 Express support
  </a>
</p>
```

Not a finding: a status indicator driven by a real `/healthz` poll, incident API, or live WebSocket connection state (`connected` / `reconnecting`), or a single version tag in documentation navigation.

## R5. Stock SaaS Chrome

Bad:

```html
<div class="rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
  <div class="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
    <div class="flex gap-1.5">
      <span class="h-3 w-3 rounded-full bg-red-500"></span>
      <span class="h-3 w-3 rounded-full bg-amber-400"></span>
      <span class="h-3 w-3 rounded-full bg-emerald-500"></span>
    </div>
    <span class="font-mono text-xs text-slate-400">install.sh</span>
  </div>
  <pre class="p-4 font-mono text-sm text-emerald-400">$ brew install walship</pre>
</div>
```

Why: faux macOS window controls add three decorative elements and a header bar around three words of shell text.

Better:

```html
<div class="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-100 px-3.5 py-2 font-mono text-sm text-neutral-900">
  <code>brew install walship</code>
  <button type="button" data-copy="brew install walship" class="text-xs font-sans text-neutral-600 hover:text-neutral-900">
    Copy
  </button>
</div>
```

Not a finding: an actual interactive terminal emulator (xterm.js), a multi-tab code example where the header switches languages (`curl` / `Go` / `Elixir`), or a desktop app screenshot that naturally includes OS window chrome.

## R6. Fabricated Social Proof, Metrics, and Filler Copy

Bad:

```html
<section aria-label="Trusted by">
  <p class="text-center text-xs uppercase tracking-widest text-slate-500">
    Trusted by innovative teams at the world's leading companies
  </p>
  <div class="marquee">OpenAI · Anthropic · Stripe · Vercel · Linear · Figma</div>
</section>

<div class="grid grid-cols-3 gap-6">
  <div>
    <div class="text-4xl font-bold" data-count="99.99%">99.99%</div>
    <div class="text-sm text-slate-400">Uptime SLA</div>
  </div>
  <blockquote>
    "Radically accelerated our velocity across key stakeholders."
    <footer>Dr. Sarah Chen, VP of Product at NexusAI</footer>
  </blockquote>
</div>
```

Why: unverified logos, invented people (`Dr. Sarah Chen at NexusAI`), and made-up uptime numbers destroy credibility and create legal and reputational risk if shipped.

Better:

```html
<!-- No customer logos, quotes, or production metrics exist in the repo yet: omit the social-proof and stat-counter sections completely and move straight from the product overview into the concrete feature breakdown or quickstart. -->
```

Not a finding: real customer quotes with verifiable names and companies supplied by the user, real benchmark numbers linked to a reproducible benchmark script or methodology page, or open-source repository stats fetched from an actual package/repo source when requested.
