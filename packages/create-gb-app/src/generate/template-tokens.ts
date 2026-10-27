const TOKEN = /__[A-Z][A-Z0-9_]*__/g;

// Template tokens use the __NAME__ syntax so authored templates stay valid, formattable code.
export function fillTemplate(
  source: string,
  values: Readonly<Record<string, string>>
): string {
  // One pass replaces every token, so substituted values are never rescanned.
  return source.replace(TOKEN, (token) => {
    const name = token.slice(2, -2);
    if (!Object.hasOwn(values, name)) {
      throw new Error(`Unknown template token: ${token}`);
    }
    return values[name]!;
  });
}
