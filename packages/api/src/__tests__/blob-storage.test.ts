import { afterEach, describe, expect, it } from "vitest";
import {
  blobConfigurationMessage,
  getBlobToken,
  isBlobConfigured,
  translateBlobError,
} from "../lib/blob-storage";

const originalPrivate = process.env.BLOB_READ_WRITE_TOKEN;
const originalPublic = process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;

afterEach(() => {
  if (originalPrivate === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalPrivate;
  if (originalPublic === undefined) delete process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;
  else process.env.BLOB_PUBLIC_READ_WRITE_TOKEN = originalPublic;
});

describe("blob storage configuration", () => {
  it("keeps private and public tokens separate", () => {
    process.env.BLOB_READ_WRITE_TOKEN = "private-token";
    process.env.BLOB_PUBLIC_READ_WRITE_TOKEN = "public-token";

    expect(getBlobToken("private")).toBe("private-token");
    expect(getBlobToken("public")).toBe("public-token");
    expect(isBlobConfigured("private")).toBe(true);
    expect(isBlobConfigured("public")).toBe(true);
  });

  it("translates a public-store/private-access mismatch", () => {
    const error = translateBlobError(
      new Error("Vercel Blob: Cannot use private access on a public store."),
      "private",
    );

    expect(error.message).toBe(blobConfigurationMessage("private"));
  });

  it("reports missing public storage without exposing a secret", () => {
    delete process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;
    expect(getBlobToken("public")).toBeUndefined();
    expect(blobConfigurationMessage("public")).toContain("Publieke media-opslag");
  });
});
