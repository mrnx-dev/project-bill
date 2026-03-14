import { generateSowPdfBuffer } from "./src/lib/pdf-generator";
async function run() {
  try {
    console.log("Generating PDF...");
    const buf = await generateSowPdfBuffer("test-123");
    console.log("Success! Buf size:", buf.length);
  } catch (err) {
    console.error("FAIL:", err);
  }
}
run();
