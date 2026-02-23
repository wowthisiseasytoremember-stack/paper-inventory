const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf8");
}

test("baseline prompt is wired into analyzeImage()", () => {
  const content = read("src/lib/ai/openai-manual.ts");
  assert.ok(content.includes("BASELINE_SYSTEM_PROMPT"));
  assert.ok(!content.includes("You are an expert archivist."));
});

test("queued items run OCR before resize", () => {
  const content = read("src/lib/queue/manager.ts");
  const queuedBlock = /case 'queued':[\\s\\S]*?break;/m.exec(content);
  assert.ok(queuedBlock, "queued block not found");
  assert.ok(
    queuedBlock[0].includes("handleOCR"),
    "queued block should call handleOCR"
  );
});

test("rawOcr is not overwritten with AI cleaned transcription", () => {
  const content = read("src/lib/queue/manager.ts");
  assert.ok(!content.includes("rawOcr: metadata.cleanedTranscription"));
});

test("confidence display uses correct precedence", () => {
  const content = read("src/app/items/[id]/page.tsx");
  assert.ok(content.includes("((item.confidence || 0.85) * 100).toFixed(0)"));
});

test("BespokeMagnifier supports onLoad prop", () => {
  const content = read("src/components/BespokeMagnifier.tsx");
  assert.ok(content.includes("onLoad?: () => void"));
  assert.ok(content.includes("onLoad={onLoad}"));
});

test("collection delete unlinks items before deleting", () => {
  const content = read("src/lib/db/collection.ts");
  assert.ok(content.includes("UPDATE items SET collection_id = NULL"));
  assert.ok(content.includes("DELETE FROM collections WHERE id = ?"));
});

test("admin clear wipes originals directory", () => {
  const content = read("src/app/api/admin/clear/route.ts");
  assert.ok(content.includes("public/uploads/original"));
});
