// cf CLI configuration. The first API-based deployment is already live.
// Rebuild worker with npm run build before invoking cf deploy.
import { bindings, defineConfig, triggers } from "cf/config";
import * as entrypoint from "./dist/worker.mjs" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "iir-innovation-radar",
    entrypoint,
    compatibilityDate: "2026-11-10",
    env: {
      DB: bindings.d1({name:"iir-investment-radar",id:"b2ca6200-d076-4645-93f4-4ceaf5766d3c"}),
      AUTOMATION_ENABLED: bindings.text("true"),
      SEC_CONTACT_EMAIL: bindings.secret(),
      ADMIN_TOKEN: bindings.secret()
    },
    triggers: [
      triggers.scheduled({schedule:"30 23 * * MON-FRI"}),
      triggers.scheduled({schedule:"30 11 * * MON-FRI"})
    ]
  }
});
