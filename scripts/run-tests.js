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
    name: "centralized model aliases are present",
    run() {
      const content = read("src/lib/ai/config.ts");
      assert(content.includes("CONDUCTOR"), "CONDUCTOR alias missing");
      assert(content.includes("EXPERT"), "EXPERT alias missing");
      assert(content.includes("VALUATOR"), "VALUATOR alias missing");
    }
  },
  {
    name: "conductor uses multimodal input",
    run() {
      const content = read("src/lib/ai/conductor.ts");
      assert(content.includes("imageBase64?: string"), "Multimodal support missing in signature");
      assert(content.includes("inline_data") || content.includes("type: 'image'"), "Image data not handled in request");
    }
  },
  {
    name: "perplexity research step is wired into scheduler",
    run() {
      const content = read("src/lib/scheduler.ts");
      assert(content.includes("runPerplexityResearcher"), "Perplexity step missing from scheduler");
      assert(content.includes("conductorResult.basic_id"), "Basic ID not passed to researcher");
    }
  },
  {
    name: "ui uses centralized item store",
    run() {
      const content = read("src/app/page.tsx");
      assert(content.includes("useItemStore"), "Dashboard not using Zustand store");
      assert(!content.includes("useState<Item[]>([] )"), "Dashboard still using local item state");
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
  },

  // --- Bug fix tests ---

  {
    name: "scheduler does not import from deleted expert.ts",
    run() {
      const content = read("src/lib/scheduler.ts");
      assert(
        !content.includes("from './ai/expert'") && !content.includes('from "./ai/expert"'),
        "scheduler still imports runExpert from deleted expert.ts — remove the import"
      );
    }
  },
  {
    name: "pipeline fields are persisted after OCR (rawOcr, confidence, thumbnailPath)",
    run() {
      const items = read("src/lib/db/items.ts");
      // updateMetadata's EDITABLE list must include the pipeline fields the scheduler writes,
      // OR there must be a dedicated updatePipelineData method.
      const editableMatch = items.match(/const EDITABLE\s*=\s*\[([^\]]+)\]/);
      const hasPipelineMethod = items.includes("updatePipelineData");
      if (!hasPipelineMethod) {
        assert(editableMatch, "Could not find EDITABLE list in updateMetadata");
        const editable = editableMatch[1];
        assert(
          editable.includes("rawOcr"),
          "rawOcr missing from EDITABLE whitelist — OCR text is silently dropped. Add it or use updatePipelineData."
        );
        assert(
          editable.includes("thumbnailPath"),
          "thumbnailPath missing from EDITABLE whitelist — resize results silently dropped."
        );
        assert(
          editable.includes("resizedImagePath"),
          "resizedImagePath missing from EDITABLE whitelist — resize results silently dropped."
        );
      }
    }
  },
  {
    name: "scheduler does not stall after queued-to-processing_ocr transition",
    run() {
      const content = read("src/lib/scheduler.ts");
      // Extract only the 'queued' if-block (up to its closing return).
      // The stall: queued block sets processing_ocr then returns without running OCR.
      // After fix: queued block must call performCloudVisionOCR before any return.
      const queuedBlockMatch = content.match(/if \(item\.status === 'queued'\)([\s\S]*?)(?=\n\s*if \(item\.status ===)/);
      if (queuedBlockMatch) {
        const queuedBlock = queuedBlockMatch[1];
        const returnsWithoutOcr = queuedBlock.includes("return") && !queuedBlock.includes("performCloudVisionOCR");
        assert(
          !returnsWithoutOcr,
          "queued block returns before calling performCloudVisionOCR — item stalls with processingLock=1 and status=processing_ocr until watchdog fires"
        );
      }
    }
  },
  {
    name: "Conductor uses a valid Gemini model name",
    run() {
      const content = read("src/lib/ai/config.ts");
      assert(
        !content.includes("gemini-3-flash-preview"),
        "gemini-3-flash-preview is not a valid Gemini API model — use gemini-2.0-flash or similar"
      );
      assert(
        !content.includes("gemini-3.1-pro-preview"),
        "gemini-3.1-pro-preview is not a valid Gemini API model"
      );
    }
  },
  {
    name: "crash recovery requeues processing_ai items instead of erroring them",
    run() {
      const content = read("src/lib/db/items.ts");
      // resetLocks currently sets ALL locked items to 'error' with a single UPDATE.
      // After fix: processing_ai items should be reset to 'resize_complete' so they
      // can be retried. This requires either a CASE expression or a separate UPDATE.
      // Extract just the resetLocks method body
      const resetLocksMatch = content.match(/resetLocks[^(]*\([^)]*\)[^{]*\{([\s\S]*?)\},\s*\n/);
      const resetBody = resetLocksMatch ? resetLocksMatch[1] : content;
      const blindlyErrorsAll = resetBody.includes("status = 'error'") && !resetBody.includes("CASE");
      assert(
        !blindlyErrorsAll,
        "resetLocks() blindly sets ALL locked items to error — processing_ai items should be reset to resize_complete for retry, not discarded"
      );
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
