# `/api/admin` namespace deprecation

`/api/workspace/*` is the canonical authenticated-team API namespace. New
first-party integrations, test fixtures, and external clients must use this
namespace.

## Compatibility window

The legacy `/api/admin/*` namespace remains available through
**2026-11-07T00:00:00.000Z**. During that window, the application rewrites a
legacy request internally to the identical `/api/workspace/*` path. It is not
a browser redirect: the HTTP method, body, query string, cookies, and response
body/status are preserved.

Legacy responses include these headers:

```http
Deprecation: true
Sunset: Fri, 07 Nov 2026 00:00:00 GMT
Link: </api/workspace/...>; rel="successor-version"
```

Canonical `/api/workspace/*` responses do not include the deprecation headers.

## Migration rule

Replace only the namespace prefix:

```text
/api/admin/disputes?overdue=true
/api/workspace/disputes?overdue=true
```

Do not alter the remaining path, URL encoding, query parameters, HTTP method,
request body, or authentication mechanism. Public, portal, auth, service, and
cron API namespaces are unaffected.

## After the sunset

After the cutoff, `/api/admin/*` returns the data-free response:

```json
{ "error": "API endpoint retired" }
```

with HTTP `410 Gone`, before authorization, database, storage, or provider
work can occur.

## Removal checklist

The compatibility adapter must not be deleted automatically at the cutoff.
Before a separately approved removal change:

1. Review production volume marked `x-api-namespace: legacy-admin`.
2. Notify any remaining external consumers and confirm their migration.
3. Keep a focused `410` regression test and run the full verification suite.
4. Record the approval and deployment evidence with the removal change.

This document announces the contract; it does not claim that external
consumers have already migrated.
