import { describe, expect, it } from "vitest";
import { partitionFrameOptions } from "../src/pipeline-compose.js";

describe("partitionFrameOptions", () => {
  it("routes keys by feeder and terminal mutable name lists", () => {
    const { feederOpts, terminalOpts } = partitionFrameOptions(
      { speed: 2, threshold: 0.5, extra: 1 },
      ["speed"],
      ["threshold"],
    );
    expect(feederOpts).toEqual({ speed: 2 });
    expect(terminalOpts).toEqual({ threshold: 0.5, extra: 1 });
  });
});
