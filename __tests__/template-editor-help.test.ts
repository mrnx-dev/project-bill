import { EDITOR_HELP_LINES } from "@/lib/contract-template";

test("help covers placeholders, the item table, unknown tokens, auto-parts and the freeze", () => {
  expect(EDITOR_HELP_LINES).toHaveLength(5);
  expect(EDITOR_HELP_LINES.join(" ")).toContain("{{lingkup.tabel}}");
  expect(EDITOR_HELP_LINES.join(" ")).toMatch(/as-is|apa adanya/);
  expect(EDITOR_HELP_LINES.join(" ")).toMatch(/sign|tanda tangan|TTD/i);
});
