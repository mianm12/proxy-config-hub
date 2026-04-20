var __proxyConfigHub = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // scripts/override/main.js
  var main_exports = {};
  __export(main_exports, {
    main: () => main
  });

  // scripts/config/rules/ruleProviders.js
  var ruleProviders_default = {
    "ruleProviders": {
      "category-ads-all": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ads-all.mrs",
        "path": "./ruleset/category-ads-all.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "ad_block"
      },
      "private": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.mrs",
        "path": "./ruleset/private.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "private"
      },
      "private-ip": {
        "type": "http",
        "behavior": "ipcidr",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/private.mrs",
        "path": "./ruleset/private-ip.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "private",
        "no-resolve": true
      },
      "openai": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/openai.mrs",
        "path": "./ruleset/openai.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "ai_service"
      },
      "anthropic": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/anthropic.mrs",
        "path": "./ruleset/anthropic.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "ai_service"
      },
      "category-ai-chat-!cn": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-chat-!cn.mrs",
        "path": "./ruleset/category-ai-chat-!cn.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "ai_service"
      },
      "youtube": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs",
        "path": "./ruleset/youtube.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "youtube"
      },
      "category-scholar-!cn": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-scholar-!cn.mrs",
        "path": "./ruleset/category-scholar-!cn.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "education"
      },
      "coursera": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/coursera.mrs",
        "path": "./ruleset/coursera.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "education"
      },
      "udemy": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/udemy.mrs",
        "path": "./ruleset/udemy.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "education"
      },
      "edx": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/edx.mrs",
        "path": "./ruleset/edx.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "education"
      },
      "khanacademy": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/khanacademy.mrs",
        "path": "./ruleset/khanacademy.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "education"
      },
      "wikimedia": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/wikimedia.mrs",
        "path": "./ruleset/wikimedia.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "education"
      },
      "telegram": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.mrs",
        "path": "./ruleset/telegram.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "telegram"
      },
      "telegram-ip": {
        "type": "http",
        "behavior": "ipcidr",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.mrs",
        "path": "./ruleset/telegram-ip.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "telegram",
        "no-resolve": true
      },
      "twitter": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/twitter.mrs",
        "path": "./ruleset/twitter.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "twitter"
      },
      "twitter-ip": {
        "type": "http",
        "behavior": "ipcidr",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/twitter.mrs",
        "path": "./ruleset/twitter-ip.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "twitter",
        "no-resolve": true
      },
      "facebook": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/facebook.mrs",
        "path": "./ruleset/facebook.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "meta_social"
      },
      "instagram": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/instagram.mrs",
        "path": "./ruleset/instagram.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "meta_social"
      },
      "whatsapp": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/whatsapp.mrs",
        "path": "./ruleset/whatsapp.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "meta_social"
      },
      "facebook-ip": {
        "type": "http",
        "behavior": "ipcidr",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/facebook.mrs",
        "path": "./ruleset/facebook-ip.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "meta_social",
        "no-resolve": true
      },
      "discord": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/discord.mrs",
        "path": "./ruleset/discord.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "discord"
      },
      "tiktok": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tiktok.mrs",
        "path": "./ruleset/tiktok.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "social_other"
      },
      "line": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/line.mrs",
        "path": "./ruleset/line.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "social_other"
      },
      "reddit": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/reddit.mrs",
        "path": "./ruleset/reddit.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "social_other"
      },
      "linkedin": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/linkedin.mrs",
        "path": "./ruleset/linkedin.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "social_other"
      },
      "snap": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/snap.mrs",
        "path": "./ruleset/snap.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "social_other"
      },
      "pinterest": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/pinterest.mrs",
        "path": "./ruleset/pinterest.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "social_other"
      },
      "tumblr": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tumblr.mrs",
        "path": "./ruleset/tumblr.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "social_other"
      },
      "netflix": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netflix.mrs",
        "path": "./ruleset/netflix.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "netflix"
      },
      "netflix-ip": {
        "type": "http",
        "behavior": "ipcidr",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/netflix.mrs",
        "path": "./ruleset/netflix-ip.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "netflix",
        "no-resolve": true
      },
      "disney": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/disney.mrs",
        "path": "./ruleset/disney.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "disney_plus"
      },
      "apple-tvplus": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple-tvplus.mrs",
        "path": "./ruleset/apple-tvplus.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "western_streaming"
      },
      "hbo": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/hbo.mrs",
        "path": "./ruleset/hbo.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "western_streaming"
      },
      "hulu": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/hulu.mrs",
        "path": "./ruleset/hulu.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "western_streaming"
      },
      "primevideo": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/primevideo.mrs",
        "path": "./ruleset/primevideo.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "western_streaming"
      },
      "spotify": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/spotify.mrs",
        "path": "./ruleset/spotify.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "western_streaming"
      },
      "twitch": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/twitch.mrs",
        "path": "./ruleset/twitch.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "western_streaming"
      },
      "dazn": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/dazn.mrs",
        "path": "./ruleset/dazn.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "western_streaming"
      },
      "bahamut": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/bahamut.mrs",
        "path": "./ruleset/bahamut.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "asia_streaming"
      },
      "biliintl": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/biliintl.mrs",
        "path": "./ruleset/biliintl.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "asia_streaming"
      },
      "niconico": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/niconico.mrs",
        "path": "./ruleset/niconico.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "asia_streaming"
      },
      "abema": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/abema.mrs",
        "path": "./ruleset/abema.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "asia_streaming"
      },
      "viu": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/viu.mrs",
        "path": "./ruleset/viu.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "asia_streaming"
      },
      "kktv": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/kktv.mrs",
        "path": "./ruleset/kktv.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "asia_streaming"
      },
      "steam": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/steam.mrs",
        "path": "./ruleset/steam.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "steam"
      },
      "epicgames": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/epicgames.mrs",
        "path": "./ruleset/epicgames.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "game_pc"
      },
      "ea": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/ea.mrs",
        "path": "./ruleset/ea.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "game_pc"
      },
      "ubisoft": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/ubisoft.mrs",
        "path": "./ruleset/ubisoft.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "game_pc"
      },
      "blizzard": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/blizzard.mrs",
        "path": "./ruleset/blizzard.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "game_pc"
      },
      "gog": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/gog.mrs",
        "path": "./ruleset/gog.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "game_pc"
      },
      "riot": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/riot.mrs",
        "path": "./ruleset/riot.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "game_pc"
      },
      "playstation": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/playstation.mrs",
        "path": "./ruleset/playstation.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "game_console"
      },
      "xbox": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/xbox.mrs",
        "path": "./ruleset/xbox.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "game_console"
      },
      "nintendo": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/nintendo.mrs",
        "path": "./ruleset/nintendo.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "game_console"
      },
      "bbc": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/bbc.mrs",
        "path": "./ruleset/bbc.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "news"
      },
      "cnn": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cnn.mrs",
        "path": "./ruleset/cnn.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "news"
      },
      "nytimes": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/nytimes.mrs",
        "path": "./ruleset/nytimes.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "news"
      },
      "wsj": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/wsj.mrs",
        "path": "./ruleset/wsj.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "news"
      },
      "bloomberg": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/bloomberg.mrs",
        "path": "./ruleset/bloomberg.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "news"
      },
      "google": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.mrs",
        "path": "./ruleset/google.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "google"
      },
      "google-ip": {
        "type": "http",
        "behavior": "ipcidr",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/google.mrs",
        "path": "./ruleset/google-ip.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "google",
        "no-resolve": true
      },
      "icloud": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/icloud.mrs",
        "path": "./ruleset/icloud.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "apple"
      },
      "apple": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple.mrs",
        "path": "./ruleset/apple.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "apple"
      },
      "docker": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/docker.mrs",
        "path": "./ruleset/docker.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "developer_tools"
      },
      "npmjs": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/npmjs.mrs",
        "path": "./ruleset/npmjs.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "developer_tools"
      },
      "jetbrains": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/jetbrains.mrs",
        "path": "./ruleset/jetbrains.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "developer_tools"
      },
      "stackexchange": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/stackexchange.mrs",
        "path": "./ruleset/stackexchange.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "developer_tools"
      },
      "github": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.mrs",
        "path": "./ruleset/github.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "code_hosting"
      },
      "gitlab": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/gitlab.mrs",
        "path": "./ruleset/gitlab.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "code_hosting"
      },
      "atlassian": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/atlassian.mrs",
        "path": "./ruleset/atlassian.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "code_hosting"
      },
      "dropbox": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/dropbox.mrs",
        "path": "./ruleset/dropbox.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "storage_service"
      },
      "notion": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/notion.mrs",
        "path": "./ruleset/notion.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "storage_service"
      },
      "paypal": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/paypal.mrs",
        "path": "./ruleset/paypal.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "payment"
      },
      "stripe": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/stripe.mrs",
        "path": "./ruleset/stripe.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "payment"
      },
      "wise": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/wise.mrs",
        "path": "./ruleset/wise.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "payment"
      },
      "binance": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/binance.mrs",
        "path": "./ruleset/binance.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "encryption"
      },
      "aws": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/aws.mrs",
        "path": "./ruleset/aws.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "cloud_service"
      },
      "azure": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/azure.mrs",
        "path": "./ruleset/azure.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "cloud_service"
      },
      "cloudflare": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cloudflare.mrs",
        "path": "./ruleset/cloudflare.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "cloud_service"
      },
      "digitalocean": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/digitalocean.mrs",
        "path": "./ruleset/digitalocean.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "cloud_service"
      },
      "vercel": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/vercel.mrs",
        "path": "./ruleset/vercel.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "cloud_service"
      },
      "netlify": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netlify.mrs",
        "path": "./ruleset/netlify.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "cloud_service"
      },
      "cloudflare-ip": {
        "type": "http",
        "behavior": "ipcidr",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cloudflare.mrs",
        "path": "./ruleset/cloudflare-ip.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "cloud_service",
        "no-resolve": true
      },
      "onedrive": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/onedrive.mrs",
        "path": "./ruleset/onedrive.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "microsoft"
      },
      "microsoft": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/microsoft.mrs",
        "path": "./ruleset/microsoft.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "microsoft"
      },
      "amazon": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/amazon.mrs",
        "path": "./ruleset/amazon.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "shopping"
      },
      "ebay": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/ebay.mrs",
        "path": "./ruleset/ebay.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "shopping"
      },
      "geolocation-cn": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-cn.mrs",
        "path": "./ruleset/geolocation-cn.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "cn_service"
      },
      "geolocation-!cn": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.mrs",
        "path": "./ruleset/geolocation-!cn.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "non_cn"
      },
      "cn": {
        "type": "http",
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.mrs",
        "path": "./ruleset/cn.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "cn_service"
      },
      "cn-ip": {
        "type": "http",
        "behavior": "ipcidr",
        "url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.mrs",
        "path": "./ruleset/cn-ip.mrs",
        "interval": 86400,
        "format": "mrs",
        "target-group": "cn_service",
        "no-resolve": true
      }
    }
  };

  // scripts/config/proxy-groups/groupDefinitions.js
  var groupDefinitions_default = {
    "groupDefinitions": {
      "proxy_select": {
        "name": "\u{1F680} \u4EE3\u7406\u9009\u62E9",
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
        "name": "\u{1F527} \u624B\u52A8\u9009\u62E9",
        "type": "select",
        "category": "core",
        "proxies": [
          "@chain-groups",
          "@all-nodes"
        ]
      },
      "auto_select": {
        "name": "\u26A1 \u81EA\u52A8\u9009\u62E9",
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
        "name": "\u{1F6D1} \u5E7F\u544A\u62E6\u622A",
        "type": "select",
        "category": "core",
        "proxies": [
          "REJECT",
          "DIRECT"
        ]
      },
      "private": {
        "name": "\u{1F3E0} \u79C1\u6709\u7F51\u7EDC",
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
        "name": "\u{1F512} \u56FD\u5185\u670D\u52A1",
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
        "name": "\u{1F310} \u56FD\u5916\u670D\u52A1",
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
      "fallback": {
        "name": "\u{1F41F} \u6F0F\u7F51\u4E4B\u9C7C",
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
        "name": "\u{1F916} AI \u670D\u52A1",
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
        "name": "\u{1F4F9} \u6CB9\u7BA1\u89C6\u9891",
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
        "name": "\u{1F50D} \u8C37\u6B4C\u670D\u52A1",
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
        "name": "\u24C2\uFE0F \u5FAE\u8F6F\u670D\u52A1",
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
        "name": "\u{1F34F} \u82F9\u679C\u670D\u52A1",
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
        "name": "\u{1F4F2} \u7535\u62A5\u6D88\u606F",
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
        "name": "\u{1F431} \u4EE3\u7801\u6258\u7BA1",
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
        "name": "\u{1F426} \u63A8\u7279/X",
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
        "name": "\u{1F4D8} Meta \u7CFB",
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
        "name": "\u{1F399}\uFE0F Discord",
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
        "name": "\u{1F4AC} \u5176\u4ED6\u793E\u4EA4",
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
        "name": "\u{1F3AC} Netflix",
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
        "name": "\u{1F9DE}\u200D\u2642\uFE0F Disney+",
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
        "name": "\u{1F4FA} \u6B27\u7F8E\u6D41\u5A92\u4F53",
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
        "name": "\u{1F30F} \u4E9A\u6D32\u6D41\u5A92\u4F53",
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
        "name": "\u{1F3AE} Steam",
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
        "name": "\u{1F5A5}\uFE0F PC \u6E38\u620F",
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
        "name": "\u{1F3AE} \u4E3B\u673A\u6E38\u620F",
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
        "name": "\u2601\uFE0F \u4E91\u670D\u52A1",
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
        "name": "\u{1F6E0}\uFE0F \u5F00\u53D1\u5DE5\u5177",
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
        "name": "\u{1F4E6} \u7F51\u76D8\u5B58\u50A8",
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
        "name": "\u{1F4B3} \u652F\u4ED8\u670D\u52A1",
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
        "name": "\u{1F510} \u52A0\u5BC6\u8D27\u5E01",
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
        "name": "\u{1F393} \u6559\u80B2\u670D\u52A1",
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
        "name": "\u{1F4F0} \u65B0\u95FB\u8D44\u8BAF",
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
        "name": "\u{1F6D2} \u8D2D\u7269\u5E73\u53F0",
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

  // scripts/config/rules/inlineRules.js
  var inlineRules_default = {
    "prependRules": null
  };

  // scripts/config/proxy-groups/chains.js
  var chains_default = {
    "transit_group": [
      {
        "id": "transit",
        "name": "\u{1F500} \u4E2D\u8F6C",
        "transit_pattern": "Transit|\u4E2D\u8F6C|\u81EA\u5EFA",
        "flags": "i",
        "type": "select",
        "include_direct": false
      }
    ],
    "chain_group": [
      {
        "id": "landing",
        "name": "\u{1F6AA} \u843D\u5730",
        "landing_pattern": "Relay|\u843D\u5730|^(?=.*\u76F4\u8FDE)(?=.*\u5BB6\u5BBD)",
        "flags": "i",
        "type": "select",
        "entry": "transit"
      }
    ]
  };

  // scripts/config/proxy-groups/regions.js
  var regions_default = [
    {
      "id": "HK",
      "name": "\u9999\u6E2F",
      "icon": "\u{1F1ED}\u{1F1F0}",
      "pattern": "\u{1F1ED}\u{1F1F0}|\u9999\u6E2F|(?<![A-Z])HK(?![A-Z])|Hong\\s*Kong",
      "flags": "i"
    },
    {
      "id": "TW",
      "name": "\u53F0\u6E7E",
      "icon": "\u{1F1F9}\u{1F1FC}",
      "pattern": "\u{1F1F9}\u{1F1FC}|\u{1F1E8}\u{1F1F3}.*\u53F0\u6E7E|\u53F0\u6E7E|(?<![A-Z])TW(?![A-Z])|Taiwan",
      "flags": "i"
    },
    {
      "id": "JP",
      "name": "\u65E5\u672C",
      "icon": "\u{1F1EF}\u{1F1F5}",
      "pattern": "\u{1F1EF}\u{1F1F5}|\u65E5\u672C|(?<![A-Z])JP(?![A-Z])|Japan",
      "flags": "i"
    },
    {
      "id": "SG",
      "name": "\u65B0\u52A0\u5761",
      "icon": "\u{1F1F8}\u{1F1EC}",
      "pattern": "\u{1F1F8}\u{1F1EC}|\u65B0\u52A0\u5761|(?<![A-Z])SG(?![A-Z])|Singapore",
      "flags": "i"
    },
    {
      "id": "US",
      "name": "\u7F8E\u56FD",
      "icon": "\u{1F1FA}\u{1F1F8}",
      "pattern": "\u{1F1FA}\u{1F1F8}|\u7F8E\u56FD|(?<![A-Z])US(?![A-Z])|United\\s*States",
      "flags": "i"
    },
    {
      "id": "KR",
      "name": "\u97E9\u56FD",
      "icon": "\u{1F1F0}\u{1F1F7}",
      "pattern": "\u{1F1F0}\u{1F1F7}|\u97E9\u56FD|(?<![A-Z])KR(?![A-Z])|Korea",
      "flags": "i"
    },
    {
      "id": "GB",
      "name": "\u82F1\u56FD",
      "icon": "\u{1F1EC}\u{1F1E7}",
      "pattern": "\u{1F1EC}\u{1F1E7}|\u82F1\u56FD|(?<![A-Z])GB(?![A-Z])|(?<![A-Z])UK(?![A-Z])|United\\s*Kingdom",
      "flags": "i"
    },
    {
      "id": "DE",
      "name": "\u5FB7\u56FD",
      "icon": "\u{1F1E9}\u{1F1EA}",
      "pattern": "\u{1F1E9}\u{1F1EA}|\u5FB7\u56FD|(?<![A-Z])DE(?![A-Z])|Germany",
      "flags": "i"
    },
    {
      "id": "FR",
      "name": "\u6CD5\u56FD",
      "icon": "\u{1F1EB}\u{1F1F7}",
      "pattern": "\u{1F1EB}\u{1F1F7}|\u6CD5\u56FD|(?<![A-Z])FR(?![A-Z])|France",
      "flags": "i"
    },
    {
      "id": "CA",
      "name": "\u52A0\u62FF\u5927",
      "icon": "\u{1F1E8}\u{1F1E6}",
      "pattern": "\u{1F1E8}\u{1F1E6}|\u52A0\u62FF\u5927|(?<![A-Z])CA(?![A-Z])|Canada",
      "flags": "i"
    },
    {
      "id": "AU",
      "name": "\u6FB3\u5927\u5229\u4E9A",
      "icon": "\u{1F1E6}\u{1F1FA}",
      "pattern": "\u{1F1E6}\u{1F1FA}|\u6FB3\u5927\u5229\u4E9A|(?<![A-Z])AU(?![A-Z])|Australia",
      "flags": "i"
    },
    {
      "id": "RU",
      "name": "\u4FC4\u7F57\u65AF",
      "icon": "\u{1F1F7}\u{1F1FA}",
      "pattern": "\u{1F1F7}\u{1F1FA}|\u4FC4\u7F57\u65AF|(?<![A-Z])RU(?![A-Z])|Russia",
      "flags": "i"
    },
    {
      "id": "IN",
      "name": "\u5370\u5EA6",
      "icon": "\u{1F1EE}\u{1F1F3}",
      "pattern": "\u{1F1EE}\u{1F1F3}|\u5370\u5EA6(?!\u5C3C)|(?<![A-Z])IN(?![A-Z])|India",
      "flags": "i"
    },
    {
      "id": "MO",
      "name": "\u6FB3\u95E8",
      "icon": "\u{1F1F2}\u{1F1F4}",
      "pattern": "\u{1F1F2}\u{1F1F4}|\u6FB3\u95E8|Macau|Macao",
      "flags": "i"
    },
    {
      "id": "NZ",
      "name": "\u65B0\u897F\u5170",
      "icon": "\u{1F1F3}\u{1F1FF}",
      "pattern": "\u{1F1F3}\u{1F1FF}|\u65B0\u897F\u5170|New\\s*Zealand",
      "flags": "i"
    },
    {
      "id": "IT",
      "name": "\u610F\u5927\u5229",
      "icon": "\u{1F1EE}\u{1F1F9}",
      "pattern": "\u{1F1EE}\u{1F1F9}|\u610F\u5927\u5229|Italy",
      "flags": "i"
    },
    {
      "id": "NL",
      "name": "\u8377\u5170",
      "icon": "\u{1F1F3}\u{1F1F1}",
      "pattern": "\u{1F1F3}\u{1F1F1}|\u8377\u5170|Netherlands",
      "flags": "i"
    },
    {
      "id": "PL",
      "name": "\u6CE2\u5170",
      "icon": "\u{1F1F5}\u{1F1F1}",
      "pattern": "\u{1F1F5}\u{1F1F1}|\u6CE2\u5170|Poland",
      "flags": "i"
    },
    {
      "id": "CH",
      "name": "\u745E\u58EB",
      "icon": "\u{1F1E8}\u{1F1ED}",
      "pattern": "\u{1F1E8}\u{1F1ED}|\u745E\u58EB|Switzerland",
      "flags": "i"
    },
    {
      "id": "VN",
      "name": "\u8D8A\u5357",
      "icon": "\u{1F1FB}\u{1F1F3}",
      "pattern": "\u{1F1FB}\u{1F1F3}|\u8D8A\u5357|Vietnam",
      "flags": "i"
    },
    {
      "id": "TH",
      "name": "\u6CF0\u56FD",
      "icon": "\u{1F1F9}\u{1F1ED}",
      "pattern": "\u{1F1F9}\u{1F1ED}|\u6CF0\u56FD|Thailand",
      "flags": "i"
    },
    {
      "id": "PH",
      "name": "\u83F2\u5F8B\u5BBE",
      "icon": "\u{1F1F5}\u{1F1ED}",
      "pattern": "\u{1F1F5}\u{1F1ED}|\u83F2\u5F8B\u5BBE|Philippines",
      "flags": "i"
    },
    {
      "id": "MY",
      "name": "\u9A6C\u6765\u897F\u4E9A",
      "icon": "\u{1F1F2}\u{1F1FE}",
      "pattern": "\u{1F1F2}\u{1F1FE}|\u9A6C\u6765|Malaysia",
      "flags": "i"
    },
    {
      "id": "ID",
      "name": "\u5370\u5C3C",
      "icon": "\u{1F1EE}\u{1F1E9}",
      "pattern": "\u{1F1EE}\u{1F1E9}|\u5370\u5C3C|\u5370\u5EA6\u5C3C\u897F\u4E9A|Indonesia",
      "flags": "i"
    },
    {
      "id": "TR",
      "name": "\u571F\u8033\u5176",
      "icon": "\u{1F1F9}\u{1F1F7}",
      "pattern": "\u{1F1F9}\u{1F1F7}|\u571F\u8033\u5176|Turkey|T\xFCrkiye",
      "flags": "i"
    },
    {
      "id": "AR",
      "name": "\u963F\u6839\u5EF7",
      "icon": "\u{1F1E6}\u{1F1F7}",
      "pattern": "\u{1F1E6}\u{1F1F7}|\u963F\u6839\u5EF7|Argentina",
      "flags": "i"
    },
    {
      "id": "BR",
      "name": "\u5DF4\u897F",
      "icon": "\u{1F1E7}\u{1F1F7}",
      "pattern": "\u{1F1E7}\u{1F1F7}|\u5DF4\u897F|Brazil",
      "flags": "i"
    },
    {
      "id": "OTHER",
      "name": "\u5176\u4ED6",
      "icon": "\u{1F3F3}\uFE0F",
      "pattern": ".*",
      "flags": ""
    }
  ];

  // scripts/config/proxy-groups/placeholders.js
  var placeholders_default = {
    "reserved": [
      "proxy_select",
      "manual_select",
      "auto_select"
    ],
    "fallback": "fallback",
    "placeholders": {
      "@proxy-select": {
        "kind": "ref",
        "target": "proxy_select"
      },
      "@manual-select": {
        "kind": "ref",
        "target": "manual_select"
      },
      "@auto-select": {
        "kind": "ref",
        "target": "auto_select"
      },
      "@all-nodes": {
        "kind": "context",
        "source": "allNodes"
      },
      "@region-groups": {
        "kind": "context",
        "source": "regionGroups"
      },
      "@chain-groups": {
        "kind": "context",
        "source": "chainGroups"
      }
    }
  };

  // scripts/override/lib/utils.js
  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // scripts/override/lib/proxy-groups.js
  function compileRegionPatterns(rawRegions) {
    return rawRegions.map((region) => ({
      id: region.id,
      name: region.name,
      icon: region.icon,
      pattern: new RegExp(region.pattern, region.flags || "")
    }));
  }
  var REGION_PATTERNS = compileRegionPatterns(regions_default);
  var FALLBACK_REGION = REGION_PATTERNS.at(-1);
  if (!FALLBACK_REGION || !FALLBACK_REGION.pattern.test("")) {
    throw new Error(
      "regions.yaml \u672B\u9879\u5FC5\u987B\u662F\u515C\u5E95 region\uFF08pattern \u80FD\u5339\u914D\u7A7A\u5B57\u7B26\u4E32\uFF09\uFF0C\u7528\u4E8E\u6536\u7EB3\u672A\u547D\u4E2D\u5177\u4F53\u56FD\u5BB6\u7684\u8282\u70B9"
    );
  }
  var RESERVED_GROUP_IDS = placeholders_default.reserved;
  var FALLBACK_GROUP_ID = placeholders_default.fallback;
  var PLACEHOLDERS = placeholders_default.placeholders;
  var CONTEXT_SOURCES = {
    allNodes: (context) => [...context.allProxyNames],
    regionGroups: (context) => [...context.regionGroupNames],
    chainGroups: (context) => [...context.chainGroupNames]
  };
  function getNamedProxies(proxies) {
    return proxies.filter(
      (proxy) => proxy && typeof proxy.name === "string" && proxy.name.trim().length > 0
    );
  }
  function detectRegionId(proxyName) {
    for (const region of REGION_PATTERNS) {
      if (region.pattern.test(proxyName)) {
        return region.id;
      }
    }
    return FALLBACK_REGION.id;
  }
  function classifyProxies(proxies) {
    const regionMap = {};
    for (const proxy of proxies) {
      const regionId = detectRegionId(proxy.name);
      if (!regionMap[regionId]) {
        regionMap[regionId] = [];
      }
      regionMap[regionId].push(proxy);
    }
    return regionMap;
  }
  function buildRegionGroups(proxies) {
    const regionMap = classifyProxies(proxies);
    const regionGroups = [];
    for (const region of REGION_PATTERNS) {
      const nodes = regionMap[region.id];
      if (!nodes || nodes.length === 0) {
        continue;
      }
      regionGroups.push({
        name: `${region.icon} ${region.name}`,
        type: "select",
        proxies: nodes.map((node) => node.name)
      });
    }
    return regionGroups;
  }
  function expandGroupTarget(target, context) {
    const entry = PLACEHOLDERS[target];
    if (entry) {
      if (entry.kind === "ref") {
        const referencedDefinition = context.groupDefinitions[entry.target];
        if (!referencedDefinition) {
          throw new Error(`\u5360\u4F4D\u7B26 ${target} \u5F15\u7528\u4E86\u672A\u5B9A\u4E49\u7684\u7B56\u7565\u7EC4: ${entry.target}`);
        }
        return [referencedDefinition.name];
      }
      if (entry.kind === "context") {
        const resolver = CONTEXT_SOURCES[entry.source];
        if (!resolver) {
          throw new Error(`\u5360\u4F4D\u7B26 ${target} \u5F15\u7528\u4E86\u672A\u77E5\u7684\u8FD0\u884C\u65F6\u4E0A\u4E0B\u6587: ${entry.source}`);
        }
        return resolver(context);
      }
      throw new Error(`\u5360\u4F4D\u7B26 ${target} \u7684 kind \u975E\u6CD5: ${entry.kind}`);
    }
    if (target.startsWith("@")) {
      throw new Error(`\u4E0D\u652F\u6301\u7684\u5360\u4F4D\u7B26: ${target}`);
    }
    return [target];
  }
  function buildConfiguredGroup(groupId, definition, context) {
    const proxies = [];
    for (const target of definition.proxies || []) {
      proxies.push(...expandGroupTarget(target, context));
    }
    const group = {};
    for (const [key, value] of Object.entries(definition)) {
      if (key === "category" || key === "proxies") {
        continue;
      }
      group[key] = cloneData(value);
    }
    if (!group.name) {
      throw new Error(`\u7B56\u7565\u7EC4 ${groupId} \u7F3A\u5C11 name \u5B57\u6BB5`);
    }
    if (!group.type) {
      throw new Error(`\u7B56\u7565\u7EC4 ${groupId} \u7F3A\u5C11 type \u5B57\u6BB5`);
    }
    group.proxies = proxies;
    return group;
  }
  function buildProxyGroups(proxies, groupDefinitions2, extras = {}) {
    const chainGroups = Array.isArray(extras.chainGroups) ? extras.chainGroups : [];
    const transitGroups = Array.isArray(extras.transitGroups) ? extras.transitGroups : [];
    const namedProxies = getNamedProxies(proxies);
    const allProxyNames = namedProxies.map((proxy) => proxy.name);
    const regionGroups = buildRegionGroups(namedProxies);
    const chainGroupNames = chainGroups.map((group) => group.name);
    const context = {
      allProxyNames,
      regionGroupNames: regionGroups.map((group) => group.name),
      chainGroupNames,
      groupDefinitions: groupDefinitions2
    };
    const groups = [];
    for (const groupId of RESERVED_GROUP_IDS) {
      groups.push(buildConfiguredGroup(groupId, groupDefinitions2[groupId], context));
    }
    groups.push(...chainGroups);
    groups.push(...transitGroups);
    for (const [groupId, definition] of Object.entries(groupDefinitions2)) {
      if (RESERVED_GROUP_IDS.includes(groupId) || groupId === FALLBACK_GROUP_ID) {
        continue;
      }
      groups.push(buildConfiguredGroup(groupId, definition, context));
    }
    groups.push(...regionGroups);
    groups.push(buildConfiguredGroup(FALLBACK_GROUP_ID, groupDefinitions2[FALLBACK_GROUP_ID], context));
    const seenNames = /* @__PURE__ */ new Set();
    for (const group of groups) {
      if (seenNames.has(group.name)) {
        throw new Error(`proxy-groups \u5B58\u5728\u91CD\u540D\u7EC4: ${group.name}`);
      }
      seenNames.add(group.name);
    }
    return groups;
  }

  // scripts/override/lib/rule-assembly.js
  var BUILTIN_RULE_TARGETS = /* @__PURE__ */ new Set([
    "COMPATIBLE",
    "DIRECT",
    "DNS",
    "PASS",
    "REJECT",
    "REJECT-DROP"
  ]);
  var RULE_TRAILING_OPTIONS = /* @__PURE__ */ new Set(["no-resolve"]);
  var FALLBACK_GROUP_ID2 = placeholders_default.fallback;
  function extractRuleTarget(rule) {
    const parts = rule.split(",").map((part) => part.trim());
    if (parts.length < 2) {
      throw new Error(`Prepend rule must contain a target: ${rule}`);
    }
    const lastPart = parts.at(-1);
    if (RULE_TRAILING_OPTIONS.has(lastPart.toLowerCase())) {
      if (parts.length < 3) {
        throw new Error(`Prepend rule must contain a target before trailing option: ${rule}`);
      }
      return parts.at(-2);
    }
    return lastPart;
  }
  function normalizePrependRules(inlineRules = {}, groupDefinitions2 = {}) {
    const { prependRules } = inlineRules;
    if (prependRules == null) {
      return [];
    }
    if (!Array.isArray(prependRules)) {
      throw new Error("inlineRules.prependRules must be an array");
    }
    const validGroupTargets = new Set(
      Object.values(groupDefinitions2).map((definition) => definition?.name).filter((name) => typeof name === "string" && name.length > 0)
    );
    return prependRules.map((rule, index) => {
      if (typeof rule !== "string") {
        throw new Error(`Invalid prepend rule type at index ${index}`);
      }
      const normalizedRule = rule.trim();
      if (!normalizedRule) {
        throw new Error(`Prepend rule must not be empty at index ${index}`);
      }
      if (normalizedRule.startsWith("MATCH,")) {
        throw new Error(`Prepend rule must not be MATCH at index ${index}`);
      }
      const target = extractRuleTarget(normalizedRule);
      if (!validGroupTargets.has(target) && !BUILTIN_RULE_TARGETS.has(target)) {
        throw new Error(`Prepend rule references unknown target at index ${index}: ${target}`);
      }
      return normalizedRule;
    });
  }
  function assembleRuleSet(groupDefinitions2, ruleProviders2, inlineRules) {
    const providers = {};
    const rules = normalizePrependRules(inlineRules, groupDefinitions2);
    for (const [providerId, providerDefinition] of Object.entries(ruleProviders2)) {
      const targetGroupId = providerDefinition["target-group"];
      const targetGroup = groupDefinitions2[targetGroupId];
      if (!targetGroup) {
        throw new Error(`Unknown target-group for ${providerId}: ${targetGroupId}`);
      }
      const provider = {};
      for (const [key, value] of Object.entries(providerDefinition)) {
        if (key === "target-group" || key === "no-resolve") {
          continue;
        }
        provider[key] = value;
      }
      providers[providerId] = provider;
      rules.push(
        providerDefinition["no-resolve"] ? `RULE-SET,${providerId},${targetGroup.name},no-resolve` : `RULE-SET,${providerId},${targetGroup.name}`
      );
    }
    if (!groupDefinitions2[FALLBACK_GROUP_ID2]?.name) {
      throw new Error(`Missing fallback group definition: ${FALLBACK_GROUP_ID2}`);
    }
    rules.push(`MATCH,${groupDefinitions2[FALLBACK_GROUP_ID2].name}`);
    return { providers, rules };
  }

  // scripts/config/mihomo-preset/base.js
  var base_default = {
    "mixed-port": 7897,
    "mode": "rule",
    "log-level": "info",
    "unified-delay": true,
    "tcp-concurrent": true,
    "find-process-mode": "strict"
  };

  // scripts/config/mihomo-preset/dns.js
  var dns_default = {
    "enable": true,
    "listen": "127.0.0.1:5335",
    "use-system-hosts": false,
    "use-hosts": true,
    "ipv6": false,
    "respect-rules": true,
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    "default-nameserver": [
      "223.5.5.5#DIRECT",
      "119.29.29.29#DIRECT"
    ],
    "nameserver": [
      "https://dns.alidns.com/dns-query",
      "https://doh.pub/dns-query"
    ],
    "proxy-server-nameserver": [
      "https://dns.alidns.com/dns-query",
      "https://doh.pub/dns-query"
    ],
    "direct-nameserver": [
      "https://dns.alidns.com/dns-query",
      "https://doh.pub/dns-query"
    ],
    "direct-nameserver-follow-policy": true,
    "fallback": [
      "https://cloudflare-dns.com/dns-query",
      "https://dns.google/dns-query"
    ],
    "fallback-filter": {
      "geoip": true,
      "geoip-code": "CN",
      "ipcidr": [
        "240.0.0.0/4",
        "0.0.0.0/32"
      ],
      "domain": [
        "+.google.com",
        "+.facebook.com",
        "+.twitter.com",
        "+.youtube.com",
        "+.google.cn",
        "+.googleapis.cn",
        "+.googleapis.com",
        "+.gvt1.com"
      ]
    },
    "fake-ip-filter": [
      "*.lan",
      "*.local",
      "localhost",
      "stun.*.*.*",
      "stun.*.*",
      "time.*.com",
      "ntp.*.com",
      "time.nist.gov",
      "time.asia.apple.com",
      "*.ntp.org.cn",
      "*.openwrt.pool.ntp.org",
      "*.time.edu.cn",
      "time1.cloud.tencent.com",
      "time.ustc.edu.cn",
      "pool.ntp.org",
      "localhost.ptlogin2.qq.com",
      "*.msftconnecttest.com",
      "*.msftncsi.com",
      "+.market.xiaomi.com",
      "+.music.163.com",
      "*.126.net",
      "+.steamchina.com",
      "+.steamcontent.com",
      "+.steamserver.net",
      "csgo.wmsj.cn",
      "dl.steam.clngaa.com",
      "dl.steam.ksyna.com",
      "dota2.wmsj.cn",
      "st.dl.bscstorage.net",
      "st.dl.eccdnx.com",
      "st.dl.pinyuncloud.com",
      "steampipe.steamcontent.tnkjmec.com",
      "steampowered.com.8686c.com",
      "steamstatic.com.8686c.com",
      "wmsjsteam.com",
      "xz.pphimalayanrt.com"
    ]
  };

  // scripts/config/mihomo-preset/geodata.js
  var geodata_default = {
    "geodata-mode": true,
    "geo-auto-update": true,
    "geodata-loader": "standard",
    "geo-update-interval": 24,
    "geox-url": {
      "geoip": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat",
      "geosite": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
      "mmdb": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb",
      "asn": "https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb"
    }
  };

  // scripts/config/mihomo-preset/profile.js
  var profile_default = {
    "profile": {
      "store-selected": true,
      "store-fake-ip": false
    }
  };

  // scripts/config/mihomo-preset/sniffer.js
  var sniffer_default = {
    "enable": true,
    "parse-pure-ip": true,
    "force-dns-mapping": true,
    "sniff": {
      "HTTP": {
        "ports": [
          80,
          "8080-8880"
        ],
        "override-destination": true
      },
      "QUIC": {
        "ports": [
          443,
          8443
        ]
      },
      "TLS": {
        "ports": [
          443,
          8443
        ]
      }
    },
    "override-destination": false,
    "skip-domain": [
      "+.push.apple.com"
    ],
    "skip-dst-address": [
      "91.105.192.0/23",
      "91.108.4.0/22",
      "91.108.8.0/22",
      "91.108.12.0/22",
      "91.108.16.0/22",
      "91.108.20.0/22",
      "91.108.56.0/22",
      "149.154.160.0/20",
      "185.76.151.0/24",
      "2001:67c:4e8::/48",
      "2001:b28:f23c::/48",
      "2001:b28:f23d::/48",
      "2001:b28:f23f::/48",
      "2a0a:f280::/32"
    ]
  };

  // scripts/config/mihomo-preset/tun.js
  var tun_default = {
    "enable": true,
    "stack": "mixed",
    "auto-route": true,
    "auto-detect-interface": true,
    "dns-hijack": [
      "any:53",
      "tcp://any:53"
    ],
    "strict-route": true
  };

  // scripts/override/lib/runtime-preset.js
  function applyRuntimeSection(config, section) {
    for (const [key, value] of Object.entries(section)) {
      config[key] = cloneData(value);
    }
  }
  function applyRuntimePreset(config) {
    applyRuntimeSection(config, base_default);
    applyRuntimeSection(config, profile_default);
    applyRuntimeSection(config, geodata_default);
    config.sniffer = cloneData(sniffer_default);
    config.dns = cloneData(dns_default);
    if (config["allow-lan"] === void 0) {
      config["allow-lan"] = false;
    }
    if (!config.tun) {
      config.tun = cloneData(tun_default);
    }
    return config;
  }

  // scripts/override/lib/validate-output.js
  var FALLBACK_GROUP_ID3 = placeholders_default.fallback;
  function validateOutput(config, groupDefinitions2, chainsContext = {}) {
    const proxyGroups = Array.isArray(config["proxy-groups"]) ? config["proxy-groups"] : [];
    const rules = Array.isArray(config.rules) ? config.rules : [];
    if (!groupDefinitions2[FALLBACK_GROUP_ID3]) {
      throw new Error(`\u7B56\u7565\u7EC4\u5B9A\u4E49\u4E2D\u7F3A\u5C11 fallback \u7EC4: ${FALLBACK_GROUP_ID3}`);
    }
    const fallbackName = groupDefinitions2[FALLBACK_GROUP_ID3].name;
    if (!fallbackName) {
      throw new Error(`fallback \u7B56\u7565\u7EC4\u7F3A\u5C11 name \u5B57\u6BB5: ${FALLBACK_GROUP_ID3}`);
    }
    if (!proxyGroups.length) {
      throw new Error("\u7F3A\u5C11 proxy-groups");
    }
    if (!rules.length) {
      throw new Error("\u7F3A\u5C11 rules");
    }
    const proxyGroupNames = new Set(proxyGroups.map((group) => group.name));
    const chainDefs = Array.isArray(chainsContext.chainDefinitions) ? chainsContext.chainDefinitions : [];
    const transitDefs = Array.isArray(chainsContext.transitDefinitions) ? chainsContext.transitDefinitions : [];
    if (chainDefs.length > 0 || transitDefs.length > 0) {
      const chainGroupNames = /* @__PURE__ */ new Set();
      const compiledLandingPatterns = [];
      for (const chain of chainDefs) {
        if (typeof chain?.name === "string") {
          chainGroupNames.add(chain.name);
        }
        if (typeof chain?.landing_pattern === "string" && chain.landing_pattern.length > 0) {
          try {
            compiledLandingPatterns.push(new RegExp(chain.landing_pattern, chain.flags || ""));
          } catch (error) {
            throw new Error(
              `chain_group ${chain.id} \u7684 landing_pattern \u975E\u6CD5\u6B63\u5219: ${error.message}`
            );
          }
        }
      }
      const transitGroupNames = /* @__PURE__ */ new Set();
      for (const transit of transitDefs) {
        if (typeof transit?.name === "string") {
          transitGroupNames.add(transit.name);
        }
      }
      for (const group of proxyGroups) {
        if (chainGroupNames.has(group.name)) {
          if (!Array.isArray(group.proxies) || group.proxies.length === 0) {
            throw new Error(`chain_group ${group.name} \u7684 proxies \u4E0D\u5F97\u4E3A\u7A7A`);
          }
        }
        if (transitGroupNames.has(group.name)) {
          const members = Array.isArray(group.proxies) ? group.proxies : [];
          for (const memberName of members) {
            if (typeof memberName !== "string") continue;
            if (memberName === "DIRECT") continue;
            for (const pattern of compiledLandingPatterns) {
              if (pattern.test(memberName)) {
                throw new Error(
                  `transit_group ${group.name} \u6210\u5458 ${memberName} \u547D\u4E2D landing_pattern\uFF0C\u8FDD\u53CD\u9632\u73AF\u4E0D\u53D8\u91CF`
                );
              }
            }
          }
        }
      }
    }
    for (const definition of Object.values(groupDefinitions2)) {
      if (!proxyGroupNames.has(definition.name)) {
        throw new Error(`\u7F3A\u5C11\u5DF2\u914D\u7F6E\u7684\u7B56\u7565\u7EC4: ${definition.name}`);
      }
    }
    for (const group of proxyGroups) {
      if (!Array.isArray(group.proxies) || group.proxies.length === 0) {
        throw new Error(`\u7B56\u7565\u7EC4\u8282\u70B9\u4E3A\u7A7A: ${group.name}`);
      }
      for (const target of group.proxies) {
        if (typeof target === "string" && target.startsWith("@")) {
          throw new Error(`\u7B56\u7565\u7EC4 ${group.name} \u4E2D\u5B58\u5728\u672A\u5C55\u5F00\u7684\u5360\u4F4D\u7B26: ${target}`);
        }
      }
    }
    let matchRuleFound = false;
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];
      if (typeof rule !== "string") {
        throw new Error(`\u89C4\u5219\u7C7B\u578B\u65E0\u6548\uFF08\u7D22\u5F15 ${index}\uFF09`);
      }
      if (rule.startsWith("RULE-SET,")) {
        const targetGroupName = extractRuleTarget(rule);
        if (!proxyGroupNames.has(targetGroupName)) {
          throw new Error(`RULE-SET \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u7B56\u7565\u7EC4: ${targetGroupName}`);
        }
        continue;
      }
      if (rule.startsWith("MATCH,")) {
        if (index !== rules.length - 1) {
          throw new Error("MATCH \u89C4\u5219\u5FC5\u987B\u4F4D\u4E8E\u6700\u540E\u4E00\u6761");
        }
        if (rule !== `MATCH,${fallbackName}`) {
          throw new Error(`MATCH \u89C4\u5219\u5FC5\u987B\u6307\u5411 fallback \u7B56\u7565\u7EC4: ${fallbackName}`);
        }
        matchRuleFound = true;
      }
    }
    if (!matchRuleFound) {
      throw new Error("\u7F3A\u5C11 fallback MATCH \u89C4\u5219");
    }
    const proxies = Array.isArray(config.proxies) ? config.proxies : [];
    for (const proxy of proxies) {
      const dialerTarget = proxy?.["dialer-proxy"];
      if (dialerTarget === void 0) {
        continue;
      }
      if (typeof dialerTarget !== "string" || dialerTarget.length === 0) {
        throw new Error(`proxy ${proxy?.name} \u7684 dialer-proxy \u7C7B\u578B\u975E\u6CD5`);
      }
      if (!proxyGroupNames.has(dialerTarget)) {
        throw new Error(
          `proxy ${proxy?.name} \u7684 dialer-proxy \u6307\u5411\u4E0D\u5B58\u5728\u7684\u7B56\u7565\u7EC4: ${dialerTarget}`
        );
      }
    }
  }

  // scripts/override/lib/proxy-chains.js
  function compileChainPatterns(chainDefinitions2) {
    return chainDefinitions2.map((definition) => {
      if (typeof definition.landing_pattern !== "string" || definition.landing_pattern.length === 0) {
        throw new Error(`chain_group ${definition.id} \u7F3A\u5C11\u975E\u7A7A\u7684 landing_pattern`);
      }
      try {
        return {
          definition,
          pattern: new RegExp(definition.landing_pattern, definition.flags || "")
        };
      } catch (error) {
        throw new Error(
          `chain_group ${definition.id} \u7684 landing_pattern \u975E\u6CD5\u6B63\u5219: ${error.message}`
        );
      }
    });
  }
  function assertUniqueChainIds(chainDefinitions2) {
    const seen = /* @__PURE__ */ new Set();
    for (const definition of chainDefinitions2) {
      if (typeof definition.id !== "string" || definition.id.length === 0) {
        throw new Error("chain_group \u6761\u76EE\u7F3A\u5C11\u975E\u7A7A\u7684 id");
      }
      if (seen.has(definition.id)) {
        throw new Error(`chain_group.id \u91CD\u590D: ${definition.id}`);
      }
      seen.add(definition.id);
    }
  }
  function validateChainsSchema(chainDefinitions2, transitDefinitions2) {
    if (Array.isArray(transitDefinitions2)) {
      for (const transit of transitDefinitions2) {
        if (!transit || typeof transit !== "object") continue;
        if (!Object.prototype.hasOwnProperty.call(transit, "include_direct")) continue;
        if (typeof transit.include_direct !== "boolean") {
          throw new Error(
            `transit_group ${transit.id} \u7684 include_direct \u5FC5\u987B\u662F\u5E03\u5C14`
          );
        }
      }
    }
    if (!Array.isArray(chainDefinitions2) || chainDefinitions2.length === 0) {
      return;
    }
    if (!Array.isArray(transitDefinitions2)) {
      throw new Error("transit_group \u5FC5\u987B\u662F\u6570\u7EC4");
    }
    const definedTransitIds = /* @__PURE__ */ new Set();
    for (const definition of transitDefinitions2) {
      if (typeof definition?.id === "string" && definition.id.length > 0) {
        definedTransitIds.add(definition.id);
      }
    }
    for (const chain of chainDefinitions2) {
      if (typeof chain?.entry !== "string" || chain.entry.length === 0) {
        throw new Error(`chain_group ${chain?.id} \u7F3A\u5C11\u975E\u7A7A\u7684 entry \u5B57\u6BB5`);
      }
      if (!definedTransitIds.has(chain.entry)) {
        throw new Error(
          `chain_group ${chain.id} \u7684 entry=${chain.entry} \u672A\u5728 transit_group \u4E2D\u5B9A\u4E49`
        );
      }
    }
  }
  function buildChainGroups(namedProxies, chainDefinitions2) {
    if (!Array.isArray(chainDefinitions2) || chainDefinitions2.length === 0) {
      return { chainGroups: [], remainingProxies: [...namedProxies] };
    }
    assertUniqueChainIds(chainDefinitions2);
    const compiled = compileChainPatterns(chainDefinitions2);
    const bucketsByChainId = new Map(compiled.map((entry) => [entry.definition.id, []]));
    const remainingProxies = [];
    for (const proxy of namedProxies) {
      let captured = false;
      for (const entry of compiled) {
        if (entry.pattern.test(proxy.name)) {
          if (!captured) {
            bucketsByChainId.get(entry.definition.id).push(proxy);
            captured = true;
            continue;
          }
          console.log(
            `[override] WARN: \u8282\u70B9 ${proxy.name} \u540C\u65F6\u547D\u4E2D chain_group ${entry.definition.id} \u7684 landing_pattern\uFF0C\u5DF2\u5FFD\u7565\uFF08\u9996\u4E2A\u547D\u4E2D\u7684 chain_group \u5DF2\u6355\u83B7\uFF09`
          );
        }
      }
      if (!captured) {
        remainingProxies.push(proxy);
      }
    }
    const chainGroups = [];
    for (const entry of compiled) {
      const bucket = bucketsByChainId.get(entry.definition.id);
      if (bucket.length === 0) {
        console.log(
          `[override] WARN: chain_group ${entry.definition.id} \u672A\u547D\u4E2D\u4EFB\u4F55\u8282\u70B9\uFF0C\u5DF2\u8DF3\u8FC7\u8BE5\u7EC4`
        );
        continue;
      }
      chainGroups.push({
        name: entry.definition.name,
        type: entry.definition.type,
        proxies: bucket.map((proxy) => proxy.name)
      });
    }
    return { chainGroups, remainingProxies };
  }
  function assertUniqueTransitIds(transitDefinitions2) {
    const seen = /* @__PURE__ */ new Set();
    for (const definition of transitDefinitions2) {
      if (typeof definition.id !== "string" || definition.id.length === 0) {
        throw new Error("transit_group \u6761\u76EE\u7F3A\u5C11\u975E\u7A7A\u7684 id");
      }
      if (seen.has(definition.id)) {
        throw new Error(`transit_group.id \u91CD\u590D: ${definition.id}`);
      }
      seen.add(definition.id);
    }
  }
  function compileTransitPattern(pattern, flags, transitId) {
    if (typeof pattern !== "string" || pattern.length === 0) {
      return null;
    }
    try {
      return new RegExp(pattern, flags || "");
    } catch (error) {
      throw new Error(
        `transit_group ${transitId} \u7684 transit_pattern \u975E\u6CD5\u6B63\u5219: ${error.message}`
      );
    }
  }
  function buildTransitGroups(remainingProxies, transitDefinitions2) {
    if (!Array.isArray(transitDefinitions2) || transitDefinitions2.length === 0) {
      return { groups: [], idToName: /* @__PURE__ */ new Map() };
    }
    assertUniqueTransitIds(transitDefinitions2);
    const groups = [];
    const idToName = /* @__PURE__ */ new Map();
    for (const definition of transitDefinitions2) {
      const compiledPattern = compileTransitPattern(
        definition.transit_pattern,
        definition.flags,
        definition.id
      );
      const members = compiledPattern ? remainingProxies.filter((proxy) => compiledPattern.test(proxy.name)) : [...remainingProxies];
      if (members.length === 0) {
        console.log(
          `[override] WARN: transit_group ${definition.id} \u8FC7\u6EE4\u540E\u65E0\u53EF\u7528\u8282\u70B9\uFF0C\u5DF2\u8DF3\u8FC7\u8BE5\u7EC4`
        );
        continue;
      }
      const memberNames = members.map((proxy) => proxy.name);
      if (definition.include_direct === true) {
        if (definition.type === "url-test") {
          console.log(
            `[override] WARN: transit_group ${definition.id} \u4E3A url-test\uFF0C\u5FFD\u7565 include_direct=true`
          );
        } else {
          memberNames.push("DIRECT");
        }
      }
      groups.push({
        name: definition.name,
        type: definition.type,
        proxies: memberNames
      });
      idToName.set(definition.id, definition.name);
    }
    return { groups, idToName };
  }
  function applyProxyChains(config, chainDefinitions2, transitIdToName) {
    if (!Array.isArray(chainDefinitions2) || chainDefinitions2.length === 0) {
      return;
    }
    const proxies = Array.isArray(config.proxies) ? config.proxies : [];
    for (const chain of chainDefinitions2) {
      const transitName = transitIdToName.get(chain.entry);
      if (!transitName) {
        console.log(
          `[override] WARN: chain ${chain.id} \u7684 entry=${chain.entry} \u672A\u627E\u5230\u5DF2\u6784\u5EFA\u7684 transit_group\uFF0C\u8DF3\u8FC7\u6CE8\u5165`
        );
        continue;
      }
      let pattern;
      try {
        pattern = new RegExp(chain.landing_pattern, chain.flags || "");
      } catch (error) {
        throw new Error(
          `chain ${chain.id} \u7684 landing_pattern \u975E\u6CD5\u6B63\u5219: ${error.message}`
        );
      }
      for (const proxy of proxies) {
        if (typeof proxy?.name !== "string" || !pattern.test(proxy.name)) {
          continue;
        }
        if (proxy["dialer-proxy"] !== void 0) {
          console.log(
            `[override] WARN: \u8282\u70B9 ${proxy.name} \u5DF2\u6709 dialer-proxy=${proxy["dialer-proxy"]}\uFF0C\u4FDD\u7559\u539F\u503C\u4E0D\u8986\u76D6`
          );
          continue;
        }
        proxy["dialer-proxy"] = transitName;
      }
    }
  }

  // scripts/override/main.js
  var { ruleProviders } = ruleProviders_default;
  var { groupDefinitions } = groupDefinitions_default;
  var transitDefinitions = Array.isArray(chains_default.transit_group) ? chains_default.transit_group : [];
  var chainDefinitions = Array.isArray(chains_default.chain_group) ? chains_default.chain_group : [];
  validateChainsSchema(chainDefinitions, transitDefinitions);
  function main(config = {}) {
    const workingConfig = config && typeof config === "object" ? config : {};
    const proxies = Array.isArray(workingConfig.proxies) ? workingConfig.proxies : [];
    const namedProxies = getNamedProxies(proxies);
    applyRuntimePreset(workingConfig);
    if (namedProxies.length === 0) {
      console.log("[override] ERROR: config.proxies \u4E3A\u7A7A\uFF0C\u65E0\u6CD5\u751F\u6210\u7B56\u7565\u7EC4\u548C\u5206\u6D41\u89C4\u5219");
      console.log("[override] \u5DF2\u5E94\u7528 runtime preset\uFF0C\u8DF3\u8FC7 proxy-groups\u3001rule-providers \u548C rules \u751F\u6210");
      return workingConfig;
    }
    const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, chainDefinitions);
    const { groups: transitGroups, idToName: transitIdToName } = buildTransitGroups(
      remainingProxies,
      transitDefinitions
    );
    const chainsEffective = transitGroups.length > 0 && chainGroups.length > 0;
    workingConfig["proxy-groups"] = buildProxyGroups(remainingProxies, groupDefinitions, {
      chainGroups: chainsEffective ? chainGroups : [],
      transitGroups: chainsEffective ? transitGroups : []
    });
    if (chainsEffective) {
      applyProxyChains(workingConfig, chainDefinitions, transitIdToName);
    }
    const { providers, rules } = assembleRuleSet(groupDefinitions, ruleProviders, inlineRules_default);
    workingConfig["rule-providers"] = providers;
    workingConfig.rules = rules;
    validateOutput(workingConfig, groupDefinitions, { chainDefinitions, transitDefinitions });
    return workingConfig;
  }
  return __toCommonJS(main_exports);
})();

if (typeof globalThis !== "undefined" && __proxyConfigHub && typeof __proxyConfigHub.main === "function") {
  globalThis.main = __proxyConfigHub.main;
}
if (typeof module !== "undefined" && module && module.exports && __proxyConfigHub && typeof __proxyConfigHub.main === "function") {
  module.exports = { main: __proxyConfigHub.main };
}

