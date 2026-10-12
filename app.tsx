import type { ComponentType } from "react";
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { toggleWidget } from "./src/mode";
import { mountContextMenus } from "./src/context-menu";
import { mountLatest } from "./src/rail-layout";
import { mountRailToggle } from "./src/rail-toggle";
import { Widget } from "./src/Widget";
import "./app.css";

type OverlaySlots = {
  experimental_appOverlay(registration: { id: string; component: ComponentType }): void;
};

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "thread-widget-rail-toggle",
    mount({ signal }) {
      mountLatest("thread-widget-content", signal, (ownedSignal) => {
        mountRailToggle(ownedSignal);
        mountContextMenus(ownedSignal);
      });
    },
  });

  app.slots.sidebarFooterAction({
    id: "thread-widget",
    title: "Thread widget",
    icon: "MessageSquare",
    run() {
      toggleWidget();
    },
  });

  (app.slots as typeof app.slots & OverlaySlots).experimental_appOverlay({
    id: "thread-widget",
    component: Widget,
  });
});
