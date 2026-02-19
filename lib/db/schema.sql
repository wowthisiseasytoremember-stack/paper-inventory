-- Hardened SQLite Schema

-- Enforce Foreign Keys
PRAGMA foreign_keys = ON;

-- Items Table: The Core State Machine
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    
    -- State Machine
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'processing_ocr', 'ocr_complete', 'processing_resize', 'resize_complete', 'processing_ai', 'complete', 'error')),
    processingLock INTEGER DEFAULT 0, -- Boolean using 0/1
    retryCount INTEGER DEFAULT 0,
    watchdogLockedAt DATETIME, -- For timeout detection
    errorMessage TEXT,

    -- Identification & Search
    title TEXT,
    guessedId TEXT,
    rawOcr TEXT,
    cleanedTranscription TEXT,
    confidence REAL,
    identifiedNames TEXT, -- JSON Array
    historicalContext TEXT,
    collectorSignificance TEXT,
    aiRawResponse TEXT,

    -- Deduplication & Integrity
    originalHash TEXT, -- Pre-strip
    contentHash TEXT UNIQUE, -- Post-strip/normalization
    originalFilename TEXT,
    mimeType TEXT,
    fileSize INTEGER,
    ocrLanguage TEXT DEFAULT 'eng',
    tags TEXT DEFAULT '[]', -- JSON Array
    version INTEGER DEFAULT 1,

    -- Storage Paths
    originalImagePath TEXT,
    resizedImagePath TEXT,
    thumbnailPath TEXT,

    -- Observability & Metrics
    ocrDurationMs INTEGER,
    resizeDurationMs INTEGER,
    aiDurationMs INTEGER,
    totalProcessingMs INTEGER,

    -- Timestamps
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    processedAt DATETIME,
    deletedAt DATETIME -- Soft delete
);

-- Indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_processingLock ON items(processingLock);
CREATE INDEX IF NOT EXISTS idx_items_contentHash ON items(contentHash);
CREATE INDEX IF NOT EXISTS idx_items_createdAt ON items(createdAt);

-- FTS5 Virtual Table for Full-Text Search
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
    title, 
    cleanedTranscription, 
    identifiedNames, 
    content='items', 
    content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, title, cleanedTranscription, identifiedNames) 
  VALUES (new.rowid, new.title, new.cleanedTranscription, new.identifiedNames);
END;

CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, title, cleanedTranscription, identifiedNames) 
  VALUES('delete', old.rowid, old.title, old.cleanedTranscription, old.identifiedNames);
END;

CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, title, cleanedTranscription, identifiedNames) 
  VALUES('delete', old.rowid, old.title, old.cleanedTranscription, old.identifiedNames);
  INSERT INTO items_fts(rowid, title, cleanedTranscription, identifiedNames) 
  VALUES (new.rowid, new.title, new.cleanedTranscription, new.identifiedNames);
END;
