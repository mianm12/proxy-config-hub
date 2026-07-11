import { resolveMihomo } from "./mihomo/resolve.ts";

const mihomo = await resolveMihomo({ downloadIfMissing: true });
console.log(`Mihomo 已就绪：${mihomo.path}（来源：${mihomo.source}）`);
