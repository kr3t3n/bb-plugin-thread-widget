# Thread widget

Turns the bb window into a short list of active threads.

Requires bb 0.46 or later.

```bash
bb plugin install https://github.com/kr3t3n/bb-plugin-thread-widget
bb plugin enable thread-widget
```

The rail button under the usage meters, or the Thread widget footer action, switches the mode on. Exit returns to the normal bb layout. In bb installed as a PWA, the window shrinks to 360 pixels wide, and Exit puts back the earlier width. A desktop app built from gap-bb does the same through its setWindowWidth call. A browser tab and the official desktop app cannot resize the window, so there you resize it yourself.

The filter button in the header opens a dialog with filters for status, provider and label, and a sort control. A dot on the button shows that the filters differ from the defaults. By default the widget hides threads with the `automation` label. The widget keeps its own filter choices, apart from Sidebar Pro. The header starts right of bb's sidebar button and the macOS window buttons.

Pinned threads sit in a Pinned section at the top of the list, in bb's pin order. The section starts collapsed and remembers whether you opened it. While the section is collapsed, it still shows each pinned thread that is working, needs you, or is unread. Opening it shows every pinned thread. The filters do not apply to the section. The + button left of the Threads heading starts a new thread. The widget opens bb's compose screen and steps aside. After you send the first message, the widget comes back with the new thread open. Back to widget returns without a new thread. bb's sidebar button is hidden in widget mode. Threads that need a reply are marked Needs you and sort first. Each row starts with the provider icon and bb's status glyph, including the spinner while the agent is working. Right-click a row for the sidebar actions: open in split, copy the thread id or a link, mark read, pin, rename, archive, and delete.

A small amber hourglass over the provider icon’s top-right corner marks threads whose host and provider have reached a provider-wide usage limit. Hover, focus, or tap the badge for the reset time, when known. The badge clears when a known reset time arrives. Usage refreshes each minute while the widget is visible and when the window regains focus. Model-specific limits stay unmarked because the sidebar thread data does not include the selected model.

Open a thread to read the session and reply. The composer is bb's own composer, so you can attach a file. Sending closes the session view and leaves the reply on the thread. Open in bb leaves the widget and shows that thread in the normal window. bb's embedded chat leaves out forms that a plugin renders. The widget draws its own copy of bb's secret form above the chat, and sends the values to bb's server with the same call bb's form makes. The widget does not log or store them. For any other plugin form, a notice offers Answer in bb. That shows the thread in bb's full view, and the widget comes back after you complete the form.

In an open thread, the row under the header has two buttons between the health labels and the usage meters. The panel button opens bb's right panel for the thread: info, diff and open tabs. The + button opens bb's new-tab page: terminal, files, editor, browser, side chat, document and task. The widget steps aside while the panel shows, and Back to widget at the bottom returns to it. bb has no plugin API for this panel, so the widget opens the thread underneath and presses bb's own buttons.

## Chrome side panel

The [bb Chrome Bridge](https://github.com/kr3t3n/bb-chrome-bridge) extension shows bb in Chrome's side panel. It opens bb with `?widget=1`, which turns widget mode on. Inside a frame the widget never resizes the window. When the parent is a Chrome extension page, the widget posts the open thread's ID and title to it, so the panel's Share this tab button knows which thread gets the tab. Open in bb opens the thread in a new browser tab there. `src/embed.ts` holds this code.

## Rail placement

`src/rail-layout.ts` is the shared rail contract. Keep its source identical in
Health Rail, Sidebar Pro, Thread widget, and Automation Provider. Their bundles use one
window coordinator through `Symbol.for("bb.local.rail-layout.v2")`.

The order is health, usage, Thread widget, Automation Provider, then Settings.
Plugins attach their owned elements and register refresh callbacks. They must
not enforce separate neighbor rules or observe the whole document for placement.
The coordinator observes direct rail children, disconnects during its own writes,
and checks for replacement rails twice per second. Repeated mounts replace and
dispose the previous generation. The last unmount stops all layout scheduling.

The combined regression tests live in Sidebar Pro's `src/rail-layout.test.ts`.
Run those tests and build all four plugins before reloading this contract.

Widget mode shows the live usage meters and BB/server health indicators in the header.
They remain visible in the list and chat views and return to the rail on exit.
Health opens its detail panel. A usage meter exits widget mode and opens usage settings.

An open widget chat uses one same-page browser history entry. The Back button,
mouse Back button, and native browser back gestures return to the thread list.
A rightward touch swipe from the left 40 pixels of the chat also goes Back.
Vertical scrolling, composer input, code blocks, and text selections keep their gestures.

Mouse Forward and native forward gestures reopen the previous widget chat after Back.
A leftward touch swipe from the right 40 pixels of the widget does the same.
Opening a different chat after Back replaces the previous forward destination.
