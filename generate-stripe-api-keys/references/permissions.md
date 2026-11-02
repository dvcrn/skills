# Stripe restricted key permission IDs

Internal Dashboard identifiers for `permissions[N]`, scraped from the API key create form on 2026-11-02. They are undocumented and may change.

Write implies read. A blank Read cell means the resource only offers Write (or vice versa). The group bucket ids set every resource in the group. Non read/write ids (Stripe Apps roles) are listed under Write.

## Core

Group: `rak_bucket_core_read`, `rak_bucket_core_write`

| Resource | Read | Write |
|---|---|---|
| 3D Secure Authentications | `rak_three_d_secure_authentications_read` | `rak_three_d_secure_authentications_write` |
| Account Evaluations |  | `rak_account_evaluations_write` |
| Apple Pay Domains | `rak_apple_pay_domain_read` | `rak_apple_pay_domain_write` |
| Approval Requests | `rak_approvals_read` | `rak_approvals_write` |
| Balance | `rak_balance_read` |  |
| Balance Settings | `rak_balance_settings_read` | `rak_balance_settings_write` |
| Balance Transaction Sources | `rak_balance_transaction_source_read` |  |
| Charges and Refunds | `rak_charge_read` | `rak_charge_write` |
| Client Confirmation Tokens | `rak_confirmation_token_client_read` | `rak_confirmation_token_client_write` |
| Confirmation Tokens | `rak_confirmation_token_read` |  |
| Customer Sessions | `rak_customer_session_read` | `rak_customer_session_write` |
| Customers | `rak_customer_read` | `rak_customer_write` |
| Delegated Commerce Product Search | `rak_delegated_commerce_product_search_read` |  |
| Ephemeral Keys | `rak_ephemeral_key_read` | `rak_ephemeral_key_write` |
| Events | `rak_event_read` |  |
| Files | `rak_file_read` | `rak_file_write` |
| Funding Instructions | `rak_funding_instruction_read` | `rak_funding_instruction_write` |
| Health Alerts | `rak_health_alert_read` |  |
| Implementation Planner |  | `rak_implementation_planner_write` |
| Mandates | `rak_mandate_read` | `rak_mandate_write` |
| Payment Disputes | `rak_dispute_read` | `rak_dispute_write` |
| Payment Intents | `rak_payment_intent_read` | `rak_payment_intent_write` |
| Payment Method Configurations | `rak_payment_method_configurations_read` | `rak_payment_method_configurations_write` |
| Payment Method Domains | `rak_payment_method_domain_read` | `rak_payment_method_domain_write` |
| Payment Methods | `rak_payment_method_read` | `rak_payment_method_write` |
| Payout Settings | `rak_payout_settings_read` |  |
| Payouts | `rak_payout_read` | `rak_payout_write` |
| Products | `rak_product_read` | `rak_product_write` |
| Risk Forms | `rak_risk_inquiry_read` | `rak_risk_inquiry_write` |
| Setup Intents | `rak_setup_intent_read` | `rak_setup_intent_write` |
| Shared Payment Token Test Helpers |  | `rak_shared_payment_token_test_helper_write` |
| Shared Payment Tokens | `rak_shared_payment_token_read` | `rak_shared_payment_token_write` |
| Shipping Rates | `rak_shipping_rate_read` | `rak_shipping_rate_write` |
| Sources | `rak_source_read` | `rak_source_write` |
| Test Clocks | `rak_billing_clock_read` | `rak_billing_clock_write` |
| Tokens | `rak_token_read` | `rak_token_write` |
| Vault GB Bank Accounts | `rak_core_vault_gb_bank_account_read` | `rak_core_vault_gb_bank_account_write` |
| Vault US Bank Accounts | `rak_core_vault_us_bank_account_read` | `rak_core_vault_us_bank_account_write` |

Unlabeled ids in this group (present in the form, label not captured): `rak_balance_transfer_read`, `rak_balance_transfer_write`, `rak_dashboard_notification_read`, `rak_delegated_checkout_requested_session_read`, `rak_delegated_checkout_requested_session_write`, `rak_fee_domain_resources_read`, `rak_forwarding_request_read`, `rak_forwarding_request_write`, `rak_nz_bank_account_account_number_read`, `rak_object_definition_read`, `rak_order_event_write`, `rak_payment_method_raw_account_number_read`, `rak_received_checkout_session_read`, `rak_shared_payment_token_resolve_write`

