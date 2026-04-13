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
    "tls://8.8.4.4",
    "tls://1.1.1.1",
    "https://cloudflare-dns.com/dns-query",
    "https://dns.google/dns-query"
  ],
  "fallback-filter": {
    "geoip": true,
    "geoip-code": "CN",
    "ipcidr": [
      "240.0.0.0/4",
      "0.0.0.0/32",
      "127.0.0.1/32"
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
    "time1.cloud.tencent.com",
    "time.ustc.edu.cn",
    "pool.ntp.org",
    "+.music.163.com",
    "*.126.net",
    "localhost.ptlogin2.qq.com",
    "*.msftconnecttest.com",
    "*.msftncsi.com",
    "+.market.xiaomi.com"
  ]
};
