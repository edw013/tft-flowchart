import { STORAGE_KEY, LOCAL_ASSET_BASE, fallbackUnits, fallbackItems, seededPaths } from "./data.js";
import { slugify, createTextAvatar } from "./utils.js";

function enrichFallbackUnit(unit) {
  return {
    ...unit,
    imageUrl: {
      local: `${LOCAL_ASSET_BASE}/units/${slugify(unit.name)}.png`,
      remote: createTextAvatar(unit.name),
    },
  };
}

function enrichFallbackItem(item) {
  return {
    ...item,
    imageUrl: {
      local: `${LOCAL_ASSET_BASE}/items/${slugify(item.name)}.png`,
      remote: createTextAvatar(item.name),
    },
  };
}

export const state = {
  units: fallbackUnits.map(enrichFallbackUnit),
  items: fallbackItems.map(enrichFallbackItem),
  traits: {},
  augments: [],
  paths: hydrateStoredPaths(),
  activePathId: null,
  dragPayload: null,
  editorOpen: false,
};

function hydrateStoredPaths() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(seededPaths);
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.paths)) {
      return structuredClone(seededPaths);
    }

    const merged = mergePaths(parsed.paths).filter((p) => p.source !== "template");
    return merged;
  } catch {
    return structuredClone(seededPaths);
  }
}

export function mergePaths(savedPaths) {
  const templateMap = new Map(seededPaths.map((path) => [path.id, structuredClone(path)]));
  const merged = [];

  for (const savedPath of savedPaths) {
    if (!savedPath || !savedPath.id || !Array.isArray(savedPath.stages)) {
      continue;
    }

    if (savedPath.source === "template" && templateMap.has(savedPath.id)) {
      merged.push({ ...templateMap.get(savedPath.id), ...savedPath });
      templateMap.delete(savedPath.id);
      continue;
    }

    merged.push(savedPath);
  }

  for (const template of templateMap.values()) {
    merged.push(template);
  }

  return merged;
}

export function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ paths: state.paths }));
}

export function getActivePath() {
  return state.paths.find((path) => path.id === state.activePathId) || state.paths[0] || null;
}

export function createBlankPath() {
  return {
    id: `custom-${crypto.randomUUID()}`,
    source: "custom",
    name: "New Line",
    summary: "Describe the opener, pivot point, and final board you want to build.",
    notes: "Use the stage cards below to define how the board transitions over time.",
    startingUnits: [],
    startingItems: [],
    tags: ["Custom"],
    stages: [
      { label: "2-1 Opener", units: [], items: [], notes: "Add your early board here." },
      { label: "3-5 Stabilize", units: [], items: [], notes: "Describe your level 6 or 7 bridge board." },
      { label: "Endgame Board", units: [], items: [], notes: "Add your capped board and carry item holder." },
    ],
  };
}

export function findUnit(name) {
  return state.units.find((unit) => unit.name.toLowerCase() === name.toLowerCase());
}

export function findItem(name) {
  return state.items.find((item) => item.name.toLowerCase() === name.toLowerCase());
}

export function buildPlannerCode(unitNames) {
  // Format: "02" + 10 × 3-nibble slots + "TFTSet17"
  // Each slot = [4-bit board position (0)][8-bit champion ID] = 3 hex chars
  const SLOTS = 10;
  let hex = "02";
  for (let i = 0; i < SLOTS; i++) {
    const name = unitNames[i];
    if (name) {
      const unit = state.units.find((u) => u.name.toLowerCase() === name.toLowerCase());
      const id = unit?.plannerId ?? 0;
      hex += id.toString(16).padStart(3, "0");
    } else {
      hex += "000";
    }
  }
  return hex + "TFTSet17";
}