## Access Management

Group: `rak_bucket_iam_read`, `rak_bucket_iam_write`

| Resource | Read | Write |
|---|---|---|
| Activity Logs | `rak_hzn_security_history_event_read` |  |

Unlabeled ids in this group (present in the form, label not captured): `rak_hzn_api_key_read`, `rak_hzn_api_key_write`

## Atlas Company Formation

Group: `rak_bucket_atlas_company_formation_read`, `rak_bucket_atlas_company_formation_write`

| Resource | Read | Write |
|---|---|---|
| Atlas Company Formation | `rak_atlas_company_formation_read` | `rak_atlas_company_formation_write` |

## Batches

Group: `rak_bucket_batch_read`, `rak_bucket_batch_write`

| Resource | Read | Write |
|---|---|---|
| Batch Job Runs | `rak_batch_run_batch_read` | `rak_batch_run_batch_write` |
| Batch Jobs | `rak_batch_read` | `rak_batch_write` |

## Billing

Group: `rak_bucket_subscription_read`, `rak_bucket_subscription_write`

| Resource | Read | Write |
|---|---|---|
| Billing Alerts | `rak_billing_alert_read` | `rak_billing_alert_write` |
| Billing Meter Event Adjustments |  | `rak_billing_meter_event_adjustment_write` |
| Billing Meter Events | `rak_billing_meter_event_read` | `rak_billing_meter_event_write` |
| Billing Meters | `rak_billing_meter_read` | `rak_billing_meter_write` |
| Coupons | `rak_coupon_read` | `rak_coupon_write` |
| Credit Balances | `rak_billing_credit_balance_read` |  |
| Credit Grants | `rak_billing_credit_grant_read` | `rak_billing_credit_grant_write` |
| Credit Notes | `rak_credit_note_read` | `rak_credit_note_write` |
| Customer Portal | `rak_customer_portal_read` | `rak_customer_portal_write` |
| Entitlements | `rak_entitlement_read` |  |
| Features | `rak_feature_read` | `rak_feature_write` |
| Invoice Rendering Templates | `rak_invoice_rendering_template_read` | `rak_invoice_rendering_template_write` |
| Invoices | `rak_invoice_read` | `rak_invoice_write` |
| Prices | `rak_plan_read` | `rak_plan_write` |
| Promotion Codes | `rak_promotion_code_read` | `rak_promotion_code_write` |
| Quotes | `rak_quote_read` | `rak_quote_write` |
| Subscriptions | `rak_subscription_read` | `rak_subscription_write` |
| Tax IDs | `rak_tax_id_read` | `rak_tax_id_write` |
| Tax Rates | `rak_tax_rate_read` | `rak_tax_rate_write` |
| Usage Records | `rak_usage_record_read` | `rak_usage_record_write` |

Unlabeled ids in this group (present in the form, label not captured): `rak_billable_item_read`, `rak_billable_item_write`, `rak_billing_contract_read`, `rak_billing_contract_write`, `rak_billing_intent_read`, `rak_billing_intent_write`, `rak_margin_read`, `rak_margin_write`, `rak_billing_analytics_meter_usage_read`, `rak_billing_profile_read`, `rak_billing_profile_write`, `rak_billing_settings_read`, `rak_billing_settings_write`, `rak_license_fee_read`, `rak_license_fee_write`, `rak_pricing_plan_subscription_read`, `rak_pricing_plan_subscription_write`, `rak_pricing_plan_read`, `rak_pricing_plan_write`, `rak_rate_card_activation_read`, `rak_rate_card_activation_write`, `rak_rate_card_read`, `rak_rate_card_write`, `rak_us_paper_checks_read`, `rak_us_paper_checks_write`

## Branding Settings

| Resource | Read | Write |
|---|---|---|
| Branding Settings | `rak_branding_settings_read` | `rak_branding_settings_write` |

## Capability Definitions

Group: `rak_bucket_capability_definition_read`, `rak_bucket_capability_definition_write`

| Resource | Read | Write |
|---|---|---|
| Capability Definitions | `rak_capability_definition_read` | `rak_capability_definition_write` |

## Checkout Sessions

Group: `rak_bucket_checkout_read`, `rak_bucket_checkout_write`

| Resource | Read | Write |
|---|---|---|
| Checkout Sessions | `rak_checkout_session_read` | `rak_checkout_session_write` |

## Claimable Sandboxes

