interface AuditProvider {
  readonly url: string;
  readonly format: "yaml" | "text" | "mrs";
}

interface AuditSource {
  readonly url: string;
  readonly format: "yaml" | "text" | "mrs";
  readonly opaque: boolean;
}

interface NormalizedAuditEntry {
  readonly kind: string;
  readonly raw: string;
  readonly key: string;
  readonly [key: string]: unknown;
}

function resolveAuditSource(provider: AuditProvider): AuditSource;
function parseRulePayload(
  providerId: string,
  content: string,
  source: AuditSource,
): readonly unknown[];
function normalizeEntry(behavior: string, value: unknown): NormalizedAuditEntry;
function main(options?: { readonly summaryOnly?: boolean }): Promise<unknown>;

export { main, normalizeEntry, parseRulePayload, resolveAuditSource };
