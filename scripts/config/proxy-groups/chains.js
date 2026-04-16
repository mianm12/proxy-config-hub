export default {
  "transit_group": [
    {
      "id": "transit",
      "name": "🔀 中转",
      "transit_pattern": "自建",
      "flags": "i",
      "type": "select"
    }
  ],
  "chain_group": [
    {
      "id": "landing",
      "name": "🚪 落地",
      "landing_pattern": "Relay|落地",
      "flags": "i",
      "type": "select",
      "entry": "transit"
    }
  ]
};
