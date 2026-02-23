const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const tests = [
  {
    name: "baseline prompt is wired into analyzeImage()",
    run() {
      const content = read("src/lib/ai/openai-manual.ts");
      assert(content.includes("BASELINE_SYSTEM_PROMPT"), "BASELINE_SYSTEM_PROMPT missing");
      assert(!content.includes("You are an expert archivist."), "old inline prompt still present");
    }
  },
  {
    name: "queued items run OCR before resize",
    run() {
      const content = read("src/lib/queue/manager.ts");
      const match = /case 'queued':[\s\S]*?break;/m.exec(content);
      assert(match, "queued block not found");
      assert(match[0].includes("handleOCR"), "queued block should call handleOCR");
    }
  },
  {
    name: "rawOcr is not overwritten with AI cleaned transcription",
    run() {
      const content = read("src/lib/queue/manager.ts");
      assert(!content.includes("rawOcr: metadata.cleanedTranscription"), "rawOcr overwrite still present");
    }
  },
  {
    name: "confidence display uses correct precedence",
    run() {
      const content = read("src/app/items/[id]/page.tsx");
      assert(
        content.includes("((item.confidence || 0.85) * 100).toFixed(0)"),
        "confidence display precedence not fixed"
      );
    }
  },
  {
    name: "BespokeMagnifier supports onLoad prop",
    run() {
      const content = read("src/components/BespokeMagnifier.tsx");
      assert(content.includes("onLoad?: () => void"), "onLoad prop missing from interface");
      assert(content.includes("onLoad={onLoad}"), "onLoad prop not passed to img");
    }
  },
  {
    name: "collection delete unlinks items before deleting",
    run() {
      const content = read("src/lib/db/collection.ts");
      assert(content.includes("UPDATE items SET collection_id = NULL"), "unlink query missing");
      assert(content.includes("DELETE FROM collections WHERE id = ?"), "delete query missing");
    }
  },
  {
    name: "admin clear wipes originals directory",
    run() {
      const content = read("src/app/api/admin/clear/route.ts");
      assert(content.includes("public/uploads/original"), "originals directory not included");
    }
  }
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.run();
    console.log(`PASS ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL ${t.name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
