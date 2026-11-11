/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader for TypeScript tests. */
const fs = require("node:fs");
const ts = require("typescript");
const test = require("node:test");
const assert = require("node:assert/strict");
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { canonicalPoint, parsePlaceResults } = require("../lib/location-picker.ts");

test("map clicks normalize wrapped longitudes and reject invalid coordinates", () => {
  assert.deepEqual(canonicalPoint(10, 466), { lat: 10, lng: 106 });
  assert.deepEqual(canonicalPoint(0, -181), { lat: 0, lng: 179 });
  assert.equal(canonicalPoint(91, 0), null);
  assert.equal(canonicalPoint(NaN, 0), null);
});

test("search only accepts usable GeoJSON points with names", () => {
  assert.deepEqual(parsePlaceResults({ features: [
    { geometry: { coordinates: [106.7, 10.8] }, properties: { full_address: "  Airport  " } },
    { geometry: { coordinates: [0, 0] }, properties: { name: "Zero" } },
    { geometry: { coordinates: [0, 91] }, properties: { name: "Bad" } },
    { geometry: { coordinates: ["1", 2] }, properties: { name: "Bad" } },
    { geometry: { coordinates: [1, 2] }, properties: { name: " " } },
    null,
  ] }), [{ lat: 10.8, lng: 106.7, name: "Airport" }, { lat: 0, lng: 0, name: "Zero" }]);
  assert.deepEqual(parsePlaceResults(null), []);
});
