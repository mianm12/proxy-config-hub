"use strict";

const { applyDnsConfig } = require("../_lib/dns-preset");

function main(config) {
  const workingConfig = config && typeof config === "object" ? config : {};
  applyDnsConfig(workingConfig);
  return workingConfig;
}

if (typeof module !== "undefined") {
  module.exports = { main };
}
