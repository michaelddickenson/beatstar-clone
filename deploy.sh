#!/bin/bash

# Beatstar Clone - GitHub Pages Deployment Script
# This script helps you deploy to GitHub Pages

echo "==================================="
echo "Beatstar Clone - Deployment Helper"
echo "==================================="
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first:"
    echo "   - Mac: Install Xcode Command Line Tools"
    echo "   - Windows: Download from https://git-scm.com/"
    exit 1
fi

echo "✅ Git is installed"
echo ""

# Check if this is already a git repo
if [ -d .git ]; then
    echo "⚠️  This folder is already a Git repository."
    read -p "Do you want to push updates? (y/n): " push_updates
    if [ "$push_updates" = "y" ]; then
        git add .
        git commit -m "Update Beatstar Clone"
        git push
        echo "✅ Changes pushed to GitHub!"
        exit 0
    else
        exit 0
    fi
fi

# New repository setup
echo "📝 Setting up new repository..."
echo ""

read -p "Enter your GitHub username: " github_username
read -p "Enter repository name (e.g., beatstar-clone): " repo_name

echo ""
echo "Creating local git repository..."
git init
git add .
git commit -m "Initial commit - Beatstar Clone"
git branch -M main

echo ""
echo "==================================="
echo "⚠️  IMPORTANT - Next Steps:"
echo "==================================="
echo ""
echo "1. Go to GitHub: https://github.com/new"
echo "2. Create a repository named: $repo_name"
echo "3. Make it PUBLIC (required for free GitHub Pages)"
echo "4. Do NOT initialize with README, .gitignore, or license"
echo "5. Click 'Create repository'"
echo ""
echo "After creating the repository, run:"
echo ""
echo "git remote add origin https://github.com/$github_username/$repo_name.git"
echo "git push -u origin main"
echo ""
echo "Then enable GitHub Pages:"
echo "1. Go to repository Settings → Pages"
echo "2. Under 'Source', select 'main' branch"
echo "3. Click 'Save'"
echo "4. Wait 1-2 minutes"
echo "5. Visit: https://$github_username.github.io/$repo_name/"
echo ""
echo "==================================="