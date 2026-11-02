---
name: generate-stripe-api-keys
description: Create Stripe restricted API keys, including agent-tagged keys for the Stripe MCP server, by opening a prefilled Dashboard create URL. Use when asked to generate, create or rotate a Stripe secret or restricted key, or a key for Stripe MCP. Stripe has no public API or CLI command for creating these keys.
---

# Generate Stripe API keys

Stripe has no API or CLI command that creates secret or restricted keys. Build a prefilled Dashboard URL, open it, and have the user click Create.

## URL schema

```
https://dashboard.stripe.com/<acct_id>/apikeys/create?agent=true&name=<key-name>&permissions%5B0%5D=<rak_id>&permissions%5B1%5D=<rak_id>...
```

- `permissions[N]`: brackets URL-encoded (`%5B`, `%5D`), zero-indexed, one `rak_` id per entry.
- `name`: prefills the Key name field.
- `agent=true`: creates an agent-tagged restricted key ("Authorizing agent access to your account").
- Ids ending `_read` grant Read, `_write` grant Write (write implies read). Some resources only offer write.
- Group header rows map to `rak_bucket_<group>_read|write` (e.g. `rak_bucket_core_read`, `rak_bucket_checkout_write`) and set the whole group.
- Identity "All Detailed Verification Results" and "Recent Detailed Verification Results" cannot both be selected.

Full id mapping per group: [references/permissions.md](references/permissions.md).

## Stripe MCP

`https://mcp.stripe.com` with `Authorization: Bearer <key>` requires agent-tagged keys from December 2026. Full secret keys and untagged restricted keys get 401. Keys created with `agent=true` are accepted.

## Accounts

The account is the `acct_...` path segment. Swap it to target another account under the same login. List account ids with the Stripe MCP tool `list_available_accounts_or_orgs` or `stripe whoami`. Do not hardcode account ids.

The organization page `https://dashboard.stripe.com/org_<id>/org/api-keys/secret` offers no agent option, so org-level keys cannot be agent-tagged. For MCP, create one key per account.

## Build the URL

Put one id per line in `perms.txt`:

```sh
acct=acct_XXXX name=mcp-readonly
url="https://dashboard.stripe.com/$acct/apikeys/create?agent=true&name=$name$(awk '{printf "&permissions%%5B%d%%5D=%s", NR-1, $0}' perms.txt)"
open "$url"
```

Read-only MCP preset (31 ids):

```
rak_approvals_read rak_balance_read rak_balance_transaction_source_read rak_charge_read
rak_customer_read rak_event_read rak_dispute_read rak_payment_intent_read
rak_payment_method_read rak_payout_read rak_product_read rak_setup_intent_read
rak_billing_meter_read rak_coupon_read rak_credit_note_read rak_invoice_read
rak_plan_read rak_promotion_code_read rak_quote_read rak_subscription_read
rak_tax_id_read rak_tax_rate_read rak_checkout_session_read rak_payment_links_read
rak_connected_account_read rak_data_metrics_read rak_data_queries_read rak_data_reports_read
rak_financial_statement_read rak_sigma_api_read rak_webhook_read
```

`rak_plan_read` is Prices. `rak_connected_account_read` is Connect "Accounts". Convert with `tr -s ' ' '\n'` before feeding to `awk`.

## Store the secret without printing it

After Create, Stripe shows the "Your new API key" modal once. Clicking the key text copies it to the clipboard. Then:

```sh
pbpaste | jq -Rs '<item template>' | op item create --vault Dev -
printf '' | pbcopy
```

Follow the `op-convention` skill for item name, category, fields and tags.
