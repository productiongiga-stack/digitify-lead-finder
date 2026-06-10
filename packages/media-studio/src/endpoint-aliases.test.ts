import { describe, expect, it } from "vitest";
import { resolveMuapiEndpoint } from "./endpoint-aliases";

describe("resolveMuapiEndpoint", () => {
  it("maps legacy MuAPI endpoints to current API paths", () => {
    expect(resolveMuapiEndpoint("flux-dev")).toBe("flux-dev-image");
    expect(resolveMuapiEndpoint("flux-schnell")).toBe("flux-schnell-image");
    expect(resolveMuapiEndpoint("sd-2-vip-omni-reference")).toBe("seedance-2-vip-omni-reference");
  });

  it("keeps already-valid endpoints unchanged", () => {
    expect(resolveMuapiEndpoint("flux-2-dev")).toBe("flux-2-dev");
    expect(resolveMuapiEndpoint("nano-banana-2")).toBe("nano-banana-2");
  });
});
