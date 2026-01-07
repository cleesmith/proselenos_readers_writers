#!/bin/bash

echo "Cleaning proselenos project..."

# Remove root node_modules
if [ -d "node_modules" ]; then
    echo "Removing root node_modules..."
    rm -rf node_modules
fi

# Remove app node_modules
if [ -d "apps/proselenos-app/node_modules" ]; then
    echo "Removing apps/proselenos-app/node_modules..."
    rm -rf apps/proselenos-app/node_modules
fi

# Remove .next build directory
if [ -d "apps/proselenos-app/.next" ]; then
    echo "Removing apps/proselenos-app/.next..."
    rm -rf apps/proselenos-app/.next
fi

# Remove any .turbo cache
if [ -d ".turbo" ]; then
    echo "Removing .turbo..."
    rm -rf .turbo
fi

# Remove pnpm store (optional - uncomment if needed)
# echo "Removing pnpm store..."
# rm -rf ~/.local/share/pnpm/store

echo ""
echo "Clean complete! Now run:"
echo "  pnpm install"
echo "  pnpm build"
