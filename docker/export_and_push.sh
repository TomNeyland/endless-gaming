#!/bin/bash
set -e

# --if-stale: only export when the committed master.json is older than
# MAX_DATA_AGE_HOURS. The container runs an export on every start, and the
# DigitalOcean app has deploy_on_push enabled on the same branch this script
# pushes to - so an unconditional export on boot creates a loop:
#   push master.json -> deploy_on_push -> new container -> export -> push ...
# Cron calls this script without the flag, so the daily update still runs.
IF_STALE=0
if [ "$1" = "--if-stale" ]; then
    IF_STALE=1
fi
MAX_DATA_AGE_HOURS="${MAX_DATA_AGE_HOURS:-20}"

if [ "$IF_STALE" = "1" ] && [ -n "$GITHUB_TOKEN" ] && [ -n "$GITHUB_REPO" ]; then
    LAST_PUSH=$(gh api "repos/$GITHUB_REPO/commits?path=endless-gaming-frontend/master.json&per_page=1" \
        --jq '.[0].commit.committer.date' 2>/dev/null || echo "")
    if [ -n "$LAST_PUSH" ]; then
        LAST_EPOCH=$(date -d "$LAST_PUSH" +%s 2>/dev/null || echo 0)
        AGE_HOURS=$(( ( $(date +%s) - LAST_EPOCH ) / 3600 ))
        if [ "$LAST_EPOCH" != "0" ] && [ "$AGE_HOURS" -lt "$MAX_DATA_AGE_HOURS" ]; then
            echo "$(date): master.json was updated ${AGE_HOURS}h ago (< ${MAX_DATA_AGE_HOURS}h) - skipping startup export"
            exit 0
        fi
    fi
fi

echo "$(date): Starting JSON export"

# Generate master.json
python scripts/generate_master_json_direct.py /tmp/master.json --max-games 1500

# Push to GitHub if credentials available
if [ -n "$GITHUB_TOKEN" ] && [ -n "$GITHUB_REPO" ]; then
    echo "Pushing to GitHub repository..."
    
    # Get current file SHA
    CURRENT_SHA=$(gh api repos/$GITHUB_REPO/contents/endless-gaming-frontend/master.json --jq '.sha' 2>/dev/null || echo "")

    # Skip the push when the freshly generated file is byte-identical to what
    # is already committed. This container runs an export on every start, so
    # without this guard each restart produced another commit - and another
    # full round of CI runs - even when the data had not changed at all.
    # The value below is the git blob hash, which is exactly what the GitHub
    # contents API reports as .sha
    if [ -n "$CURRENT_SHA" ]; then
        NEW_SHA=$(printf 'blob %d\0' "$(stat -c%s /tmp/master.json)" | cat - /tmp/master.json | sha1sum | cut -d' ' -f1)
        if [ "$NEW_SHA" = "$CURRENT_SHA" ]; then
            echo "✅ master.json is unchanged (blob $NEW_SHA) - skipping push"
            echo "📊 File size: $(du -h /tmp/master.json | cut -f1)"
            echo "🎯 Games count: $(jq length /tmp/master.json)"
            echo "$(date): Export completed (no push needed)"
            exit 0
        fi
    fi

    # Create temporary JSON payload file to avoid command line length limits
    TEMP_PAYLOAD="/tmp/github_payload.json"
    
    # Base64 encode content and create JSON payload
    CONTENT=$(base64 -i /tmp/master.json | tr -d '\n')
    
    if [ -n "$CURRENT_SHA" ]; then
        cat > "$TEMP_PAYLOAD" << EOF
{
  "message": "🎮 Daily game data update - $(date '+%Y-%m-%d')",
  "content": "$CONTENT",
  "sha": "$CURRENT_SHA"
}
EOF
        gh api repos/$GITHUB_REPO/contents/endless-gaming-frontend/master.json \
            --method PUT \
            --input "$TEMP_PAYLOAD"
    else
        cat > "$TEMP_PAYLOAD" << EOF
{
  "message": "🎮 Initial game data - $(date '+%Y-%m-%d')",
  "content": "$CONTENT"
}
EOF
        gh api repos/$GITHUB_REPO/contents/endless-gaming-frontend/master.json \
            --method PUT \
            --input "$TEMP_PAYLOAD"
    fi
    
    # Clean up temporary file
    rm -f "$TEMP_PAYLOAD"
    
    echo "✅ Successfully updated GitHub repository"
else
    echo "⚠️  GitHub credentials not found, skipping repository update"
fi

echo "📊 File size: $(du -h /tmp/master.json | cut -f1)"
echo "🎯 Games count: $(jq length /tmp/master.json)"
echo "$(date): Export completed"