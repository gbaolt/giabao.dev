export function setFile(
  files: Record<string, string>,
  path: string,
  content: string
): void {
  files[path] = content.endsWith('\n') ? content : `${content}\n`;
}

export function setFileIfAbsent(
  files: Record<string, string>,
  path: string,
  content: string
): void {
  if (files[path] !== undefined) {
    return;
  }
  setFile(files, path, content);
}

/** Adds dependencies to an already written workspace manifest. */
export function addDependencies(
  files: Record<string, string>,
  manifestPath: string,
  dependencies: Record<string, string>
): void {
  const manifest = JSON.parse(files[manifestPath]!) as {
    dependencies: Record<string, string>;
  };
  Object.assign(manifest.dependencies, dependencies);
  setFile(files, manifestPath, JSON.stringify(manifest, null, 2));
}

export function sortRecord(
  record: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right))
  );
}
