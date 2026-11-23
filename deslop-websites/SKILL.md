---
name: deslop-websites
description: Load when designing or making UI or UX changes to websites to avoid common AI tropes.
---

# Deslop Websites

Follow the project's existing design system first; when none exists, rely on restrained color, high-contrast typography, and real content instead of decorative effects.

Read [references/examples.md](references/examples.md) before designing a page or auditing existing UI: it shows bad, better, and not-a-finding cases for each rule.

## Rules

### R1. Shell, Palette, and Glows

- Do not default to `slate-950` (`#030712`) dark backgrounds layered with faint CSS grid or dot patterns and giant blurred radial-gradient orbs in purple, cyan, pink, or emerald.
- Do not use purple-to-cyan, magenta-to-indigo, or rainbow linear gradients (`bg-clip-text text-transparent`, gradient CTAs) as the default accent. Pick a palette suited to the domain with one clear accent color.
- Keep body copy high-contrast and readable. Do not pair bright headings with washed-out low-contrast gray body text (`text-slate-400` on dark surfaces).
- Do not add neon `box-shadow` glows (`shadow-purple-500/30`), cursor-following spotlights, sparkle trails, hover shimmer sweeps, or rotating `@property` conic-gradient border beams.

### R2. Typography and Inline Decoration

- Do not pair `Inter` with italic `Instrument Serif` unless the project already uses them.
- Never wrap a single arbitrary word inside a sans-serif headline in italic serif or a gradient span for manufactured emphasis (`Build the <em>future</em> of work`).
- Do not add handwritten SVG marker swoops, double-strokes, or squiggle underlines (`10x faster`).
- Strip decorative emojis (`✨`, `⚡`, `🚀`, `💜`, `🤖`) and trailing arrows from headings, nav brands, buttons, badges, and callout titles. Use purposeful icons only where they aid scanning or affordance.

### R3. Layout, Cards, and Borders

- Do not fracture a short explanation or feature list into an asymmetrical 12-column bento grid or a reflex 3-up feature card row when prose, a two-column split, a table, or a definition list reads clearer. Parallel pricing or plan comparison columns are fine when the tiers are real.
- Avoid card soup: frosted glass (`backdrop-blur`) on every block, cards nested inside cards, and 48x48 tinted glowing icon squircles atop every item.
- Do not put decorative colored, gradient, or glowing left accent stripes (`border-l-2`, `border-l-4`) on feature cards and callout boxes (`AI Insight:`, `Pro Tip:`). Reserve left rules for blockquotes, active nav state, or semantic warning and error banners.

### R4. Fake Telemetry and Badge Clutter

- Never render pulsing or pinging status dots (`animate-ping`, `All Systems Operational`, `AI Engine Active`, `Live`) that are not bound to a real health check or live connection state.
- Do not precede hero or section headings with shimmering eyebrow pills (`Introducing v2.0`) or scatter marketing micro-badges (`AI-POWERED`, `BETA`, `10X FASTER`, `VERIFIED`) across feature cards.

### R5. Stock SaaS Chrome

- Do not wrap a one-line CLI command in a fake macOS terminal frame with red, yellow, and green traffic-light dots. Use a plain `<pre><code>` block with a copy button.
- Do not scale up a middle pricing card with glowing borders and a floating `MOST POPULAR` pill unless product data explicitly designates a recommended plan; when it does, mark it with a plain text label and a quiet border contrast.
- Do not add non-functional `Ask AI anything...` prompt bars, dead newsletter inputs, or hardcoded progress bars (`width: 94%`) as decorative chrome.

### R6. Fabricated Social Proof, Metrics, and Filler Copy

- Never invent client logo marquees (scrolling rows of OpenAI, Anthropic, Stripe, Vercel, Linear, YC), fictional testimonials (`Dr. Sarah Chen, VP of Product at NexusAI`), star ratings, or unverified stat counters (`99.99% Uptime`, `+420% MoM`, scroll-triggered count-ups).
- When real logos, attributed quotes, or sourced metrics are not in the codebase or provided by the user, omit those sections entirely rather than rendering placeholders.
- Cut multi-paragraph SaaS filler prose inserted only to fill grid cells, along with `not X, it's Y` taglines and staccato slogan fragments (`No silos. No guesswork.`).

## Review Mode

When auditing UI without editing, report `path:line` Medium (fabricated R4 telemetry, any R6 fake proof/metrics, or page-wide R1/R3 slop shells) or Low (isolated R2 decoration, R4 eyebrow pills/badges, R5 chrome, or R6 filler taglines): state the trope in one sentence and name the concrete replacement or deletion.
