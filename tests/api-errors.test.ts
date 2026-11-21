import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiRequest } from "../client/src/lib/queryClient";
import { translateError } from "../client/src/lib/i18n";

// Stand-in for the network: the server's real JSON error shape.
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const respondWith = (status: number, body: unknown) => {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  })) as typeof fetch;
};

test("an API error is thrown with the translated text, not the server's English", async () => {
  respondWith(401, { message: "Invalid credentials", code: "invalid_credentials" });
  await assert.rejects(apiRequest("POST", "/api/auth/login", {}), (e: Error) => {
    assert.equal(e.message, translateError({ code: "invalid_credentials" }, "az"));
    return true;
  });
});

test("a failed connection shows the network error in the chosen language", async () => {
  globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
  await assert.rejects(apiRequest("GET", "/api/auth/me"), (e: Error) => {
    assert.equal(e.message, translateError({ code: "network" }, "az"));
    return true;
  });
});

test("a too-large upload is refused with a translated message that states the limit", async () => {
  const { uploadMaterialFile, LEGACY_MAX_BYTES } = await import("../client/src/lib/upload");
  respondWith(200, { enabled: false });
  const big = new File([new Uint8Array(LEGACY_MAX_BYTES + 1)], "big.pdf", { type: "application/pdf" });
  await assert.rejects(uploadMaterialFile(big), (e: Error) => {
    assert.equal(e.message, translateError({ code: "file_too_large", params: { max: "3" } }, "az"));
    return true;
  });
});
