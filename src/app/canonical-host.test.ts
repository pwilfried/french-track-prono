import { describe, expect, it } from "vitest";

import { canonicalUrl } from "./canonical-host";

const site = "https://www.frenchtrackprono.com";
const at = (address: string) => new URL(address);

describe("canonicalUrl", () => {
  it("sends the production Vercel address to the same page on the site address", () => {
    const target = canonicalUrl(
      at("https://french-track-prono.vercel.app/connexion?next=%2Fligues"),
      site,
      "production",
    );

    expect(target?.href).toBe("https://www.frenchtrackprono.com/connexion?next=%2Fligues");
  });

  it("leaves the site address alone", () => {
    expect(canonicalUrl(at(`${site}/connexion`), site, "production")).toBeNull();
  });

  it("leaves pre-production alone, whose site address is its Vercel one", () => {
    const preprod = "https://french-track-preprod.vercel.app";

    expect(canonicalUrl(at(`${preprod}/connexion`), preprod, "production")).toBeNull();
  });

  it("leaves preview deploys and local runs alone", () => {
    const preview = at("https://french-track-prono-git-fix-1.vercel.app/");

    expect(canonicalUrl(preview, site, "preview")).toBeNull();
    expect(canonicalUrl(preview, site, undefined)).toBeNull();
    expect(canonicalUrl(at("http://localhost:3000/"), site, "production")).toBeNull();
  });

  it("does nothing without a valid site address", () => {
    const vercel = at("https://french-track-prono.vercel.app/");

    expect(canonicalUrl(vercel, undefined, "production")).toBeNull();
    expect(canonicalUrl(vercel, "not a url", "production")).toBeNull();
  });
});
