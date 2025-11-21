#!/bin/bash

# Copy script for Next.js standalone build to deploy repo
# Run this after: pnpm build

set -e  # Exit on any error

DEPLOY_DIR=~/proselenos-deploy
SOURCE_DIR=apps/proselenos-app

echo "Starting deployment copy to $DEPLOY_DIR"

# Check if build exists
if [ ! -d "$SOURCE_DIR/.next/standalone" ]; then
  echo "Error: Standalone build not found. Run 'pnpm build' first."
  exit 1
fi

# Create deploy directory if it doesn't exist
mkdir -p "$DEPLOY_DIR"

echo "Copying standalone server and dependencies..."
cp -R "$SOURCE_DIR/.next/standalone/"* "$DEPLOY_DIR/"

echo "Copying static assets..."
mkdir -p "$DEPLOY_DIR/apps/proselenos-app/.next"
cp -R "$SOURCE_DIR/.next/static" "$DEPLOY_DIR/apps/proselenos-app/.next/"

echo "Copying public folder..."
cp -R "$SOURCE_DIR/public" "$DEPLOY_DIR/apps/proselenos-app/"

echo "Cleaning up unnecessary package.json files..."
rm -f "$DEPLOY_DIR/package.json"
rm -f "$DEPLOY_DIR/apps/proselenos-app/package.json"
echo "  Removed metadata files (dependencies already bundled in node_modules)"

echo "Deployment copy complete!"
echo ""
echo "Next steps:"
echo "  1. cd $DEPLOY_DIR"

#       2. copy .env's
# All .env files in the repo:
# ./apps/proselenos-app/.env.local
# ./apps/proselenos-app/.env.web
#
# After running ./copy-to-deploy.sh, copy .env files for local testing:
# cp apps/proselenos-app/.env.local ~/proselenos-deploy/apps/proselenos-app/
# cp apps/proselenos-app/.env.web ~/proselenos-deploy/apps/proselenos-app/

echo "  3. Test locally: node apps/proselenos-app/server.js"
echo "  4. Commit and push to GitHub"
echo "  5. Configure Render.com web service:"
echo "     - Build Command: echo \"Using pre-built standalone\""
echo "     - Start Command: node apps/proselenos-app/server.js"

