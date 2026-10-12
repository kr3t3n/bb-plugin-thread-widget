import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { linkContract } from "./src/rpc";

export default function plugin(bb: BbPluginApi) {
  bb.rpc.register(linkContract, {
    async linkOrigins() {
      return {
        localOrigin: bb.server.loopbackBaseUrl.replace(/\/$/, ""),
        cloudOrigin: null,
      };
    },
  });
}
