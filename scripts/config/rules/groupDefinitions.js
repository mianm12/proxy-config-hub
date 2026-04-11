export default {
  "groupDefinitions": {
    "proxy_select": {
      "name": "🚀 代理选择",
      "type": "select",
      "category": "core",
      "proxies": [
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "manual_select": {
      "name": "🔧 手动选择",
      "type": "select",
      "category": "core",
      "proxies": [
        "@all-nodes"
      ]
    },
    "auto_select": {
      "name": "⚡ 自动选择",
      "type": "url-test",
      "category": "core",
      "proxies": [
        "@all-nodes"
      ],
      "url": "https://www.gstatic.com/generate_204",
      "interval": 300,
      "lazy": false
    },
    "ad_block": {
      "name": "🛑 广告拦截",
      "type": "select",
      "category": "core",
      "proxies": [
        "REJECT",
        "DIRECT"
      ]
    },
    "private": {
      "name": "🏠 私有网络",
      "type": "select",
      "category": "core",
      "proxies": [
        "DIRECT",
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups"
      ]
    },
    "cn_service": {
      "name": "🔒 国内服务",
      "type": "select",
      "category": "core",
      "proxies": [
        "DIRECT",
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups"
      ]
    },
    "non_cn": {
      "name": "🌐 国外服务",
      "type": "select",
      "category": "core",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "fallback": {
      "name": "🐟 漏网之鱼",
      "type": "select",
      "category": "core",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "ai_service": {
      "name": "🤖 AI 服务",
      "type": "select",
      "category": "basic",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "youtube": {
      "name": "📹 油管视频",
      "type": "select",
      "category": "basic",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "google": {
      "name": "🔍 谷歌服务",
      "type": "select",
      "category": "basic",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "microsoft": {
      "name": "Ⓜ️ 微软服务",
      "type": "select",
      "category": "basic",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "apple": {
      "name": "🍏 苹果服务",
      "type": "select",
      "category": "basic",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "telegram": {
      "name": "📲 电报消息",
      "type": "select",
      "category": "basic",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "code_hosting": {
      "name": "🐱 代码托管",
      "type": "select",
      "category": "basic",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "twitter": {
      "name": "🐦 推特/X",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "meta_social": {
      "name": "📘 Meta 系",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "discord": {
      "name": "🎙️ Discord",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "social_other": {
      "name": "💬 其他社交",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "netflix": {
      "name": "🎬 Netflix",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "disney_plus": {
      "name": "🧞‍♂️ Disney+",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "western_streaming": {
      "name": "📺 欧美流媒体",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "asia_streaming": {
      "name": "🌏 亚洲流媒体",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "steam": {
      "name": "🎮 Steam",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "game_pc": {
      "name": "🖥️ PC 游戏",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "game_console": {
      "name": "🎮 主机游戏",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "cloud_service": {
      "name": "☁️ 云服务",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "developer_tools": {
      "name": "🛠️ 开发工具",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "storage_service": {
      "name": "📦 网盘存储",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "payment": {
      "name": "💳 支付服务",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "encryption": {
      "name": "🔐 加密货币",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "education": {
      "name": "🎓 教育服务",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "news": {
      "name": "📰 新闻资讯",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    },
    "shopping": {
      "name": "🛒 购物平台",
      "type": "select",
      "category": "extended",
      "proxies": [
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@region-groups",
        "DIRECT"
      ]
    }
  }
};
