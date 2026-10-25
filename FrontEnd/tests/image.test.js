import test from "node:test";
import assert from "node:assert/strict";
import { imageThumbnail } from "../src/utils/image.js";

test("list photos request bounded 3x-resolution previews without changing the stored asset", () => {
  const original = "https://res.cloudinary.com/example/image/upload/v123/bengol_spices/agents/store.jpg";
  const preview = new URL(imageThumbnail(original));
  assert.equal(preview.hostname, "res.cloudinary.com");
  assert.match(preview.pathname, /c_fill,g_center,h_144,w_144\/f_auto\/q_auto\/v123\/bengol_spices\/agents\/store.jpg$/);
  assert.equal(imageThumbnail(preview.href), preview.href, "an already transformed URL is not transformed twice");
  assert.equal(original, "https://res.cloudinary.com/example/image/upload/v123/bengol_spices/agents/store.jpg");
});

test("signed, authenticated, existing transformations and external images keep their delivery contracts", () => {
  const unchanged = [
    "https://res.cloudinary.com/example/image/upload/s--signature--/v123/store.jpg",
    "https://res.cloudinary.com/example/image/upload/c_fill,w_80/v123/store.jpg",
    "https://res.cloudinary.com/example/image/upload/t_store_preview/v123/store.jpg",
    "https://res.cloudinary.com/example/image/upload/v123/store.jpg?__cld_token__=signed-token",
    "https://res.cloudinary.com/example/image/authenticated/v123/store.jpg",
    "https://res.cloudinary.com/example/raw/upload/v123/document.pdf",
    "https://res.cloudinary.com.example.invalid/example/image/upload/v123/store.jpg",
    "https://example.invalid/res.cloudinary.com/image/upload/store.jpg",
    "/images/store.png", "data:image/png;base64,fake", "blob:https://example.invalid/local", "", null, undefined,
  ];
  for (const source of unchanged) assert.equal(imageThumbnail(source), source);
});

test("thumbnail sizing stays bounded and supports the legacy versionless upload path", () => {
  const source = "https://res.cloudinary.com/example/image/upload/bengol_spices/agents/store.png";
  assert.match(imageThumbnail(source, 0), /h_144,w_144/);
  assert.match(imageThumbnail(source, 99999), /h_512,w_512/);
  assert.match(imageThumbnail(source, -10), /h_48,w_48/);
  assert.match(imageThumbnail(source, 96), /h_96,w_96/);
});
