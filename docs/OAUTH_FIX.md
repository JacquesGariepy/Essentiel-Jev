# Essentiel 0.3.1 — Google OAuth, localhost and Desktop clients

## Root cause

The JSON error `{"error":"Requête intersite refusée."}` comes from Essentiel, not Google.
Version 0.3 already allowed the OAuth callback. The callback could exchange the code,
store the account, and return a 303 redirect to `/`. The next request could still carry
`Sec-Fetch-Site: cross-site` because of the Google → callback → home redirect chain.
The blanket cross-site guard then rejected the home page with 403.
A synthetic reproduction confirms that an account can already be stored before this
rendering error; it does not prove any particular real account was successfully connected.

## Immediate recovery

Without stopping the server, type the original application's address directly in the browser:

```text
http://localhost:8787/#connections
```

Keep the original host and port. Do not reload an old callback URL containing `code` and
`state`; authorization codes are one-use. The Connections page shows actual server-side
account state. After upgrading, start a fresh flow from the connection button if necessary.

## Update safely

Stop the server, replace the application files with the corrected archive, and preserve your
existing `.env` and `.data/`. The archive contains neither a populated `.env` nor a `.data/`
directory. Do not overwrite your configuration with `.env.example`. Restart using `npm start`
or `start-windows.cmd`. In-memory-only connections are lost on shutdown as before. Browser
workspace data stays associated with its original origin; retain the same UI address.

## Google Desktop app OAuth client

Use the existing `.env` file:

```dotenv
GOOGLE_OAUTH_CLIENT_TYPE=desktop
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=the_secret_from_the_downloaded_JSON_if_present
```

The client secret is optional in desktop mode. Copy it exactly when Google provides one;
do not invent one or use the placeholder literally. A static installed-client secret is not
a confidential secret from the device owner. PKCE S256 is still required by this implementation.
Use a **Desktop app** OAuth client, not a Chrome app, Android app or iOS client.

No public server, tunnel or public domain is required. Authorization opens in the normal
browser, not an embedded WebView. The default callback is computed as:

```text
http://127.0.0.1:8787/oauth/google/callback
```

The port follows `PORT`. This local-server distribution reuses its configured listening port;
it does not allocate a temporary random callback port. A single pending flow per provider
expires after ten minutes. Do not configure a desktop client as though it were a Web client.

A one-use local launch ticket sets the binding cookie on 127.0.0.1 before leaving for Google.
This avoids losing the cookie when starting the UI on localhost. State, browser cookie,
expected callback host, provider, expiry and PKCE remain enforced. Success redirects back
to the original local UI origin. No permissive CORS settings are added.

### Downloaded Google OAuth JSON

Place the downloaded OAuth client JSON at `google-oauth.json`, alongside `server.mjs`:

```dotenv
GOOGLE_OAUTH_CLIENT_TYPE=desktop
GOOGLE_CLIENT_CONFIG_FILE=./google-oauth.json
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

The file must contain `installed`, not a service-account key. The server reads the ID and
optional secret; endpoint URLs in the file are ignored. Contradictory credentials or types
are rejected. Keep this file and `.env` out of shared archives and version control.

## Existing Web clients

Web clients remain supported with `GOOGLE_OAUTH_CLIENT_TYPE=web`, their ID and required
secret, and their exact registered callback. Omitting the type retains the previous Web
behavior; a configured JSON file can also auto-detect its installed/web type. Localhost
alone does not determine the OAuth client type. Microsoft remains a Web client in this patch.

## Security and validation

Only top-level GET document navigation to `/` and `/workspace` is exempted from the global
cross-site block. APIs, POST writes, scripts, images and frames remain protected. OAuth
callbacks and the desktop launch endpoint have separate navigation and validity checks.
A `connected` query parameter never grants access: UI status comes from the server's account.

136 Node tests pass, including 17 new regression tests. Raw `http.request` is used for browser
metadata simulation because Node fetch overwrites `Sec-Fetch-Mode`. All provider traffic in
tests is synthetic. No real Google consent, user account or TypeSafe inference was tested.
The real Chromium navigation test was attempted but blocked by this environment's policy
(`ERR_BLOCKED_BY_ADMINISTRATOR`); it is not counted as passed. The included test can be run
in a test environment that permits local navigation, still with synthetic provider responses.
Here, “desktop” refers to the OAuth client type. This archive remains a local Node server
with a browser interface, not a newly built native Windows executable.

## Official references

Checked on September 19, 2026.

- Fetch Metadata redirects: https://w3c.github.io/webappsec-fetch-metadata/#redirects
- Google installed-app OAuth: https://developers.google.com/identity/protocols/oauth2/native-app
- Desktop loopback support: https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration
- Native OAuth RFC 8252: https://www.rfc-editor.org/rfc/rfc8252.html
- OWASP CSRF and top-level navigation: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
