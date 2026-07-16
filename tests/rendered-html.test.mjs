import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function renderApp() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the Mộc Đọc application", async () => {
  const response = await renderApp();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Mộc Đọc/);
  assert.match(html, /Trình đọc truyện TXT/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("local edition is a self-contained, private TXT reader", async () => {
  const html = await readFile(new URL("../local/index.html", import.meta.url), "utf8");
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /type="file"[^>]+accept="\.txt,text\/plain"/i);
  assert.match(html, /new TextDecoder\("windows-1258"\)/);
  assert.match(html, /file\.arrayBuffer\(\)/);
  assert.match(html, /localStorage/);
  assert.match(html, /data-theme="paper"/);
  assert.match(html, /<option value="georgia">Georgia<\/option>/);
  assert.match(html, /<option value="palatino">Palatino<\/option>/);
  assert.match(html, /<option value="times">Times New Roman<\/option>/);
  assert.match(html, /<option value="segoe">Segoe UI<\/option>/);
  assert.match(html, /<option value="arial">Arial<\/option>/);
  assert.match(html, /Nội dung được xử lý trên thiết bị này/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=["']https?:/i);
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|WebSocket/);
});
