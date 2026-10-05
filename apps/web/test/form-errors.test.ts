import { describe, expect, it } from "vitest";
import { fieldErrors } from "../src/lib/form-errors";

describe("fieldErrors", () => {
  it("maps zod paths to fields and keeps other text", () => {
    expect(fieldErrors("bin: BIN is 12 digits; instrument.lab: at most 32 characters; Upload failed")).toEqual({
      fields: { bin: "BIN is 12 digits", lab: "at most 32 characters" },
      rest: "Upload failed",
    });
  });
});
