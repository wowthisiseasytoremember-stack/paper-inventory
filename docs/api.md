# Paper Inventory — API Reference

Base URL: `http://localhost:3000` (development)

All endpoints return JSON unless otherwise noted. Error responses follow the shape:
```json
{ "error": "Human-readable message", "details": "Optional error detail string" }
```

---

## Items

### List / Search Items

```
GET /api/items
```

Returns a paginated list of all inventory items. Supports full-text search via FTS5.

**Query Parameters**

| Parameter | Type    | Default | Description                                         |
|-----------|---------|---------|-----------------------------------------------------|
| `page`    | integer | `1`     | Page number (1-indexed)                             |
| `limit`   | integer | `50`    | Items per page                                      |
| `q`       | string  | `""`    | Full-text search query (searches title, transcription, names) |

**Response**

```json
{
  "data": [
    {
      "id": "uuid",
      "status": "complete",
      "title": "X-Force #1 — Marvel Comics — 1991",
      "valuation": "Low: $0.50 — High: $3 — Likely: $1",
      "tags": ["comic", "marvel", "1991"],
      "identifiedNames": [{"name": "Rob Liefeld", "type": "person", "confidence": 0.9}],
      "createdAt": "2026-02-20T10:00:00Z",
      "thumbnailPath": "/uploads/thumbnails/uuid.webp"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 423,
    "totalPages": 9
  }
}
```

**Status values:** `queued` | `processing_ocr` | `ocr_complete` | `processing_resize` | `resize_complete` | `processing_ai` | `complete` | `error`

---

### Get Item Detail

```
GET /api/items/:id
```

Returns full item data including all AI analysis fields.

**Response**

```json
{
  "id": "uuid",
  "status": "complete",
  "title": "string",
  "guessedId": "string",
  "rawOcr": "string",
  "cleanedTranscription": "string",
  "confidence": 0.92,
  "historicalContext": "string",
  "collectorSignificance": "string",
  "conditionNotes": "string",
  "valuation": "Low: $X — High: $Y — Likely: $Z",
  "ebayTitle": "string (max 80 chars)",
  "ebayDescription": "string",
  "ebayCategory": "string",
  "listingStrategy": "auction | buy-it-now | bundle",
  "suggestedPrice": "$X.XX",
  "tags": ["string"],
  "identifiedNames": [{"name": "string", "type": "person|business|location", "confidence": 0.0}],
  "verification_questions": ["string"],
  "analysis_history": [{"timestamp": "ISO", "prompt": "string", "valuation": "string"}],
  "lockedFields": ["title", "valuation"],
  "processingLock": false,
  "retryCount": 0,
  "errorMessage": null,
  "originalImagePath": "string",
  "resizedImagePath": "string",
  "thumbnailPath": "string",
  "mimeType": "image/webp",
  "fileSize": 1234567,
  "ocrDurationMs": 4200,
  "resizeDurationMs": 320,
  "aiDurationMs": 8900,
  "totalProcessingMs": 13420,
  "createdAt": "ISO",
  "processedAt": "ISO",
  "collection_id": "uuid | null"
}
```

**Status codes:** `200 OK` | `404 Not Found` | `500 Internal Server Error`

---

### Update Item Metadata

```
PATCH /api/items/:id
```

Updates user-editable fields. Fields that are edited are automatically added to `lockedFields` to prevent AI re-enrichment from overwriting user corrections.

**Request Body** (all fields optional)

```json
{
  "title": "string",
  "cleanedTranscription": "string",
  "historicalContext": "string",
  "collectorSignificance": "string",
  "valuation": "string",
  "tags": ["string"],
  "guessedId": "string",
  "identifiedNames": "json-string",
  "verification_questions": "json-string",
  "collection_id": "uuid | null"
}
```

**Response**

```json
{ "success": true, "changes": 1 }
```

**Status codes:** `200 OK` | `400 Bad Request (no valid fields)` | `404 Not Found` | `500 Internal Server Error`

---

### Get Item Image (Full Resolution)

```
GET /api/items/:id/image
```

Returns the resized image (WebP, max 1600px) as binary data with appropriate Content-Type header.

**Status codes:** `200 OK` | `404 Not Found`

---

### Get Item Thumbnail

```
GET /api/items/:id/thumbnail
```

Returns the thumbnail image (WebP, 400x400 cover crop) as binary data.

**Status codes:** `200 OK` | `404 Not Found`

---

### Retry Failed Item

```
POST /api/items/:id/retry
```

Resets a failed item (status=`error`) back to `queued` and triggers the processing queue. No request body required.

**Response**

```json
{ "success": true, "message": "Item queued for retry" }
```

**Status codes:** `200 OK` | `400 Bad Request (item not in error state)` | `404 Not Found`

---

### Trigger AI Enrichment (Deep Dive)

```
POST /api/items/:id/enrich
```

Manually triggers the full AI pipeline for an item. Supports model overrides for A/B testing. Results are logged to `item_enrichment_logs` and stored in `analysis_history`.

**Request Body** (all fields optional)

