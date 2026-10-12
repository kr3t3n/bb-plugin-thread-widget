export function threadPath(
  thread: { id: string; projectId: string },
  project: { isPersonal: boolean } | null | undefined,
): string {
  if (project?.isPersonal) return `/threads/${thread.id}`;
  return `/projects/${thread.projectId}/threads/${thread.id}`;
}

export function threadUrl(path: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}${path}`;
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}
