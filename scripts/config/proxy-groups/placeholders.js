export default {
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
