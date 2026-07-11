function resolvePublicBaseUrl(
  environmentValue: string | undefined,
  configuredValue: string | null,
): string | undefined {
  const fromEnvironment = environmentValue?.trim();
  const candidate =
    fromEnvironment === undefined || fromEnvironment.length === 0
      ? configuredValue
      : fromEnvironment;
  if (candidate === null) return undefined;

  const parsed = new URL(candidate);
  if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
    throw new Error(`PUBLIC_BASE_URL 只允许 http/https: ${candidate}`);
  }
  if (
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error("PUBLIC_BASE_URL 不得包含凭据、query 或 fragment");
  }
  return parsed.toString().replace(/\/$/, "");
}

function artifactPublicUrl(baseUrl: string, channel: string, name: string): string {
  const encodedPath = [channel, ...name.split("/")].map(encodeURIComponent).join("/");
  return `${baseUrl}/${encodedPath}`;
}

export { artifactPublicUrl, resolvePublicBaseUrl };
