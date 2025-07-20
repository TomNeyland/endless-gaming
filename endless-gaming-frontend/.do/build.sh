#!/bin/bash
# Build script for DigitalOcean App Platform deployment
# This script handles the Angular build process with error checking

set -e  # Exit on any error

echo "🚀 Starting Angular build for DigitalOcean App Platform..."

# Check Node.js version
echo "📋 Node.js version: $(node --version)"
echo "📋 NPM version: $(npm --version)"

# Clean install dependencies
echo "📦 Installing dependencies..."
npm ci --silent

# Run build with production configuration
echo "🔨 Building Angular application..."
npm run build -- --configuration production

# Verify build output
if [ -d "dist" ]; then
    echo "✅ Build successful!"
    echo "📊 Build output:"
    du -sh dist/
    echo "📂 Generated files:"
    find dist/ -name "*.js" -o -name "*.html" -o -name "*.css" | head -10
else
    echo "❌ Build failed - no dist directory found"
    exit 1
fi

# Verify required files exist
if [ ! -f "dist/index.html" ]; then
    echo "❌ Missing index.html in build output"
    exit 1
fi

echo "🎉 Angular build completed successfully for deployment!"