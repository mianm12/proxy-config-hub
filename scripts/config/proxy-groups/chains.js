export default {
  "transit_group": [
    {
      "id": "transit",
      "name": "🔀 中转",
      "transit_pattern": "Transit|中转|自建",
      "flags": "i",
      "type": "select",
      "include_direct": true
    }
  ],
  "chain_group": [
    {
      "id": "landing",
      "name": "🚪 落地",
      "landing_pattern": "Relay|落地|^(?=.*直连)(?=.*家宽)",
      "flags": "i",
      "type": "select",
      "entry": "transit"
    }
  ]
};
