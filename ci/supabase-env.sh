#!/usr/bin/env bash
# Writes the local Supabase address and anon key to $GITHUB_ENV (CI and ui-shots workflows).
# With some services excluded, `supabase status` prints no API key, so the key is built from the
# documented default JWT secret of the local stack (local use only, never a real secret).
set -euo pipefail
status=$(supabase status -o json)
echo "NEXT_PUBLIC_SUPABASE_URL=$(jq -r .API_URL <<< "$status")" >> "$GITHUB_ENV"
KEY=$(jq -r '.PUBLISHABLE_KEY // .ANON_KEY // empty' <<< "$status")
if [ -z "$KEY" ]; then
  KEY=$(node -e '
    const crypto = require("node:crypto");
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const body = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ iss: "supabase-demo", role: "anon", exp: 1983812996 });
    const sig = crypto.createHmac("sha256", "super-secret-jwt-token-with-at-least-32-characters-long").update(body).digest("base64url");
    console.log(body + "." + sig);
  ')
fi
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$KEY" >> "$GITHUB_ENV"
