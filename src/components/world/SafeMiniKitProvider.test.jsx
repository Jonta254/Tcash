import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const capture = vi.hoisted(() => ({ props: null }));
vi.mock("@worldcoin/minikit-js/minikit-provider", () => ({ MiniKitProvider: ({ children, props }) => { capture.props = props; return children; } }));
import Provider from "./SafeMiniKitProvider";
import { APP_CONFIG } from "../../config/appConfig";
it("provides the app ID through the installed SDK's props contract", () => {
  renderToStaticMarkup(createElement(Provider, null, "Tcash"));
  expect(capture.props).toEqual({ appId: APP_CONFIG.worldAppId });
});
