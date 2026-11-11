/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader for TypeScript tests. */
const fs = require("node:fs");
const ts = require("typescript");
const test = require("node:test");
const assert = require("node:assert/strict");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  module._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { memoryFields, parseMemoryLocation } = require("../lib/memory.ts");
const walk = {
  id: 42, title: "Đi bộ 🌿 (51m)", startedAt: "2026-11-10T10:00:00Z",
  distanceM: 51, durationS: 90, url: "https://www.are.na/block/42",
  walker: "walker", points: "??", times: "?",
};

test("manual coordinates are validated, including zero and range boundaries", () => {
  assert.deepEqual(parseMemoryLocation(" 0 ", "-180", " Place "), { lat: 0, lng: -180, name: "Place" });
  assert.deepEqual(parseMemoryLocation("90", "180", "North"), { lat: 90, lng: 180, name: "North" });
  for (const args of [["", "1", "place"], ["0", "", "place"], ["1", "2", " "], ["91", "0", "place"], ["0", "-181", "place"], ["NaN", "1", "place"]]) {
    assert.throws(() => parseMemoryLocation(...args));
  }
});

test("memory uses exact walk title and only manually chosen coordinates", () => {
  const location = parseMemoryLocation("10.5", "106.5", "Chosen place");
  const doc = memoryFields(walk, location, "data:image/png;base64,abc", "firebase-user");
  assert.equal(doc.title, walk.title);
  assert.deepEqual(doc.location, { lat: 10.5, lng: 106.5, name: "Chosen place" });
  assert.match(doc.story, /51 m/);
  assert.match(doc.story, /1:30/);
  assert.match(doc.story, /https:\/\/www.are.na\/block\/42/);
  assert.equal(doc.imageType, "photo");
  assert.equal(doc.userId, "firebase-user");
  assert.equal(doc.walkingScoreUrl, walk.url);
  assert(doc.createdAt instanceof Date);
  assert.equal("points" in doc, false);
  assert.equal("times" in doc, false);
});

test("untitled walks get a meaningful fallback", () => {
  const doc = memoryFields({ ...walk, title: "   " }, { lat: 1, lng: 2, name: "Place" }, "image", "user");
  assert.equal(doc.title, "Walk — 2026-11-10");
});
