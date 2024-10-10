import { describe, expect, test } from "@jest/globals";
import { formatPageID } from "../sanitize";

describe("test formatPageID", () => {
  test.each([
    [
      "valid page id",
      "86143948-8fe1-884b-8328-84a78e41fd29",
      "86143948-8fe1-884b-8328-84a78e41fd29",
    ],
    [
      "valid page id (Big letters case)",
      "86143948-8FE1-884B-8328-84A78E41FD29",
      "86143948-8FE1-884B-8328-84A78E41FD29",
    ],
    [
      "no hyphen page id",
      "861439488fe1884b832884a78e41fd29",
      "86143948-8fe1-884b-8328-84a78e41fd29",
    ],
    [
      "page url",
      "https://www.notion.so/tut-cc/PPP-e26b4d8d1ad74275adcbb3dcfe9821bf?pvs=4",
      "e26b4d8d-1ad7-4275-adcb-b3dcfe9821bf",
    ],
  ])("Test valid values (%p): %p -> %p", (_, rawPageID, expected) => {
    expect(formatPageID(rawPageID)).toEqual({
      valid: true,
      result: expected,
    });
  });
  test.each([
    ["empty string", ""],
    ["deleted some hyphens", "861439488fe1-884b-8328-84a78e41fd29"],
    ["include dot", "8614394.8fe1884b832884a78e41fd29"],
    ["include under bar", "8614394_8fe1884b832884a78e41fd29"],
    ["include \\n", "8614394\n8fe1884b832884a78e41fd29"],
    ["include space", " 861439488fe1884b832884a78e41fd29"],
    ["include space", "8614394 8fe1884b832884a78e41fd29"],
  ])("Test invalid values (%p): %p -> invalid", (_, rawPageID) => {
    expect(formatPageID(rawPageID)).toEqual({
      valid: false,
      result: "Invalid format.",
    });
  });
});
