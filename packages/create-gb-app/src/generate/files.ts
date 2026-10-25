export function setFile(
  files: Record<string, string>,
  path: string,
  content: string
): void {
  files[path] = content.endsWith('\n') ? content : `${content}\n`;
}

/**
 * The FileMap view emit modules get: each path has one writer, and nobody
 * reads another module's output back. Shared results go through the
 * project model instead.
 */
export function writeOnceFiles(
  files: Record<string, string>
): Record<string, string> {
  const unreadable = (path: PropertyKey): never => {
    throw new Error(`emit modules cannot read ${String(path)}`);
  };
  return new Proxy(files, {
    set(target, path, content: string) {
      if (typeof path !== 'string' || path in target)
        throw new Error(`${String(path)} already has a writer`);
      target[path] = content;
      return true;
    },
    get: (_, path) => unreadable(path),
    has: (_, path) => unreadable(path),
    ownKeys: () => unreadable('the file list'),
    deleteProperty: (_, path) => unreadable(path),
  });
}

export function sortRecord(
  record: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right))
  );
}
