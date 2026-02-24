# 🚀 Paper Inventory - Quick Start Guide

## TODAY: Get Your Comics Organized

### Prerequisites Checklist
- ✅ Node.js installed
- ✅ npm packages installed: `npm install`
- ✅ Environment variables in `.env.local`
- ✅ Google Cloud Vision credentials downloaded

### 3-Step Process to Organize Your Comics

#### Step 1: Start the Dev Server
```bash
cd C:/Users/wowth/Documents/projects/paper-inventory
npm run dev
```
Expected: Server starts on http://localhost:3000

#### Step 2: Start the Background Worker (NEW TERMINAL)
```bash
cd C:/Users/wowth/Documents/projects/paper-inventory
npx ts-node scripts/start-worker.ts
```
Expected: Worker logs "🚀 Starting background worker..."

#### Step 3: Upload Your Comics

**Option A: Via curl (4 images at once)**
```bash
curl -F "file=@C:/Users/wowth/Downloads/Photos-1-001/20260117_202149.jpg" http://localhost:3000/api/upload
curl -F "file=@C:/Users/wowth/Downloads/Photos-1-001/20260117_202152.jpg" http://localhost:3000/api/upload
curl -F "file=@C:/Users/wowth/Downloads/Photos-1-001/20260117_202141.jpg" http://localhost:3000/api/upload
curl -F "file=@C:/Users/wowth/Downloads/Photos-1-001/20260117_202145.jpg" http://localhost:3000/api/upload
```

**Option B: Via Web UI**
- Go to http://localhost:3000
- Click upload button
- Select images

### What Happens Next (Automatic)

Each image will process through this pipeline:

1. **Resize** (300px thumb + 1024px web version with Sharp)
2. **OCR** (Text extraction with Google Cloud Vision + web entity detection)
3. **Research** (Gemini searches web for context/market data)
4. **Categorize** (Conductor AI detects: comic_books, railroadiana, etc.)
5. **Extract** (Expert AI extracts title, condition, significance, value signals)
6. **Store** (Results saved to database with full analysis history)

**Time per image: ~30-45 seconds** (depends on API latency)

### Monitor Progress

**In Worker Terminal (Step 2):**
You'll see logs like:
```
[Scheduler] uuid-here: resize complete
[Scheduler] uuid-here: OCR complete (confidence: 95.3%)
[Scheduler] uuid-here: Conductor categorized as "comic_books" (confidence: 0.98)
[Scheduler] uuid-here: Enrichment complete - "Black Widow #234"
```

### View Results

**Option A: Database Query**
```bash
sqlite3 data/dev.db
SELECT id, status, title, identifiedNames, analysis_history FROM items ORDER BY createdAt DESC LIMIT 4;
```

**Option B: Web UI**
Go to http://localhost:3000 to see your organized comics

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "GCV quota exceeded" | Wait 24 hours or upgrade GCP project |
| "database is locked" | Kill dev server, wait 2s, restart |
| No results after 2 min | Check Worker terminal for error logs |
| Images not uploading | Verify Ctrl+C didn't kill dev server |

### Environment Variables Required

Make sure `.env.local` has:
```
GOOGLE_APPLICATION_CREDENTIALS="C:\Users\wowth\Documents\projects\paper-inventory\paper-inventory-488411-4f90bf2f1afc.json"
GOOGLE_CLOUD_PROJECT="paper-inventory-488411"
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

---

**Ready? Start with Step 1 above!** 🎬
