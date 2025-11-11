#!/bin/bash

# Copy script for Next.js standalone build to deploy repo
# Run this after: pnpm build-web

set -e  # Exit on any error

DEPLOY_DIR=~/proselenosebooks-deploy
SOURCE_DIR=apps/proselenosebooks-app

echo "🚀 Starting deployment copy to $DEPLOY_DIR"

# Check if build exists
if [ ! -d "$SOURCE_DIR/.next/standalone" ]; then
  echo "❌ Error: Standalone build not found. Run 'pnpm build-web' first."
  exit 1
fi

# Create deploy directory if it doesn't exist
mkdir -p "$DEPLOY_DIR"

echo "📦 Copying standalone server and dependencies..."
cp -R "$SOURCE_DIR/.next/standalone/"* "$DEPLOY_DIR/"

echo "📁 Copying static assets..."
mkdir -p "$DEPLOY_DIR/apps/proselenosebooks-app/.next"
cp -R "$SOURCE_DIR/.next/static" "$DEPLOY_DIR/apps/proselenosebooks-app/.next/"

echo "🖼️  Copying public folder..."
cp -R "$SOURCE_DIR/public" "$DEPLOY_DIR/apps/proselenosebooks-app/"

echo "🔐 Copying environment files (for local testing - gitignored)..."
cp "$SOURCE_DIR/.env.local" "$DEPLOY_DIR/apps/proselenosebooks-app/" 2>/dev/null || echo "  ⚠️  .env.local not found"
cp "$SOURCE_DIR/.env.web" "$DEPLOY_DIR/apps/proselenosebooks-app/" 2>/dev/null || echo "  ⚠️  .env.web not found"

echo "🧹 Cleaning up unnecessary package.json files..."
rm -f "$DEPLOY_DIR/package.json"
rm -f "$DEPLOY_DIR/apps/proselenosebooks-app/package.json"
echo "  ✓ Removed metadata files (dependencies already bundled in node_modules)"

echo "✅ Deployment copy complete!"
echo ""
echo "Next steps:"
echo "  1. cd $DEPLOY_DIR"
echo "  2. Test locally: node apps/proselenosebooks-app/server.js"
echo "  3. Commit and push to GitHub"
echo "  4. Configure Render:"
echo "     - Build Command: (empty)"
echo "     - Start Command: node apps/proselenosebooks-app/server.js"
