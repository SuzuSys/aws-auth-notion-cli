import { describe, expect, test } from "@jest/globals";
import { formatPageID } from "../sanitize";

describe("test formatPageID", () => {
  test("valid values", () => {
    // valid page id
    expect(formatPageID("86143948-8fe1-884b-8328-84a78e41fd29")).toEqual({
      valid: true,
      result: "86143948-8fe1-884b-8328-84a78e41fd29",
    });
    // valid page id (big letter case)
    expect(formatPageID("86143948-8FE1-884B-8328-84A78E41FD29")).toEqual({
      valid: true,
      result: "86143948-8FE1-884B-8328-84A78E41FD29",
    });
    // no hyphen valid page id
    expect(formatPageID("861439488fe1884b832884a78e41fd29")).toEqual({
      valid: true,
      result: "86143948-8fe1-884b-8328-84a78e41fd29",
    });
    // valid page url
    expect(
      formatPageID(
        "https://www.notion.so/tut-cc/PPP-e26b4d8d1ad74275adcbb3dcfe9821bf?pvs=4"
      )
    ).toEqual({
      valid: true,
      result: "e26b4d8d-1ad7-4275-adcb-b3dcfe9821bf",
    });
  });
  test("invalid values", () => {
    const invalidResult = {
      valid: false,
      result: "Invalid format.",
    };
    // empty string
    expect(formatPageID("")).toEqual(invalidResult);
    // deleted some hyphen
    expect(formatPageID("861439488fe1-884b-8328-84a78e41fd29")).toEqual(
      invalidResult
    );
    // include dot (string length is valid)
    expect(formatPageID("8614394.8fe1884b832884a78e41fd29")).toEqual(
      invalidResult
    );
    // include under bar (string length is valid)
    expect(formatPageID("8614394_8fe1884b832884a78e41fd29")).toEqual(
      invalidResult
    );
    // include \n (string length is valid)
    expect(formatPageID("8614394\n8fe1884b832884a78e41fd29")).toEqual(
      invalidResult
    );
  });
});
