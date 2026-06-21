import { describe, expect, it } from "vitest";
import { omitUndefinedValues } from "@/lib/firestorePayload";

describe("omitUndefinedValues", () => {
  it("removes undefined optional fields before Firestore writes", () => {
    const payload = omitUndefinedValues({
      legalName: "Meza",
      logoUrl: undefined,
      city: "Dili",
      nested: {
        businessSectorOther: undefined,
        workLocations: [
          {
            id: "hq",
            name: "HQ",
            managerId: undefined,
          },
        ],
      },
    });

    expect(payload).toEqual({
      legalName: "Meza",
      city: "Dili",
      nested: {
        workLocations: [
          {
            id: "hq",
            name: "HQ",
          },
        ],
      },
    });
  });
});
