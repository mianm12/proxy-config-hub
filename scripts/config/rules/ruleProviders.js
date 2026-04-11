export default {
  "ruleProviders": {
    "category-ads-all": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/category-ads-all.mrs",
      "path": "./ruleset/category-ads-all.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "ad_block"
    },
    "private": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/private.mrs",
      "path": "./ruleset/private.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "private"
    },
    "private-ip": {
      "type": "http",
      "behavior": "ipcidr",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geoip/private.mrs",
      "path": "./ruleset/private-ip.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "private"
    },
    "category-ai-chat-!cn": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/category-ai-chat-!cn.mrs",
      "path": "./ruleset/category-ai-chat-!cn.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "ai_service"
    },
    "openai": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/openai.mrs",
      "path": "./ruleset/openai.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "ai_service"
    },
    "anthropic": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/anthropic.mrs",
      "path": "./ruleset/anthropic.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "ai_service"
    },
    "youtube": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/youtube.mrs",
      "path": "./ruleset/youtube.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "youtube"
    },
    "category-scholar-!cn": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/category-scholar-!cn.mrs",
      "path": "./ruleset/category-scholar-!cn.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "education"
    },
    "coursera": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/coursera.mrs",
      "path": "./ruleset/coursera.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "education"
    },
    "udemy": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/udemy.mrs",
      "path": "./ruleset/udemy.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "education"
    },
    "edx": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/edx.mrs",
      "path": "./ruleset/edx.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "education"
    },
    "khanacademy": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/khanacademy.mrs",
      "path": "./ruleset/khanacademy.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "education"
    },
    "wikimedia": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/wikimedia.mrs",
      "path": "./ruleset/wikimedia.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "education"
    },
    "telegram": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/telegram.mrs",
      "path": "./ruleset/telegram.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "telegram"
    },
    "telegram-ip": {
      "type": "http",
      "behavior": "ipcidr",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geoip/telegram.mrs",
      "path": "./ruleset/telegram-ip.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "telegram"
    },
    "twitter": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/twitter.mrs",
      "path": "./ruleset/twitter.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "twitter"
    },
    "twitter-ip": {
      "type": "http",
      "behavior": "ipcidr",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geoip/twitter.mrs",
      "path": "./ruleset/twitter-ip.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "twitter"
    },
    "facebook": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/facebook.mrs",
      "path": "./ruleset/facebook.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "meta_social"
    },
    "instagram": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/instagram.mrs",
      "path": "./ruleset/instagram.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "meta_social"
    },
    "whatsapp": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/whatsapp.mrs",
      "path": "./ruleset/whatsapp.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "meta_social"
    },
    "facebook-ip": {
      "type": "http",
      "behavior": "ipcidr",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geoip/facebook.mrs",
      "path": "./ruleset/facebook-ip.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "meta_social"
    },
    "discord": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/discord.mrs",
      "path": "./ruleset/discord.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "discord"
    },
    "tiktok": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/tiktok.mrs",
      "path": "./ruleset/tiktok.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "social_other"
    },
    "line": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/line.mrs",
      "path": "./ruleset/line.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "social_other"
    },
    "reddit": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/reddit.mrs",
      "path": "./ruleset/reddit.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "social_other"
    },
    "linkedin": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/linkedin.mrs",
      "path": "./ruleset/linkedin.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "social_other"
    },
    "snap": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/snap.mrs",
      "path": "./ruleset/snap.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "social_other"
    },
    "pinterest": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/pinterest.mrs",
      "path": "./ruleset/pinterest.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "social_other"
    },
    "tumblr": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/tumblr.mrs",
      "path": "./ruleset/tumblr.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "social_other"
    },
    "netflix": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/netflix.mrs",
      "path": "./ruleset/netflix.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "netflix"
    },
    "netflix-ip": {
      "type": "http",
      "behavior": "ipcidr",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geoip/netflix.mrs",
      "path": "./ruleset/netflix-ip.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "netflix"
    },
    "disney": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/disney.mrs",
      "path": "./ruleset/disney.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "disney_plus"
    },
    "apple-tvplus": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/apple-tvplus.mrs",
      "path": "./ruleset/apple-tvplus.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "western_streaming"
    },
    "hbo": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/hbo.mrs",
      "path": "./ruleset/hbo.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "western_streaming"
    },
    "hulu": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/hulu.mrs",
      "path": "./ruleset/hulu.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "western_streaming"
    },
    "primevideo": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/primevideo.mrs",
      "path": "./ruleset/primevideo.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "western_streaming"
    },
    "spotify": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/spotify.mrs",
      "path": "./ruleset/spotify.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "western_streaming"
    },
    "twitch": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/twitch.mrs",
      "path": "./ruleset/twitch.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "western_streaming"
    },
    "dazn": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/dazn.mrs",
      "path": "./ruleset/dazn.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "western_streaming"
    },
    "bahamut": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/bahamut.mrs",
      "path": "./ruleset/bahamut.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "asia_streaming"
    },
    "biliintl": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/biliintl.mrs",
      "path": "./ruleset/biliintl.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "asia_streaming"
    },
    "niconico": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/niconico.mrs",
      "path": "./ruleset/niconico.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "asia_streaming"
    },
    "abema": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/abema.mrs",
      "path": "./ruleset/abema.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "asia_streaming"
    },
    "viu": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/viu.mrs",
      "path": "./ruleset/viu.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "asia_streaming"
    },
    "kktv": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/kktv.mrs",
      "path": "./ruleset/kktv.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "asia_streaming"
    },
    "steam": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/steam.mrs",
      "path": "./ruleset/steam.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "steam"
    },
    "epicgames": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/epicgames.mrs",
      "path": "./ruleset/epicgames.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "game_pc"
    },
    "ea": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/ea.mrs",
      "path": "./ruleset/ea.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "game_pc"
    },
    "ubisoft": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/ubisoft.mrs",
      "path": "./ruleset/ubisoft.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "game_pc"
    },
    "blizzard": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/blizzard.mrs",
      "path": "./ruleset/blizzard.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "game_pc"
    },
    "gog": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/gog.mrs",
      "path": "./ruleset/gog.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "game_pc"
    },
    "riot": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/riot.mrs",
      "path": "./ruleset/riot.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "game_pc"
    },
    "playstation": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/playstation.mrs",
      "path": "./ruleset/playstation.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "game_console"
    },
    "xbox": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/xbox.mrs",
      "path": "./ruleset/xbox.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "game_console"
    },
    "nintendo": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/nintendo.mrs",
      "path": "./ruleset/nintendo.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "game_console"
    },
    "bbc": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/bbc.mrs",
      "path": "./ruleset/bbc.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "news"
    },
    "cnn": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/cnn.mrs",
      "path": "./ruleset/cnn.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "news"
    },
    "nytimes": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/nytimes.mrs",
      "path": "./ruleset/nytimes.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "news"
    },
    "wsj": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/wsj.mrs",
      "path": "./ruleset/wsj.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "news"
    },
    "bloomberg": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/bloomberg.mrs",
      "path": "./ruleset/bloomberg.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "news"
    },
    "amazon": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/amazon.mrs",
      "path": "./ruleset/amazon.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "shopping"
    },
    "ebay": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/ebay.mrs",
      "path": "./ruleset/ebay.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "shopping"
    },
    "google": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/google.mrs",
      "path": "./ruleset/google.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "google"
    },
    "google-ip": {
      "type": "http",
      "behavior": "ipcidr",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geoip/google.mrs",
      "path": "./ruleset/google-ip.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "google"
    },
    "microsoft": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/microsoft.mrs",
      "path": "./ruleset/microsoft.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "microsoft"
    },
    "onedrive": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/onedrive.mrs",
      "path": "./ruleset/onedrive.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "microsoft"
    },
    "apple": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/apple.mrs",
      "path": "./ruleset/apple.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "apple"
    },
    "icloud": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/icloud.mrs",
      "path": "./ruleset/icloud.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "apple"
    },
    "github": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/github.mrs",
      "path": "./ruleset/github.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "code_hosting"
    },
    "gitlab": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/gitlab.mrs",
      "path": "./ruleset/gitlab.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "code_hosting"
    },
    "atlassian": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/atlassian.mrs",
      "path": "./ruleset/atlassian.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "code_hosting"
    },
    "docker": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/docker.mrs",
      "path": "./ruleset/docker.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "developer_tools"
    },
    "npmjs": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/npmjs.mrs",
      "path": "./ruleset/npmjs.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "developer_tools"
    },
    "jetbrains": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/jetbrains.mrs",
      "path": "./ruleset/jetbrains.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "developer_tools"
    },
    "stackexchange": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/stackexchange.mrs",
      "path": "./ruleset/stackexchange.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "developer_tools"
    },
    "dropbox": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/dropbox.mrs",
      "path": "./ruleset/dropbox.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "storage_service"
    },
    "notion": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/notion.mrs",
      "path": "./ruleset/notion.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "storage_service"
    },
    "paypal": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/paypal.mrs",
      "path": "./ruleset/paypal.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "payment"
    },
    "stripe": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/stripe.mrs",
      "path": "./ruleset/stripe.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "payment"
    },
    "wise": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/wise.mrs",
      "path": "./ruleset/wise.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "payment"
    },
    "binance": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/binance.mrs",
      "path": "./ruleset/binance.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "encryption"
    },
    "aws": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/aws.mrs",
      "path": "./ruleset/aws.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "cloud_service"
    },
    "azure": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/azure.mrs",
      "path": "./ruleset/azure.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "cloud_service"
    },
    "cloudflare": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/cloudflare.mrs",
      "path": "./ruleset/cloudflare.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "cloud_service"
    },
    "digitalocean": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/digitalocean.mrs",
      "path": "./ruleset/digitalocean.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "cloud_service"
    },
    "vercel": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/vercel.mrs",
      "path": "./ruleset/vercel.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "cloud_service"
    },
    "netlify": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/netlify.mrs",
      "path": "./ruleset/netlify.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "cloud_service"
    },
    "cloudflare-ip": {
      "type": "http",
      "behavior": "ipcidr",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geoip/cloudflare.mrs",
      "path": "./ruleset/cloudflare-ip.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "cloud_service"
    },
    "geolocation-cn": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/geolocation-cn.mrs",
      "path": "./ruleset/geolocation-cn.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "cn_service"
    },
    "geolocation-!cn": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/geolocation-!cn.mrs",
      "path": "./ruleset/geolocation-!cn.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "non_cn"
    },
    "cn": {
      "type": "http",
      "behavior": "domain",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geosite/cn.mrs",
      "path": "./ruleset/cn.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "cn_service"
    },
    "cn-ip": {
      "type": "http",
      "behavior": "ipcidr",
      "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geoip/cn.mrs",
      "path": "./ruleset/cn-ip.mrs",
      "interval": 86400,
      "format": "mrs",
      "target-group": "cn_service"
    }
  }
};
