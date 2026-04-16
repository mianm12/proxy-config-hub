export default {
  "groupDefinitions": {
    "proxy_select": {
      "name": "🚀 代理选择",
      "type": "select",
      "category": "core",
      "proxies": [
        "@manual-select",
        "@auto-select",
        "@chain-groups",
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
        "@chain-groups",
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
        "@chain-groups",
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
      ]
    },
    "ssh_22": {
      "name": "🔑 SSH(22端口)",
      "type": "select",
      "category": "core",
      "proxies": [
        "DIRECT",
        "@proxy-select",
        "@manual-select",
        "@auto-select",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
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
        "DIRECT",
        "@chain-groups",
        "@region-groups"
      ]
    }
  }
};