Group: `rak_bucket_claimable_sandboxes_read`, `rak_bucket_claimable_sandboxes_write`

| Resource | Read | Write |
|---|---|---|
| Claimable Sandboxes | `rak_claimable_sandbox_read` | `rak_claimable_sandbox_write` |

## Climate

Group: `rak_bucket_climate_read`, `rak_bucket_climate_write`

| Resource | Read | Write |
|---|---|---|
| Climate Orders | `rak_climate_order_read` | `rak_climate_order_write` |
| Climate Programs | `rak_climate_program_read` | `rak_climate_program_write` |

## Commerce

Group: `rak_bucket_commerce_read`, `rak_bucket_commerce_write`

| Resource | Read | Write |
|---|---|---|
| Product Catalog Exports | `rak_product_catalog_export_read` | `rak_product_catalog_export_write` |
| Product Catalog Imports | `rak_product_catalog_import_read` | `rak_product_catalog_import_write` |

## Connect

Group: `rak_bucket_connect_read`, `rak_bucket_connect_write`

| Resource | Read | Write |
|---|---|---|
| Account Links |  | `rak_account_link_write` |
| Account Sessions |  | `rak_account_session_write` |
| Account Signals | `rak_account_signals_read` | `rak_account_signals_write` |
| Accounts | `rak_connected_account_read` | `rak_connected_account_write` |
| Application Fees | `rak_application_fee_read` | `rak_application_fee_write` |
| Connect Authorizations |  | `rak_connect_authorize_write` |
| Enable Connect in Sandboxes |  | `rak_connect_enable_sandboxes_write` |
| Login Links |  | `rak_edit_link_write` |
| Top-Ups | `rak_topup_read` | `rak_topup_write` |
| Transfers | `rak_transfer_read` | `rak_transfer_write` |

## Connect Accounts

Group: `rak_bucket_connect_accounts_write`

| Resource | Read | Write |
|---|---|---|
| Account Credentials |  | `rak_account_credentials_write` |
| Account Extension Access Policy |  | `rak_account_extension_access_policy_write` |
| Account Groups |  | `rak_account_groups_write` |
| Account Payout Control Policy |  | `rak_account_payout_control_policy_write` |
| Subscription Settings |  | `rak_settings_subscription_write` |

## Crypto Payins

Group: `rak_bucket_crypto_payins_read`, `rak_bucket_crypto_payins_write`

| Resource | Read | Write |
|---|---|---|
| Crypto Deposit Addresses | `rak_crypto_deposit_address_read` | `rak_crypto_deposit_address_write` |

## Data

| Resource | Read | Write |
|---|---|---|
| Metrics | `rak_data_metrics_read` | `rak_data_metrics_write` |
| Queries | `rak_data_queries_read` | `rak_data_queries_write` |
| Reports | `rak_data_reports_read` | `rak_data_reports_write` |

Unlabeled ids in this group (present in the form, label not captured): `rak_data_read`, `rak_data_write`

## Financial Connections

Group: `rak_bucket_connections_read`, `rak_bucket_connections_write`

| Resource | Read | Write |
|---|---|---|
| Financial Connections Account Disconnections |  | `rak_connections_api_accounts_disconnection_write` |
| Financial Connections Account Ownership | `rak_connections_api_accounts_ownership_read` |  |
| Financial Connections Account Refreshes |  | `rak_connections_api_accounts_refresh_write` |
| Financial Connections Accounts (List) | `rak_connections_api_accounts_list_read` |  |
| Financial Connections Accounts (Retrieve) | `rak_connections_api_accounts_retrieve_read` |  |
| Financial Connections Authorizations | `rak_connections_api_authorizations_read` |  |
| Financial Connections Consents | `rak_connections_api_fc_consents_read` | `rak_connections_api_fc_consents_write` |
| Financial Connections Sessions | `rak_connections_api_link_account_sessions_read` | `rak_connections_api_link_account_sessions_write` |
| Financial Connections Subscriptions |  | `rak_connections_api_accounts_subscribe_write` |
| Financial Connections Transactions | `rak_connections_api_transactions_read` |  |

Unlabeled ids in this group (present in the form, label not captured): `rak_connections_api_inferred_balances_read`, `rak_connections_api_institutions_read`, `rak_connections_api_accounts_ownership_match_write`, `rak_connections_api_risk_intelligence_read`

## Identity

