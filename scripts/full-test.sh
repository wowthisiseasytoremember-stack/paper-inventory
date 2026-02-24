#!/bin/bash
echo "🚀 Starting full pipeline test..."
cd "C:/Users/wowth/Documents/projects/paper-inventory"

# Set environment
set -a
source .env.local
set +a

echo "📁 Creating data directories..."
mkdir -p data/logs data/resized data/uploads

echo "✅ Environment loaded"
echo "🏁 Ready to start services..."
echo ""
echo "To complete the test:"
echo "1. In Terminal A: npm run dev"
echo "2. In Terminal B: npx ts-node scripts/start-worker.ts"
echo "3. Then run: curl -F \"file=@C:/Users/wowth/Downloads/Photos-1-001/20260117_202149.jpg\" http://localhost:3000/api/upload"
