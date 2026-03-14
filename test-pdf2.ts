import { generateSowPdfBuffer } from "./src/lib/pdf-generator";
async function run() {
  process.env.APP_URL = "http://localhost:3000";
  try {
    console.log("Generating...");
    const buf = await generateSowPdfBuffer("test-123");
    console.log("Success");
  } catch(e) { console.error("ERR:", e); }
}
run();
