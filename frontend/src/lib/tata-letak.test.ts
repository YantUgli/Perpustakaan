import { describe, expect, it } from "vitest";

import { GUTTER_LG, GUTTER_LG_LAYAR, KONTAINER } from "./tata-letak";

describe("tata-letak: gutter satu sumber", () => {
  it("kelas lg:px KONTAINER sama dengan GUTTER_LG", () => {
    expect(KONTAINER).toContain(`lg:px-[${GUTTER_LG.replaceAll(" ", "_")}]`);
  });

  it("GUTTER_LG_LAYAR memakai 100vw, sisanya sama", () => {
    expect(GUTTER_LG_LAYAR).toBe("max(5.5vw,calc((100vw - var(--container-situs))/2))");
  });
});
