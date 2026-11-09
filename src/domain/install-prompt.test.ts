import { describe, expect, it } from "vitest";

import { installWay, shouldOfferInstall } from "./install-prompt";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,2; iOS 18_1; fr_FR; fr; scale=3.00; 1179x2556; 658245390)",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.107 Mobile Safari/537.36 Instagram 357.0.0.25.101 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 8; shiba; shiba; fr_FR; 658245390)",
  facebookIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.40.103;FBBV/650000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBCR/;FBID/phone;FBLC/fr_FR;FBOP/5]",
  tiktokAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.107 Mobile Safari/537.36 trill_370104 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/37.1.4 ByteLocale/fr ByteFullLocale/fr Region/FR BytedanceWebview/d8a21c6",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

describe("installWay", () => {
  it("guides iPhone players through the share menu, in Safari as in Chrome", () => {
    expect(installWay({ userAgent: UA.iphoneSafari, standalone: false })).toBe("ios");
    expect(installWay({ userAgent: UA.iphoneChrome, standalone: false })).toBe("ios");
  });

  it("sends players of an in-app browser to their real browser first", () => {
    expect(installWay({ userAgent: UA.instagramIos, standalone: false })).toBe("in-app");
    expect(installWay({ userAgent: UA.instagramAndroid, standalone: false })).toBe("in-app");
    expect(installWay({ userAgent: UA.facebookIos, standalone: false })).toBe("in-app");
    expect(installWay({ userAgent: UA.tiktokAndroid, standalone: false })).toBe("in-app");
  });

  it("leaves the other browsers to their own install prompt", () => {
    expect(installWay({ userAgent: UA.androidChrome, standalone: false })).toBe("browser");
    expect(installWay({ userAgent: UA.desktopChrome, standalone: false })).toBe("browser");
  });

  it("offers nothing once the app is installed", () => {
    expect(installWay({ userAgent: UA.iphoneSafari, standalone: true })).toBeNull();
    expect(installWay({ userAgent: UA.androidChrome, standalone: true })).toBeNull();
  });
});

const base = {
  signedIn: true,
  hasPredicted: true,
  sessions: 2,
  dismissed: false,
  way: "browser" as const,
};

describe("shouldOfferInstall", () => {
  it("offers the install to a player who predicted, from the second visit", () => {
    expect(shouldOfferInstall(base)).toBe(true);
    expect(shouldOfferInstall({ ...base, sessions: 7 })).toBe(true);
  });

  it("never offers the browser prompt on the first visit", () => {
    expect(shouldOfferInstall({ ...base, sessions: 1 })).toBe(false);
  });

  it("offers the iPhone and in-app guides from the first visit after a prediction", () => {
    expect(shouldOfferInstall({ ...base, way: "ios", sessions: 1 })).toBe(true);
    expect(shouldOfferInstall({ ...base, way: "in-app", sessions: 1 })).toBe(true);
  });

  it("never offers it to a visitor or to a player without a prediction", () => {
    for (const way of ["browser", "ios", "in-app"] as const) {
      expect(shouldOfferInstall({ ...base, way, signedIn: false })).toBe(false);
      expect(shouldOfferInstall({ ...base, way, hasPredicted: false })).toBe(false);
    }
  });

  it("never offers it again once closed", () => {
    for (const way of ["browser", "ios", "in-app"] as const) {
      expect(shouldOfferInstall({ ...base, way, dismissed: true })).toBe(false);
    }
  });

  it("never offers it when the app is already installed", () => {
    expect(shouldOfferInstall({ ...base, way: null })).toBe(false);
  });
});
