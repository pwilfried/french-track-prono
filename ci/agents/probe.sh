#!/usr/bin/env bash
# Is Claude's plan usable right now? A one-word request, almost free.
# Exit 0: yes; 2: out of quota; 1: another error. Env: CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY.
set -uo pipefail
here=$(dirname "$0")
# shellcheck source=ci/agents/lib.sh
. "$here/lib.sh"
log=$(mktemp)
export PATH="$HOME/.local/bin:$PATH"
command -v claude >/dev/null || curl -fsSL https://claude.ai/install.sh | bash >/dev/null 2>&1
timeout 180 claude -p "Reply with the word OK only." --max-turns 1 > "$log" 2>&1
rc=$?
tail -5 "$log" | sed "s/^/  claude: /"
if [ "$rc" -eq 0 ] && grep -qi 'ok' "$log"; then exit 0; fi
if grep -Eiq "$quota_re" "$log"; then exit 2; fi
exit 1
