"use strict";

const GROUP_DEFINITIONS = {
  ad_block: { name: "🛑 广告拦截", mode: "reject", category: "special" },
  private: { name: "🏠 私有网络", mode: "direct", category: "special" },
  cn_service: { name: "🔒 国内服务", mode: "direct", category: "special" },
  fallback: { name: "🐟 漏网之鱼", mode: "full", category: "fallback" },
  ai_service: { name: "🤖 AI 服务", mode: "full", category: "business" },
  youtube: { name: "📹 油管视频", mode: "full", category: "business" },
  google: { name: "🔍 谷歌服务", mode: "full", category: "business" },
  microsoft: { name: "Ⓜ️ 微软服务", mode: "full", category: "business" },
  apple: { name: "🍏 苹果服务", mode: "full", category: "business" },
  telegram: { name: "📲 电报消息", mode: "full", category: "business" },
  twitter: { name: "🐦 推特/X", mode: "full", category: "business" },
  meta_social: { name: "📘 Meta 系", mode: "full", category: "business" },
  discord: { name: "🎙️ Discord", mode: "full", category: "business" },
  social_other: { name: "💬 其他社交", mode: "full", category: "business" },
  netflix: { name: "🎬 奈飞", mode: "full", category: "business" },
  disney: { name: "🏰 迪士尼+", mode: "full", category: "business" },
  steam: { name: "🎮 Steam", mode: "full", category: "business" },
  game_pc: { name: "🖥️ PC 游戏", mode: "full", category: "business" },
  code_hosting: { name: "🐱 代码托管", mode: "full", category: "business" },
  cloud: { name: "☁️ 云服务", mode: "full", category: "business" },
  dev_tools: { name: "🛠️ 开发工具", mode: "full", category: "business" },
  education: { name: "📚 教育学术", mode: "full", category: "business" },
  non_cn: { name: "🌍 非中国", mode: "full", category: "business" }
};

const GROUP_ORDER = {
  business: [
    "ai_service",
    "youtube",
    "google",
    "microsoft",
    "apple",
    "telegram",
    "twitter",
    "meta_social",
    "discord",
    "social_other",
    "netflix",
    "disney",
    "steam",
    "game_pc",
    "code_hosting",
    "cloud",
    "dev_tools",
    "education",
    "non_cn"
  ],
  special: ["ad_block", "private", "cn_service"],
  fallback: "fallback"
};

const RULE_SET_GROUP_IDS = [...GROUP_ORDER.business, ...GROUP_ORDER.special];

if (typeof module !== "undefined") {
  module.exports = {
    GROUP_DEFINITIONS,
    GROUP_ORDER,
    RULE_SET_GROUP_IDS
  };
}