```json
{
  "baselineModel": "gemini-2.0-flash | gpt-4o-mini | claude-sonnet",
  "deepDiveModel": "gemini-2.5-flash | gpt-4o | claude-sonnet | perplexity | groq",
  "enableGrounding": true,
  "prompt": "Custom system prompt override string (optional)"
}
```

**Response**

```json
{
  "success": true,
  "category": "comics_1990s | drg_railroadiana | other",
  "groundingUsed": true,
  "item": { /* full item object */ }
}
```

**Status codes:** `200 OK` | `400 Bad Request` | `404 Not Found` | `500 Internal Server Error`

---

### Real-Time Event Stream (SSE)

```
GET /api/items/:id/events
```

Server-Sent Events stream for real-time processing updates. The stream polls the database every 1 second and emits two event types.

**Response Headers**

```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
```

**Event: `itemUpdate`**

Emitted on every poll (current item state):

```
event: itemUpdate
data: {"id":"uuid","status":"processing_ai","title":"...","confidence":0.9}

```

**Event: `logsUpdate`**

Emitted when new enrichment log entries appear:

```
event: logsUpdate
data: [{"event_type":"baseline_complete","model":"gemini-2.0-flash","payload":"{...}","timestamp":"ISO"}]

```

**Enrichment log `event_type` values:**
- `baseline_complete` — Initial AI identification finished
- `triage_complete` — Category classification finished
- `grounding_complete` — Google Search grounding finished
- `deep_dive_complete` — Full appraisal finished

**Usage (JavaScript)**

```javascript
const es = new EventSource(`/api/items/${itemId}/events`);
es.addEventListener('itemUpdate', (e) => {
  const item = JSON.parse(e.data);
  console.log('Status:', item.status);
});
es.addEventListener('logsUpdate', (e) => {
  const logs = JSON.parse(e.data);
  logs.forEach(log => console.log(log.event_type, log.model));
});
```

---

### Get Item Enrichment Logs

```
GET /api/items/:id/events
```

Note: The enrichment log history is embedded in the SSE stream on first connection. For a static fetch of all logs, use the item detail endpoint (`GET /api/items/:id`) and access the `analysis_history` field.

---

## Upload

### Upload Image

```
POST /api/upload
Content-Type: multipart/form-data
```

Accepts a single image file. Validates file size (max 25MB) and MIME type via magic bytes. Deduplicates by file metadata hash.

**Form Fields**

| Field  | Type | Required | Description                           |
|--------|------|----------|---------------------------------------|
| `file` | File | Yes      | Image file (JPEG, PNG, WebP, HEIC)   |

**Response (new item)**

```json
{
  "id": "uuid",
  "status": "queued",
  "message": "Upload successful, processing started."
}
```

**Response (duplicate)**

```json
{
  "id": "existing-uuid",
  "status": "duplicate",
  "message": "File already exists in inventory."
}
```

**Status codes:** `201 Created` | `200 OK (duplicate)` | `400 Bad Request` | `413 Payload Too Large` | `415 Unsupported Media Type` | `500 Internal Server Error`

---

## Collections

### List Collections

```
GET /api/collections
```

**Response**

```json
[
  {
    "id": "uuid",
    "name": "1990s Marvel Comics",
    "description": "string",
    "icon": "string",
    "createdAt": "ISO"
  }
]
```

---

### Create Collection

```
POST /api/collections
```

**Request Body**

```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "icon": "string (optional)"
}
```

**Response:** `201 Created` with the new collection object.

---

### Get Collection

```
GET /api/collections/:id
```

Returns collection metadata.

---

### Update Collection

```
PATCH /api/collections/:id
```

Updates `name`, `description`, or `icon`.

---

### Delete Collection

```
DELETE /api/collections/:id
```

Deletes the collection. Items assigned to this collection will have `collection_id` set to NULL.

---

### List Items in Collection

```
GET /api/collections/:id/items
```

Returns all non-deleted items assigned to this collection.

---

## System

### Health Check

```
GET /api/health
```

Returns `200 OK` with `{ "status": "ok" }` if the server is running and the database is reachable.

---

### Admin: Clear All Items

```
DELETE /api/admin/clear
```

**WARNING:** Permanently deletes all items and their associated data from the database. Requires the `x-admin-secret` header matching the `ADMIN_SECRET` environment variable.

**Request Headers**

```
x-admin-secret: your-admin-secret
```

**Response:** `200 OK` with `{ "success": true, "deleted": N }`.

---

## Available AI Models

| Short Name        | Provider    | Role          | Notes                              |
|-------------------|-------------|---------------|------------------------------------|
| `gemini-2.0-flash`| Google      | Baseline      | Default, fast, free tier available |
| `gemini-2.5-flash`| Google      | Deep Dive     | Default deep dive model            |
| `gpt-4o-mini`     | OpenAI      | Baseline      | Fallback                           |
| `gpt-4o`          | OpenAI      | Deep Dive     | Premium fallback                   |
| `claude-sonnet`   | Anthropic   | Both          | Premium, resolves to claude-sonnet-4-20250514 |
| `perplexity`      | Perplexity  | Deep Dive     | Web-search grounded (sonar model)  |
| `groq`            | Groq        | Deep Dive     | Text-only last resort (llama-3.3-70b) |
