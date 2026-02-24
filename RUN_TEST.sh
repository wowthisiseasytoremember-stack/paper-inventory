#!/bin/bash

# Complete end-to-end test script
cd "C:/Users/wowth/Documents/projects/paper-inventory"

echo "🧪 STARTING FULL END-TO-END TEST"
echo "================================="

# Load env
set -a
source .env.local
set +a

echo ""
echo "Step 1: Cleaning up old processes and database..."
rm -f data/dev.db data/dev.db-wal data/dev.db-shm
sleep 1

echo "✅ Ready to start"
echo ""
echo "IMPORTANT: Run these in separate terminals:"
echo ""
echo "Terminal 1:"
echo "  npm run dev"
echo ""
echo "Terminal 2:"
echo "  npx ts-node scripts/start-worker.ts"
echo ""
echo "Terminal 3 (after both are running):"
echo "  bash RUN_UPLOAD_TEST.sh"
echo ""
