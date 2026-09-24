import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectInText,
  proposeRedactions,
  matchesToDetections,
  defaultPolicy,
  verifyTextClean,
} from "../dist/index.js";

describe("detectInText", () => {
  it("finds email, phone, ip, jwt, aws key", () => {
    const sample = [
      "User: amara@lagos-corp.ng",
      "Call +44 7700 900999",
      "IP 10.12.34.56",
      "Key AKIAIOSFODNN7EXAMPLE",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturepartgoeshere1",
    ].join("\n");

    const hits = detectInText(sample);
    const cats = new Set(hits.map((h) => h.category));
    assert.ok(cats.has("email"));
    assert.ok(cats.has("phone"));
    assert.ok(cats.has("ip"));
    assert.ok(cats.has("api_key"));
    assert.ok(cats.has("token"));
  });

  it("flags url secrets", () => {
    const hits = detectInText(
      "https://api.example.com/v1?access_token=supersecretvalue123",
    );
    assert.ok(hits.some((h) => h.category === "url_secret"));
  });

  it("finds labeled and bare person names", () => {
    const labeled = detectInText("Signed in as: Jane Smith\nRole: Admin");
    assert.ok(
      labeled.some(
        (h) => h.category === "person_name" && h.text === "Jane Smith",
      ),
      JSON.stringify(labeled),
    );

    const bare = detectInText("Assigned to Priya Sharma for review");
    assert.ok(
      bare.some(
        (h) => h.category === "person_name" && h.text.includes("Priya"),
      ),
      JSON.stringify(bare),
    );

    const chrome = detectInText("Acme Console\nAPI Key settings");
    assert.ok(!chrome.some((h) => h.category === "person_name"));
  });
});

describe("blur-only policy", () => {
  it("defaults every category to blur", () => {
    for (const rule of Object.values(defaultPolicy.categories)) {
      assert.equal(rule.action, "blur");
    }
  });

  it("proposes blur for emails and secrets", () => {
    const text = "hello jane.doe@corp.com key AKIAIOSFODNN7EXAMPLE";
    const detections = matchesToDetections(
      detectInText(text),
      "shot.png",
      defaultPolicy,
    );
    const proposals = proposeRedactions(detections, defaultPolicy);
    assert.ok(proposals.length >= 2);
    for (const p of proposals) {
      assert.equal(p.action, "blur");
      assert.equal(p.replacement, null);
    }
  });

  it("verifyTextClean reports residual hits", () => {
    const dirty = verifyTextClean("leak me@secret.io");
    assert.ok(dirty.length > 0);
    const clean = verifyTextClean("Welcome to the docs");
    assert.equal(clean.length, 0);
  });
});
