import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "VeilCast Safe Share",
    short_name: "VeilCast",
    description: "Protect sensitive browser-tab content during screen sharing.",
    permissions: ["activeTab", "scripting", "storage"],
    action: {
      default_title: "VeilCast",
    },
  },
});
