import { insertPlaceholder } from "@/components/placeholder-palette";

test("inserts at the caret and leaves the caret after the token", () => {
  const r = insertPlaceholder("Halo , apa kabar", "{{klien.nama}}", 5, 5);
  expect(r.value).toBe("Halo {{klien.nama}}, apa kabar");
  expect(r.caret).toBe(19); // start (5) + token.length (14) — the brief's 21 was an arithmetic typo
});

test("replaces the current selection", () => {
  const r = insertPlaceholder("Halo dunia", "{{klien.nama}}", 5, 10);
  expect(r.value).toBe("Halo {{klien.nama}}");
});

test("appends when the caret is unknown (-1)", () => {
  const r = insertPlaceholder("Baris", "{{total}}", -1, -1);
  expect(r.value).toBe("Baris{{total}}");
});
