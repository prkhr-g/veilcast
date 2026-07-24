import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "VeilCast Safe Preview",
    short_name: "VeilCast",
    description: "Preview browser-window sharing safely before presenting.",
    permissions: ["desktopCapture"],
    action: {
      default_title: "VeilCast",
    },
  },
});
