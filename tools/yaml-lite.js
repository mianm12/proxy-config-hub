"use strict";

const fs = require("node:fs");

function stripInlineComment(rawLine) {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < rawLine.length; index += 1) {
    const char = rawLine[index];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === "\"" && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      return rawLine.slice(0, index).trimEnd();
    }
  }

  return rawLine.trimEnd();
}

function parseScalar(rawValue) {
  const trimmed = rawValue.trim();

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseSourcesYaml(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sources = [];
  let inSourcesBlock = false;
  let currentItem = null;

  for (const rawLine of lines) {
    const line = stripInlineComment(rawLine);
    if (!line.trim()) {
      continue;
    }

    if (!inSourcesBlock) {
      if (line.trim() === "sources:") {
        inSourcesBlock = true;
      }

      continue;
    }

    const itemStart = line.match(/^  - ([^:]+):\s*(.+)$/);
    if (itemStart) {
      if (currentItem) {
        sources.push(currentItem);
      }

      currentItem = {
        [itemStart[1].trim()]: parseScalar(itemStart[2])
      };
      continue;
    }

    const field = line.match(/^    ([^:]+):\s*(.+)$/);
    if (field && currentItem) {
      currentItem[field[1].trim()] = parseScalar(field[2]);
      continue;
    }

    throw new Error(`Unsupported YAML structure in sources.yaml: ${rawLine}`);
  }

  if (currentItem) {
    sources.push(currentItem);
  }

  return { sources };
}

function parseRulePayloadYaml(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const payload = [];
  let inPayloadBlock = false;

  for (const rawLine of lines) {
    const line = stripInlineComment(rawLine);
    if (!line.trim()) {
      continue;
    }

    if (!inPayloadBlock) {
      if (line.trim() === "payload:") {
        inPayloadBlock = true;
      }

      continue;
    }

    const item = line.match(/^  - (.+)$/);
    if (item) {
      payload.push(parseScalar(item[1]));
      continue;
    }

    throw new Error(`Unsupported YAML structure in rule file: ${rawLine}`);
  }

  return { payload };
}

function loadSourcesFromFile(filePath) {
  return parseSourcesYaml(fs.readFileSync(filePath, "utf8"));
}

function loadRulePayloadFromFile(filePath) {
  return parseRulePayloadYaml(fs.readFileSync(filePath, "utf8"));
}

function isPlainYamlKey(key) {
  return /^[A-Za-z0-9_-]+$/.test(key);
}

function renderInlineYamlValue(value) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value) && value.length === 0) {
    return "[]";
  }

  if (value && typeof value === "object" && Object.keys(value).length === 0) {
    return "{}";
  }

  return null;
}

function stringifyYaml(value, indentLevel = 0) {
  const indent = " ".repeat(indentLevel);
  const inlineValue = renderInlineYamlValue(value);

  if (inlineValue !== null) {
    return `${indent}${inlineValue}`;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const inlineItem = renderInlineYamlValue(item);
        if (inlineItem !== null) {
          return `${indent}- ${inlineItem}`;
        }

        return `${indent}-\n${stringifyYaml(item, indentLevel + 2)}`;
      })
      .join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => {
        const renderedKey = isPlainYamlKey(key) ? key : JSON.stringify(key);
        const inlineNestedValue = renderInlineYamlValue(nestedValue);

        if (inlineNestedValue !== null) {
          return `${indent}${renderedKey}: ${inlineNestedValue}`;
        }

        return `${indent}${renderedKey}:\n${stringifyYaml(nestedValue, indentLevel + 2)}`;
      })
      .join("\n");
  }

  throw new Error(`Unsupported YAML value type: ${typeof value}`);
}

module.exports = {
  loadRulePayloadFromFile,
  loadSourcesFromFile,
  parseRulePayloadYaml,
  parseSourcesYaml,
  stringifyYaml
};
