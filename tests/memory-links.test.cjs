/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const ts = require("typescript");
const test = require("node:test");
const assert = require("node:assert/strict");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { addMemoryLink, memoryUrl } = require("../lib/memory-links.ts");
const walks = [{ id: 42, url: "https://www.are.na/block/42" }, { id: 421, url: "https://www.are.na/block/421" }];
test("match old story lines exactly and only for the signed-in user", () => {
  const links = {};
  addMemoryLink(links, walks, "me", "other", { userId: "other", story: "Are.na: https://www.are.na/block/42" });
  addMemoryLink(links, walks, "me", "one", { userId: "me", story: "Walking Score\r\nAre.na: https://www.are.na/block/421\r\n" });
  addMemoryLink(links, walks, "me", "two", { userId: "me", story: "Are.na: https://www.are.na/block/42" });
  addMemoryLink(links, walks, "me", "two", { userId: "me", story: "Are.na: https://www.are.na/block/42" });
  assert.deepEqual(links, { 42: ["two"], 421: ["one"] });
});
test("new explicit link survives edits to story; duplicates have distinct links", () => {
  const links = {};
  addMemoryLink(links, walks, "me", "a", { userId: "me", story: "edited", walkingScoreUrl: walks[0].url });
  addMemoryLink(links, walks, "me", "b", { userId: "me", walkingScoreUrl: walks[0].url });
  assert.deepEqual(links[42], ["a", "b"]);
  assert.equal(memoryUrl("a/b"), "https://zofovn.vercel.app/#home?memory=a%2Fb");
});
