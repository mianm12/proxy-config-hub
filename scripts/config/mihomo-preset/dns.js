export default {
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
