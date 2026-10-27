---
name: proofread-japanese
description: Proofread any outgoing Japanese (emails, letters, forum posts, messages) with Gemini before it is sent.
---

# Proofread Japanese

Every outgoing Japanese text gets reviewed by Gemini before it's final. Load the `ask-gemini-mcp` skill first for the call itself, or `ask-gemini` with the same models when the MCP tool is unavailable.

## Models

Use `gemini-3.8-flash-medium`. Fall back to `gemini-3.8-flash-low`, then `gemini-3.5-flash-lite`. If all fail, show the draft marked as unreviewed.

## Steps

1. Write the draft.
2. Send Gemini the draft with the channel, recipient, formality, goal, any message being replied to, and facts that must not change.
3. Use Gemini's version as is. Only restore dates, amounts, names or IDs if they drifted.
4. Show the final text, a short English gloss, and Gemini's change notes. Re-review after any edit.

## Example

User: "Email my ISP and ask to move my install from Nov 9 to early December."

Prompt to Gemini:

```
Proofread this Japanese so it reads like a competent native speaker wrote it.

Channel: email to ISP customer support (support@example-isp.jp)
Formality: polite business, first contact about this request
Goal: move the install date from Nov 9 to early December, ask if there's a fee
Keep exactly: 2026年11月9日, customer name ＹＡＭＡＤＡ ＴＡＲＯ

Draft:
件名：工事日変更のお願い
サンプル光カスタマーセンター 御中
いつもお世話になっております。ＹＡＭＡＤＡ ＴＡＲＯです。
2026年11月9日の工事日を、12月上旬に変更したいです。変更に費用はかかりますか。
よろしくお願いします。

Return the corrected full text, then a short English list of changes and why.
Don't change facts or add information.
```
