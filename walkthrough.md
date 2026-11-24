# Security Summary

Following an audit of the platform backend, HTTP middleware, and browser OAuth integration, the following protections were implemented and hardened:

- **Privilege & Access Control on Destructive Analytics Route**: Added explicit authentication and permission enforcement (`analytics:view`) on `DELETE /api/analytics/reset` so unauthenticated visitors (`401`) and non-privileged accounts (`403`) can no longer wipe platform telemetry.
- **Cross-Site Request Forgery (CSRF) Defence**: Added `createCookieCsrfMiddleware` for all cookie-authenticated mutating API calls, verifying matching `Origin`/`Referer` hosts or the custom `X-Requested-With` header, and updated browser fetch clients (`socialApi`, `AnalyticsSection`, `NotificationsModal`, `RcaAssistantChatWidget`, `gitSyncApi`) accordingly.
- **Strict Window Messaging Origin**: Removed wildcard `postMessage(..., '*')` in `LinkedAccountsRouter` OAuth popup callbacks in favor of the computed origin, and tightened the client message listener in `LinkedAccountsCard` to require exact `event.origin === window.location.origin` equality.
- **Session Cookie Clearing Consistency**: Unified logout, password reset, and password change cookie revocation through `clearSessionCookie` so attribute matching remains consistent across reverse-proxy deployments.
- **Registration Abuse & Memory Exhaustion Prevention**: Added IP-based throttling (`register-ip`) to `POST /api/auth/register` and enforced bounded bucket capacity in `RateLimiter` to protect process memory under IP churn.
- **CSP & Safe API Docs Rendering**: Centralized response security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, strict `object-src 'none'`, `base-uri 'none'`, Google Maps allowances, and environment-scoped `frame-ancestors`), and removed string-based `innerHTML` injection in the OpenAPI documentation bootstrapper.

## PoC Verification

All findings were verified against a live Express application runtime in `tests/http-api-security-and-metrics.test.ts`:

- **Unauthorized Destructive Action Blocked**: Sending `DELETE /api/analytics/reset` anonymously returned `401`; calling it as a signed-in `candidate` returned `403`; calling it after administrative privilege assignment succeeded with `200`.
- **Cross-Origin Forgery Blocked**: Sending a forged `PATCH /api/account/profile` request with a valid session cookie and foreign `Origin: https://evil.example` (without `X-Requested-With`) returned `403 CSRF_ORIGIN_MISMATCH`.
- **OAuth Callback Origin & Script Nonce**: Fetching `/api/account/oauth/google/callback?error=access_denied` confirmed wildcard target origins are absent and inline scripts execute strictly under per-response CSP nonces.
- **Abuse Throttling & Memory Caps**: Sending 11 rapid registrations from a single client address triggered `429 RATE_LIMITED` with `Retry-After`, and `RateLimiter` kept bucket cardinality strictly bounded under synthetic IP churn.
