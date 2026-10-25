const TOKEN = /__[A-Z][A-Z0-9_]*__/g;

// Template tokens use the __NAME__ syntax so authored templates stay valid, formattable code.
export function fillTemplate(
  source: string,
  values: Readonly<Record<string, string>>
): string {
  const filled = source.replace(TOKEN, (token) => {
    const name = token.slice(2, -2);
    if (!Object.hasOwn(values, name)) {
      throw new Error(`Unknown template token: ${token}`);
    }
    return values[name]!;
  });
  const leftover = filled.match(TOKEN);
  if (leftover) throw new Error(`Unreplaced template token: ${leftover[0]}`);
  return filled;
}
