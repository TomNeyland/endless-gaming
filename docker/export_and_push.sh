#!/bin/bash
set -e

echo "$(date): Starting JSON export"

# Generate master.json
python scripts/generate_master_json_direct.py /tmp/master.json --max-games 1500

# Push to GitHub if credentials available
if [ -n "$GITHUB_TOKEN" ] && [ -n "$GITHUB_REPO" ]; then
    echo "Pushing to GitHub repository..."
    
    # Get current file SHA
    CURRENT_SHA=$(gh api repos/$GITHUB_REPO/contents/endless-gaming-frontend/master.json --jq '.sha' 2>/dev/null || echo "")
    
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