| Resource | Read | Write |
|---|---|---|
| All Detailed Verification Results | `rak_identity_product_sensitive_pii_permanent_read` |  |
| Identity Verification Results | `rak_identity_product_read` | `rak_identity_product_write` |
| Recent Detailed Verification Results | `rak_identity_product_sensitive_pii_temporary_read` |  |

## Issuing

Group: `rak_bucket_issuing_read`, `rak_bucket_issuing_write`

| Resource | Read | Write |
|---|---|---|
| Issuing Authorizations | `rak_issuing_authorization_read` | `rak_issuing_authorization_write` |
| Issuing Cardholders | `rak_issuing_cardholder_read` | `rak_issuing_cardholder_write` |
| Issuing Cards | `rak_issuing_card_read` | `rak_issuing_card_write` |
| Issuing Credit Ledger | `rak_issuing_credit_ledger_read` | `rak_issuing_credit_ledger_write` |
| Issuing Dashboard | `rak_issuing_read` | `rak_issuing_write` |
| Issuing Disputes | `rak_issuing_dispute_read` | `rak_issuing_dispute_write` |
| Issuing Settlements | `rak_issuing_settlement_read` | `rak_issuing_settlement_write` |
| Issuing Token Network Data | `rak_issuing_token_network_data_read` |  |
| Issuing Tokens | `rak_issuing_network_token_read` | `rak_issuing_network_token_write` |
| Issuing Transactions | `rak_issuing_transaction_read` | `rak_issuing_transaction_write` |

Unlabeled ids in this group (present in the form, label not captured): `rak_account_notice_read`, `rak_account_notice_write`, `rak_credit_underwriting_record_read`, `rak_credit_underwriting_record_write`, `rak_issuing_authentication_read`, `rak_issuing_authentication_write`, `rak_issuing_card_sensitive_read`, `rak_issuing_credit_policy_read`, `rak_issuing_credit_policy_write`, `rak_issuing_credit_repayment_read`, `rak_issuing_credit_repayment_write`, `rak_issuing_credit_statement_read`, `rak_issuing_credit_statement_write`, `rak_issuing_fraud_classification_read`, `rak_issuing_fraud_classification_write`, `rak_issuing_funding_obligation_read`, `rak_issuing_funding_obligation_write`, `rak_issuing_funding_strategy_read`, `rak_issuing_funding_strategy_write`, `rak_issuing_ledger_read`, `rak_issuing_ledger_write`, `rak_issuing_program_read`, `rak_issuing_program_write`, `rak_issuing_receipt_read`, `rak_issuing_receipt_write`, `rak_issuing_verification_write`

## Orchestrated Commerce

Group: `rak_bucket_orchestrated_commerce_read`, `rak_bucket_orchestrated_commerce_write`

| Resource | Read | Write |
|---|---|---|
| Orchestrated Commerce Agreements | `rak_orchestrated_commerce_agreement_read` | `rak_orchestrated_commerce_agreement_write` |

## Orders

Group: `rak_bucket_relay_read`, `rak_bucket_relay_write`

| Resource | Read | Write |
|---|---|---|
| Orders | `rak_order_read` | `rak_order_write` |
| Product SKUs | `rak_sku_read` | `rak_sku_write` |

## Payment Links

Group: `rak_bucket_payment_links_read`, `rak_bucket_payment_links_write`

| Resource | Read | Write |
|---|---|---|
| Payment Links | `rak_payment_links_read` | `rak_payment_links_write` |

## Payment Records

Group: `rak_bucket_payment_records_read`, `rak_bucket_payment_records_write`

| Resource | Read | Write |
|---|---|---|
| Payment Records | `rak_payment_records_read` | `rak_payment_records_write` |

## Provisioning

Group: `rak_bucket_provisioning_read`, `rak_bucket_provisioning_write`

| Resource | Read | Write |
|---|---|---|
| Provisioning Account Requests | `rak_provisioning_account_request_read` | `rak_provisioning_account_request_write` |
| Provisioning Projects | `rak_provisioning_project_read` | `rak_provisioning_project_write` |
| Provisioning Resources | `rak_provisioning_resource_read` | `rak_provisioning_resource_write` |

## Radar

Group: `rak_bucket_radar_read`, `rak_bucket_radar_write`

| Resource | Read | Write |
|---|---|---|
| Radar Value Lists | `rak_radar_value_list_read` | `rak_radar_value_list_write` |
| Reviews | `rak_review_read` | `rak_review_write` |

