# Release compatibility

`GET /api/release` is public, read-only and returns `Cache-Control: no-store`.
No authentication credentials, paths or infrastructure addresses are exposed.

```json
{
  "environment": "production",
  "release_id": "<immutable release identifier>",
  "backend_version": "0.9.23",
  "api_contract": "8.1.0",
  "engine_core": "0.2.3",
  "protocol": "engine-v2",
  "policy": "rtp-ewma-v9",
  "capabilities": ["deployment-drain-v1", "hall-scoped-receipts"],
  "ready": true
}
```

A frontend build must check the expected environment, supported API contract
major/minor and required capabilities. `ready` is true only while write
admission is open and the backend can read its database. Failure, missing
fields or incompatible values must prevent publication; they must never cause
an automatic fallback to another environment. Release identity is independent
of the UI version and GitHub branch name.

During a controlled backend update mutating HTTP requests may receive `503`
with `Retry-After: 2`. A transport failure, timeout or server error does not
prove that a financial operation was rejected. Retry the original operation
with its original payload and idempotency key. Intake additionally retains its
original barcode and round descriptor; never convert a retry into a new round's
bet. A successful replay returns the existing operation.

The authenticated loopback deployment control routes are internal operational
interfaces and are deliberately excluded from the public client contract.
