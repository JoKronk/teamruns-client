import { open, save } from "@tauri-apps/plugin-dialog";

export async function filePromptNoFilters(
  title: string,
): Promise<string | null> {
  const path = await open({title: title, multiple: false, directory: false, filters: undefined});

  if (Array.isArray(path) || path === null) {
    return null;
  }

  return path;
}

export async function filePrompt(extensions: string[], name: string, title: string): Promise<string | null> {
  const path = await open({
    title: title,
    multiple: false,
    directory: false,
    filters: [{ extensions: extensions, name: name }],
  });

  if (Array.isArray(path) || path === null) {
    return null;
  }
  return path;
}


export async function isoPrompt(): Promise<string | undefined> {
  const path = await filePrompt(["ISO", "iso"], "Jak ISO File", "Select Game ISO");
  return path ?? undefined;
}

export async function folderPrompt(title: string): Promise<string | undefined> {
  const path = await open({title: title, multiple: false, directory: true,});

  if (Array.isArray(path) || path === null) {
    return undefined;
  }

  return path;
}
