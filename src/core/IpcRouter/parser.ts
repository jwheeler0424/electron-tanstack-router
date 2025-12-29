export class RouteParser {
  static build(
    method: string,
    pattern: string,
    params: Record<string, any>
  ): string {
    let url = pattern;
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`[${key}]`, String(value));
    }
    return `${method.toUpperCase()}:${url}`;
  }

  static parse(
    method: string,
    pattern: string,
    actual: string
  ): Record<string, string> | null {
    const regexStr = pattern
      .replace(/\./g, "\\.")
      .replace(/\[([a-zA-Z0-9_]+)\]/g, "(?<$1>[^:]+)");

    // Matches "METHOD:pattern"
    const finalRegex = new RegExp(`^${method.toUpperCase()}:${regexStr}$`);
    const match = actual.match(finalRegex);
    return match ? (match.groups as Record<string, string>) : null;
  }
}
