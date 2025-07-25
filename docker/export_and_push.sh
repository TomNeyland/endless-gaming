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
    
    # Base64 encode content
    CONTENT=$(base64 -i /tmp/master.json | tr -d '\n')
    
    # Update or create file
    if [ -n "$CURRENT_SHA" ]; then
        gh api repos/$GITHUB_REPO/contents/endless-gaming-frontend/master.json \
            --method PUT \
            --field message="🎮 Daily game data update - $(date '+%Y-%m-%d')" \
            --field content="$CONTENT" \
            --field sha="$CURRENT_SHA"
    else
        gh api repos/$GITHUB_REPO/contents/endless-gaming-frontend/master.json \
            --method PUT \
            --field message="🎮 Initial game data - $(date '+%Y-%m-%d')" \
            --field content="$CONTENT"
    fi
    
    echo "✅ Successfully updated GitHub repository"
else
    echo "⚠️  GitHub credentials not found, skipping repository update"
fi

echo "📊 File size: $(du -h /tmp/master.json | cut -f1)"
echo "🎯 Games count: $(jq length /tmp/master.json)"
echo "$(date): Export completed"