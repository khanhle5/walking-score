/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader for TypeScript tests. */
// Load the existing TypeScript modules without a separate test dependency.
const fs = require("node:fs");
const ts = require("typescript");
const test = require("node:test");
const assert = require("node:assert/strict");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};
const { fetchWalks, getWalk } = require("../lib/walks.ts");

const walk = {
  id: 42,
  title: "Walk",
  metadata: { app: "walk-as-score", points_chunks: 1, points_0: "??", times_chunks: 1, times_0: "?", walker: "walker" },
};

test("gallery and detail respect viewer permissions and never cache private responses", async (t) => {
  const originalFetch = global.fetch;
  const originalChannel = process.env.ARENA_WALKS_CHANNEL;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalChannel === undefined) delete process.env.ARENA_WALKS_CHANNEL;
    else process.env.ARENA_WALKS_CHANNEL = originalChannel;
  });
  process.env.ARENA_WALKS_CHANNEL = "private-channel";
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    const auth = options.headers.Authorization;
    if (auth !== "Bearer owner-token") {
      return new Response("Unauthorized", { status: 401 });
    }
    return Response.json(url.includes("/contents?") ? { data: [walk, { id: 43, metadata: null }] } : walk);
  };

  await assert.rejects(fetchWalks(null), /401/);
  await assert.rejects(fetchWalks("other-token"), /401/);
  const results = await fetchWalks("owner-token");
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 42);
  assert.equal(results[0].points, "??");
  assert.equal(results[0].times, "?");
  assert.equal((await getWalk(42, "owner-token")).id, 42);
  assert.equal(await getWalk(42, null), null);
  for (const request of requests) assert.equal(request.options.cache, "no-store");
  assert.equal(requests[0].options.headers.Authorization, undefined);
  assert.equal(requests[2].options.headers.Authorization, "Bearer owner-token");
});

test("public gallery still works without a token", async (t) => {
  const originalFetch = global.fetch;
  const originalChannel = process.env.ARENA_WALKS_CHANNEL;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalChannel === undefined) delete process.env.ARENA_WALKS_CHANNEL;
    else process.env.ARENA_WALKS_CHANNEL = originalChannel;
  });
  process.env.ARENA_WALKS_CHANNEL = "public-channel";
  global.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.cache, "no-store");
    return Response.json({ data: [walk] });
  };
  assert.equal((await fetchWalks(null))[0].id, 42);
});
