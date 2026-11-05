import { insertPlaceholder } from "@/components/placeholder-palette";

test("inserts at the caret and leaves the caret after the token", () => {
  const r = insertPlaceholder("Halo , apa kabar", "{{client.name}}", 5, 5);
  expect(r.value).toBe("Halo {{client.name}}, apa kabar");
  expect(r.caret).toBe(20); // start (5) + "{{client.name}}".length (15)
});

test("replaces the current selection", () => {
  const r = insertPlaceholder("Halo dunia", "{{client.name}}", 5, 10);
  expect(r.value).toBe("Halo {{client.name}}");
});

test("appends when the caret is unknown (-1)", () => {
  const r = insertPlaceholder("Baris", "{{total}}", -1, -1);
  expect(r.value).toBe("Baris{{total}}");
});
