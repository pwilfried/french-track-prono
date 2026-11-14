#!/usr/bin/env bash
# Writes the local Supabase address, anon key and service_role key to $GITHUB_ENV (CI and ui-shots
# workflows). The service_role key is the local stack's, for the demo sign-in of #637 and its tests.
# With some services excluded, `supabase status` prints no API key, so the key is built from the
# documented default JWT secret of the local stack (local use only, never a real secret).
set -euo pipefail
status=$(supabase status -o json)
echo "NEXT_PUBLIC_SUPABASE_URL=$(jq -r .API_URL <<< "$status")" >> "$GITHUB_ENV"
# A key signed with the local stack's default secret, for the given role.
local_key() {
  ROLE="$1" node -e '
    const crypto = require("node:crypto");
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const body = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ iss: "supabase-demo", role: process.env.ROLE, exp: 1983812996 });
    const sig = crypto.createHmac("sha256", "super-secret-jwt-token-with-at-least-32-characters-long").update(body).digest("base64url");
    console.log(body + "." + sig);
  '
}
KEY=$(jq -r '.PUBLISHABLE_KEY // .ANON_KEY // empty' <<< "$status")
[ -n "$KEY" ] || KEY=$(local_key anon)
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$KEY" >> "$GITHUB_ENV"
SERVICE=$(jq -r '.SERVICE_ROLE_KEY // .SECRET_KEY // empty' <<< "$status")
[ -n "$SERVICE" ] || SERVICE=$(local_key service_role)
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE" >> "$GITHUB_ENV"
