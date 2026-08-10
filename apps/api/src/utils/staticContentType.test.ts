import { describe, expect, it } from "vitest";
import { getStaticContentType } from "./staticContentType.js";

describe("production static content types", () => {
  it("serves JavaScript modules with an executable MIME type", () => {
    expect(getStaticContentType("/assets/index-abc123.js")).toBe("application/javascript; charset=utf-8");
    expect(getStaticContentType("/assets/pdf.worker.min-abc123.mjs")).toBe("application/javascript; charset=utf-8");
  });

  it("serves WebAssembly assets used by browser libraries with their standard MIME type", () => {
    expect(getStaticContentType("/assets/decoder-abc123.wasm")).toBe("application/wasm");
  });
});
