#!/bin/bash

# Quick Start Script for Task Management Pro
echo "🚀 Starting Task Management Pro..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run 'node setup.js' first."
    exit 1
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start development server
echo "🌟 Starting development server..."
npm run dev
