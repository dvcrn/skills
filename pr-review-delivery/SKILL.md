---
name: pr-review-delivery
description: "Deliver a list of PR review findings as one GitHub COMMENT review: levels, anchoring, summary and verdict, re-reviews."
---

# PR Review Delivery

Findings come from the caller (for example `/code-review`, `/simplify`, or subagents). This skill filters, labels and delivers them; it does not review code itself.


**PR target:** Require a PR number, `owner/repo#number`, or URL supplied by the user, including an unambiguous prior mention. Do not infer it from the current branch or choose an open PR. If no target was provided, ask.

**Output rule:** When the user explicitly invokes this skill's GitHub posting workflow, that request authorizes one `COMMENT` review. Do not ask again. Post it, then report the review URL and a one-paragraph summary. Automatic skill selection or a general request to inspect a PR does not authorize posting; honor explicit local-only or read-only requests. Pass the established delivery choice to any delegate.

## Target and authority

Resolve owner, repository, PR number, and head SHA from the user's input, established conversation context, or an explicit PR named earlier in the conversation. Ask only if the target remains unclear.

Use the delivery choice established by the output rule above. Do not modify implementation code during a review.

## Findings

Label each finding with one of these levels:

| Level | Meaning |
| --- | --- |
| High | Merging as-is breaks something: CI red, prod failure, data loss, security hole |
| Medium | Wrong behavior or a regression that doesn't block merge |
| Low | Applyable cleanup only: a GitHub suggestion block replacing lines inside the diff, plus one sentence. No prose-only Low findings. At most three per review. |

Every new inline review comment starts with the badge for its level on its own line, then a blank line, then the finding. Thread replies take no badge. No text prefix follows the badge.

| Level | First line |
| --- | --- |
| High | `![High](https://img.shields.io/badge/High-red?style=flat)` |
| Medium | `![Medium](https://img.shields.io/badge/Medium-orange?style=flat)` |
| Low | `![Low](https://img.shields.io/badge/Low-yellow?style=flat)` |

Callers may hand findings over with `High:`, `Medium:` or `Low:` text prefixes; replace the prefix with the badge at delivery. General findings in the summary keep the `High:` or `Medium:` text prefix and take only those two levels, since a Low finding must anchor to lines in the diff.

When running `github-comment-quality` or `humanizer` over comment text, pass only the body below the badge. Never edit, reword or remove the badge line.

Only flag what the diff as written gets wrong. A wrong outcome is High or Medium, never Low. Drop design alternatives, scope expansions, changes to files outside the diff, and anything that was equally true before the PR.

Every High or Medium finding needs concrete evidence, a useful file/line reference, and an explanation of impact. Omit praise, restated code, and speculative issues. State a clean result concisely when no findings remain.

Each High or Medium inline finding: the defect and its consequence in at most three sentences, then one fix. No history of how the code got there, no alternative fixes unless the main one is risky. Breakage the diff causes in code it doesn't touch goes under General findings.

## Delivery

For authorized posting, use [github-delivery.md](references/github-delivery.md). Submit one review with event `COMMENT`; never `APPROVE` or `REQUEST_CHANGES`. Inline comments must anchor to the reviewed diff; other findings belong in the summary. Preserve user/repository attribution policy.

Completion means the caller's findings were filtered, labeled and delivered on the authorized surface, with verification limits stated in the summary's one Unverified line. For GitHub delivery, verify the submitted review and report its URL. After new commits, use [re-review.md](references/re-review.md) to deliver the delta without duplicating prior findings.
