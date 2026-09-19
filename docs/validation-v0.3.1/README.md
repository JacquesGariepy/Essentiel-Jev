# OAuth regression evidence, 0.3.1

`before-v0.3.json` and `after-v0.3.1.json` are emitted by the same raw-HTTP
reproduction using the original and corrected servers. All upstream data is synthetic.
The original server stores the test account, then rejects the cross-site document
landing with 403. The corrected server stores it and serves the landing with 200.
The requests include exact Sec-Fetch-Site, Sec-Fetch-Mode and Sec-Fetch-Dest values.

`node-tests.log`: all 136 tests passed. This includes 17 new OAuth tests.
`oauth-browser-attempt.json`: full-browser local navigation was blocked by environment
policy. No policy was changed and no native-browser OAuth pass is claimed.
`dom-partial-attempt.log`: nineteen retained connected DOM checks completed; the
remaining erase/empty-state sequence did not finish within the run's time limit.
`connected-browser-partial.json`: explicit partial status, not a whole-suite pass.
The screenshots in this directory show only synthetic fixture accounts.

No real Google account, Microsoft account, TypeSafe inference, public OAuth verification,
or native Windows executable was tested or built for this patch.
