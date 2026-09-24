import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectInText,
  proposeRedactions,
  matchesToDetections,
  pickReplacement,
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
});

describe("international replacements", () => {
  it("picks stable international personas", () => {
    const a = pickReplacement(defaultPolicy, "person_name", "John Smith");
    const b = pickReplacement(defaultPolicy, "person_name", "John Smith");
    assert.equal(a, b);
    const allowed = [
      "Amara Okafor",
      "Yuki Tanaka",
      "Sofía Mendoza",
      "Lars Nielsen",
      "Priya Sharma",
      "Chen Wei",
      "Fatima Al-Hassan",
      "Nina Petrović",
      "Mateo Rossi",
      "Aisha Diallo",
    ];
    assert.ok(a && allowed.includes(a));
  });

  it("uses international phone formats", () => {
    const phone = pickReplacement(defaultPolicy, "phone", "+1 415 555 0100");
    assert.ok(phone?.startsWith("+"));
    assert.notEqual(phone, "+1 415 555 0100");
  });
});

describe("propose + verify", () => {
  it("proposes replace_text for emails and redact for secrets", () => {
    const text = "hello jane.doe@corp.com key AKIAIOSFODNN7EXAMPLE";
    const detections = matchesToDetections(
      detectInText(text),
      "shot.png",
      defaultPolicy,
    );
    const proposals = proposeRedactions(detections, defaultPolicy);
    const email = proposals.find((p) => p.detection.category === "email");
    const key = proposals.find((p) => p.detection.category === "api_key");
    assert.equal(email?.action, "replace_text");
    assert.ok(email?.replacement?.includes("@example."));
    assert.equal(key?.action, "redact_block");
    assert.equal(key?.replacement, null);
  });

  it("verifyTextClean reports residual hits", () => {
    const dirty = verifyTextClean("leak me@secret.io");
    assert.ok(dirty.length > 0);
    const clean = verifyTextClean("Welcome to the docs");
    assert.equal(clean.length, 0);
  });
});
