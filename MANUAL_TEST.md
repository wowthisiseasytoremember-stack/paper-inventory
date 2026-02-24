# Manual End-to-End Test Guide

## ✅ Pre-Test Verification
- Database schema is FIXED (statusUpdatedAt column added)
- TypeScript compiles with NO ERRORS
- All dependencies installed
- .env.local configured with GCP + Anthropic keys

## 🚀 Running the Test (3 Terminals)

### Terminal 1: Start Dev Server
```bash
cd C:/Users/wowth/Documents/projects/paper-inventory
npm run dev
```

**Expected output:**
```
ready - started server on 0.0.0.0:3000
(Compiled client and server successfully)
Database Schema Initialized Successfully.
```

**Status: ✅ READY when you see "GET /api/items 200"**

---

### Terminal 2: Start Background Worker
```bash
cd C:/Users/wowth/Documents/projects/paper-inventory
npx ts-node scripts/start-worker.ts
```

**Expected output:**
```
🚀 Starting background worker...
Press Ctrl+C to stop
```

**Status: ✅ READY**

---

### Terminal 3: Upload & Test Pipeline
Wait 3 seconds after Terminal 2 starts, then:

```bash
cd C:/Users/wowth/Documents/projects/paper-inventory

# Test 1: Verify server is live
curl http://localhost:3000/api/items

# Test 2: Upload first comic
curl -F "file=@C:/Users/wowth/Downloads/Photos-1-001/20260117_202149.jpg" http://localhost:3000/api/upload

# Expected response:
# {"id":"<uuid>","status":"queued","message":"Upload successful, processing started."}

# Copy the <uuid> from response
# Save it in a variable:
ITEM_ID="<paste-uuid-here>"

# Test 3: Check processing progress (run multiple times, 30-45 seconds)
curl http://localhost:3000/api/items/$ITEM_ID

# Watch Terminal 2 for:
# [Scheduler] <uuid>: resize complete
# [Scheduler] <uuid>: OCR complete (confidence: XX.X%)
# [Scheduler] <uuid>: Conductor categorized as "comic_books"
# [Scheduler] <uuid>: Enrichment complete

# Test 4: View results in browser
# http://localhost:3000
# Click on the comic card to see all extracted intelligence

# Test 5: Query database directly
sqlite3 data/dev.db "SELECT id, status, title FROM items ORDER BY createdAt DESC LIMIT 1;"
```

---

## 🎯 Success Criteria

**GREEN if you see:**

1. ✅ Terminal 1: Server starts without errors
2. ✅ Terminal 2: Worker starts and shows "Starting background worker"
3. ✅ Terminal 3: Upload returns `status: queued`
4. ✅ Terminal 2: Shows processing logs for resize, OCR, Conductor, Expert
5. ✅ Terminal 2: Final log shows "Enrichment complete" with title
6. ✅ http://localhost:3000 shows comic in grid
7. ✅ Comic detail page shows:
   - Category (e.g., "COMIC BOOKS")
   - Confidence score
   - Identified names
   - Condition issues
   - Value signals
   - eBay keywords
   - Historical context
   - Collector significance

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3000 already in use | `lsof -i :3000` then `kill -9 <PID>` |
| "no such column: statusUpdatedAt" | Database was deleted ✅ Run fresh |
| Worker not processing | Check Terminal 2 for errors |
| Upload returns 500 | Check Terminal 1 error logs |
| No analysis_history displayed | Item still processing, wait 45s |

---

## 📊 Expected Processing Time Per Image

- Resize: 2-3 seconds
- OCR (GCV): 8-12 seconds
- Research (Gemini): 5-8 seconds
- Categorization (Conductor): 3-5 seconds
- Extraction (Expert): 5-8 seconds

**Total: 30-45 seconds per image**

---

## ✅ When All Tests Pass

✨ Your comic collection is fully organized with:
- Automatic categorization
- Condition assessment
- Value indicators
- Searchable metadata
- Full analysis history

🎉 **System is PRODUCTION READY**
