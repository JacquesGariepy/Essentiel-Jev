# Live connector acceptance — NOT EXECUTED

Status on 2026-09-19: no Google account, Microsoft account or TypeSafe key was used for live validation. This document is a repeatable acceptance protocol, not a completed test report. Use a disposable test mailbox/calendar/task list and obtain the account holder's consent. Keep secrets, tokens and private mail out of reports.

## Required evidence per provider

Record provider, application audience, redacted account category (personal/work), test date, relevant granted scopes, browser/OS, native object IDs, screenshots with sensitive values removed, and pass/fail observations. Use native provider UI plus API read-back; never substitute a fixture response.

1. Start a fresh local instance. Confirm no provider is shown as connected. Register the exact callback and selected APIs.
2. Authorize read-only mail/calendar/tasks/files separately. Deny a scope and confirm the corresponding capability is unavailable, not silently enabled. Test a cancelled consent and wrong/expired OAuth state.
3. Read one known mailbox message. Verify sender, original link, text and timestamp. Test HTML-only and long messages. Confirm attachments and remote pixels are not fetched. Check all data exposed fits the disclosed scope.
4. Select at least two calendars and compare a known busy interval, all-day event and daylight-saving transition. Revoke access to a selected calendar and confirm availability fails closed. Propose a block, add a conflicting event in the native UI, then approve and confirm the stale proposal is blocked. Clean up through the original provider UI after the test.
5. Incrementally authorize drafts. Create a clearly marked draft, inspect UTF-8 text, subject, destination mailbox and recipient. Confirm it appears in Drafts and **was not sent**. Test long non-ASCII subjects. Note that native Outlook reply-thread association is not implemented.
6. Create one clearly marked task in an explicit test list, inspect source link and chosen date, then complete it through a separate approved operation. Verify the provider status. Google task date is scheduling metadata, not a notification or strict-deadline guarantee.
7. Query one known Drive/OneDrive filename and inspect the original link. Test an empty query result, inaccessible files and pagination/quotas. Confirm no document body goes to TypeSafe.
8. Simulate revoked consent, expired app secret and refresh-token expiry without exposing secrets. Confirm explicit errors, stale-data warnings and safe reconnection. Check the account cannot be silently replaced by another account from the same provider.
9. Exercise opt-in encryption, restart locked, wrong passphrase, unlock, local disconnect and local erase. Verify `.env` is not publicly served and provider objects remain unless explicitly removed in the native tool. Revoke provider access separately.
10. Introduce controlled network loss during a test write, then inspect the native service. Confirm unknown outcome is shown without blind retry or false success. Review recorded object IDs and recovery behavior.

## TypeSafe acceptance, separately authorized

Use non-sensitive text. Confirm the exact editable transmission preview, consent, requested model, actual typed answers and usage. Check Choice/Score/Noul contract validation and no automatic external write. Do not infer production calibration from one successful request.

## Public release gate — NOT SATISFIED

Live account tests above, provider app review as applicable, independent security review, supported deployment architecture, accessibility/usability validation, multiuser isolation where offered, operational error/revocation support and retention/deletion behavior. A successful local prototype does not satisfy these gates automatically.
