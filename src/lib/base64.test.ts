import { describe, it, expect } from "vitest";
import { utf8ToBase64, base64ToUtf8 } from "./base64";

describe("base64", () => {
  it("round-trips ASCII text", () => {
    expect(base64ToUtf8(utf8ToBase64("hello world"))).toBe("hello world");
  });

  it("round-trips UTF-8 text with non-ASCII characters", () => {
    const text = "Café ₹500 – 日本語";
    expect(base64ToUtf8(utf8ToBase64(text))).toBe(text);
  });

  it("handles base64 content with embedded newlines (as GitHub's API returns it)", () => {
    const encoded = utf8ToBase64("line one\nline two");
    const withNewlines = encoded.match(/.{1,4}/g)!.join("\n");
    expect(base64ToUtf8(withNewlines)).toBe("line one\nline two");
  });
});