Unlabeled ids in this group (present in the form, label not captured): `rak_radar_account_evaluation_read`, `rak_radar_account_evaluation_write`, `rak_radar_api_write`, `rak_radar_customer_evaluation_read`, `rak_radar_customer_evaluation_write`

## Reporting

Group: `rak_bucket_reporting_read`, `rak_bucket_reporting_write`

| Resource | Read | Write |
|---|---|---|
| Financial Reports | `rak_financial_statement_read` | `rak_financial_statement_write` |

## Sigma

Group: `rak_bucket_sigma_api_read`, `rak_bucket_sigma_api_write`

| Resource | Read | Write |
|---|---|---|
| Sigma Queries | `rak_sigma_api_read` | `rak_sigma_api_write` |

## Stripe Apps

Group: `rak_bucket_stripe_apps_read`, `rak_bucket_stripe_apps_write`

| Resource | Read | Write |
|---|---|---|
| Secrets | `rak_secret_read` | `rak_secret_write` |
| Stripe Apps |  | `rak_stripe_apps_viewer`, `rak_stripe_apps_developer` |
| Stripe Apps Administration |  | `rak_stripe_apps_admin` |

## Stripe CLI

Group: `rak_bucket_stripecli_write`

| Resource | Read | Write |
|---|---|---|
| Debugging Tools |  | `rak_stripecli_session_write` |

## Stripe Network

Group: `rak_bucket_business_network_read`, `rak_bucket_business_network_write`

| Resource | Read | Write |
|---|---|---|
| Stripe Profiles | `rak_business_network_profile_read` | `rak_business_network_profile_write` |

## Tax

Group: `rak_bucket_tax_product_read`, `rak_bucket_tax_product_write`

| Resource | Read | Write |
|---|---|---|
| Tax Calculations, Transactions | `rak_tax_transaction_read` | `rak_tax_transaction_write` |
| Tax Locations | `rak_tax_locations_read` | `rak_tax_locations_write` |
| Tax Settings, Registrations | `rak_tax_settings_read` | `rak_tax_settings_write` |
| Tax Transaction Reports | `rak_bucket_tax_product_report_read` |  |
| Tax Enrollment Information | `rak_tax_enrollment_information_read` |  |
| Tax Liability Reports | `rak_tax_liability_read` |  |

## Terminal

Group: `rak_bucket_terminal_device_management_read`, `rak_bucket_terminal_device_management_write`

| Resource | Read | Write |
|---|---|---|
| Terminal Configurations | `rak_terminal_configuration_read` | `rak_terminal_configuration_write` |
| Terminal Connection Tokens |  | `rak_terminal_connection_token_write` |
| Terminal Locations | `rak_terminal_location_read` | `rak_terminal_location_write` |
| Terminal Onboarding Links | `rak_terminal_onboarding_link_read` | `rak_terminal_onboarding_link_write` |
| Terminal Readers | `rak_terminal_reader_read` | `rak_terminal_reader_write` |

Unlabeled ids in this group (present in the form, label not captured): `rak_terminal_admin_operation_read`, `rak_terminal_admin_operation_write`, `rak_terminal_app_deployment_read`, `rak_terminal_app_deployment_write`, `rak_terminal_app_upload_read`, `rak_terminal_app_upload_write`, `rak_terminal_hardware_order_read`, `rak_terminal_hardware_order_write`, `rak_terminal_location_capability_read`, `rak_terminal_location_capability_write`, `rak_terminal_reader_collected_data_read`

## Third-Party Gift Cards

Group: `rak_bucket_third_party_gift_card_read`, `rak_bucket_third_party_gift_card_write`

| Resource | Read | Write |
|---|---|---|
| Third-Party Gift Card Operations | `rak_third_party_gift_card_read` | `rak_third_party_gift_card_write` |

## Webhook Endpoints

Group: `rak_bucket_admin_read`, `rak_bucket_admin_write`

| Resource | Read | Write |
|---|---|---|
| Webhook Endpoints, Event Destinations | `rak_webhook_read` | `rak_webhook_write` |

## Workflows

Group: `rak_bucket_workflow_v2_read`, `rak_bucket_workflow_v2_write`

| Resource | Read | Write |
|---|---|---|
| Workflow Definitions | `rak_settings_automation_v2_read` | `rak_settings_automation_v2_write` |
| Workflow Execution |  | `rak_workflow_run_write` |
