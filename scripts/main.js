import { DATA_URL, PLANNER_URL, LOCAL_ASSET_BASE, EXCLUDED_UNIT_NAMES, fallbackItems } from "./data.js";
import { slugify, assetPathToUrl, applyImageFallback } from "./utils.js";
import { state, persistState, getActivePath, createBlankPath, mergePaths, buildPlannerCode } from "./state.js";
import { elements, renderAll, renderGallery, renderHeaderAndFlowchart, renderRoster, renderViewer, setBenchSearch, drawConnections } from "./render.js";

window.__tftFallbackImage = (event, label) => {
  applyImageFallback(event.target, label);
};
window.__tftState = state;

boot();

function boot() {
  bindEvents();
  renderAll();
  loadLiveSetData();
  window.addEventListener("resize", () => {
    const activePath = getActivePath();
    drawConnections(activePath ? activePath.stages.length : 0);
  });

  [elements.flowchartCanvas, elements.viewerFlowchart].forEach((canvas) => {
    canvas.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-export-stage]");
      if (!btn) return;
      event.stopPropagation();
      const path = getActivePath();
      if (!path) return;
      const stage = path.stages[Number(btn.getAttribute("data-export-stage"))];
      if (!stage?.units.length) return;
      const code = buildPlannerCode(stage.units, stage.items);
      navigator.clipboard.writeText(code).then(() => {
        const prev = btn.textContent;
        btn.textContent = "✓";
        setTimeout(() => { btn.textContent = prev; }, 1500);
      });
    });
  });
}

function openViewer(pathId) {
  const path = state.paths.find((p) => p.id === pathId) || state.paths[0];
  if (!path) return;
  state.activePathId = path.id;
  elements.viewerEditButton.dataset.pathId = path.id;
  elements.viewerDuplicateButton.dataset.pathId = path.id;
  elements.viewerDeleteButton.dataset.pathId = path.id;
  elements.viewerOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  renderViewer(path);
}

function closeViewer() {
  elements.viewerOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

function openEditor(pathId) {
  if (pathId) state.activePathId = pathId;
  closeViewer();
  state.editorOpen = true;
  document.getElementById("editor-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
  renderHeaderAndFlowchart();
  renderRoster();
}

function closeEditor() {
  state.editorOpen = false;
  document.getElementById("editor-overlay").classList.remove("open");
  document.body.style.overflow = "";
  renderGallery();
}

function bindEvents() {
  document.getElementById("new-path-button").addEventListener("click", () => {
    const newPath = createBlankPath();
    state.paths.unshift(newPath);
    persistState();
    openEditor(newPath.id);
  });

  document.getElementById("duplicate-path-button").addEventListener("click", () => {
    const activePath = getActivePath();
    if (!activePath) return;
    const duplicate = {
      ...structuredClone(activePath),
      id: `custom-${crypto.randomUUID()}`,
      source: "custom",
      name: `${activePath.name} Copy`,
    };
    state.paths.unshift(duplicate);
    state.activePathId = duplicate.id;
    persistState();
    renderAll();
  });

  document.getElementById("active-path-name").addEventListener("input", (event) => {
    const activePath = getActivePath();
    if (!activePath) return;
    activePath.name = event.currentTarget.value;
    persistState();
  });

  document.getElementById("close-editor-button").addEventListener("click", closeEditor);

  document.getElementById("delete-line-button").addEventListener("click", () => {
    const activePath = getActivePath();
    if (!activePath || activePath.source !== "custom") return;
    state.paths = state.paths.filter((p) => p.id !== activePath.id);
    state.activePathId = state.paths.length ? state.paths[0].id : null;
    persistState();
    closeEditor();
  });

  document.getElementById("export-button").addEventListener("click", exportPaths);
  document.getElementById("import-input").addEventListener("change", importPaths);

  document.getElementById("gallery-search").addEventListener("input", (event) => {
    renderGallery(event.currentTarget.value.trim());
  });

  document.getElementById("bench-search").addEventListener("input", (event) => {
    setBenchSearch(event.currentTarget.value.trim());
  });

  // Close overlay when clicking the backdrop (outside the sheet)
  document.getElementById("editor-overlay").addEventListener("click", (event) => {
    if (event.target === document.getElementById("editor-overlay")) {
      closeEditor();
    }
  });

  document.getElementById("viewer-overlay").addEventListener("click", (event) => {
    if (event.target === document.getElementById("viewer-overlay")) {
      closeViewer();
    }
  });

  document.getElementById("close-viewer-button").addEventListener("click", closeViewer);

  document.getElementById("viewer-edit-button").addEventListener("click", () => {
    const pathId = elements.viewerEditButton.dataset.pathId;
    openEditor(pathId);
  });

  document.getElementById("viewer-duplicate-button").addEventListener("click", () => {
    const pathId = elements.viewerDuplicateButton.dataset.pathId;
    const source = state.paths.find((p) => p.id === pathId);
    if (!source) return;
    const duplicate = {
      ...structuredClone(source),
      id: `custom-${crypto.randomUUID()}`,
      source: "custom",
      name: `${source.name} Copy`,
    };
    state.paths.unshift(duplicate);
    state.activePathId = duplicate.id;
    persistState();
    closeViewer();
    renderGallery();
  });

  document.getElementById("viewer-delete-button").addEventListener("click", () => {
    const path = state.paths.find((p) => p.id === elements.viewerDeleteButton.dataset.pathId);
    if (!path || path.source !== "custom") return;
    state.paths = state.paths.filter((p) => p.id !== path.id);
    state.activePathId = state.paths.length ? state.paths[0].id : null;
    persistState();
    closeViewer();
    renderGallery();
  });

  // Custom events dispatched by render.js
  document.addEventListener("open-viewer", (event) => openViewer(event.detail?.pathId));
  document.addEventListener("open-editor", (event) => openEditor(event.detail?.pathId));
  document.addEventListener("close-editor", () => closeEditor());

  document.addEventListener("duplicate-path", (event) => {
    const source = state.paths.find((p) => p.id === event.detail?.pathId);
    if (!source) return;
    const duplicate = {
      ...structuredClone(source),
      id: `custom-${crypto.randomUUID()}`,
      source: "custom",
      name: `${source.name} Copy`,
    };
    state.paths.unshift(duplicate);
    state.activePathId = duplicate.id;
    persistState();
    openEditor(duplicate.id);
  });

  document.addEventListener("delete-path", (event) => {
    const path = state.paths.find((p) => p.id === event.detail?.pathId);
    if (!path || path.source !== "custom") return;
    state.paths = state.paths.filter((p) => p.id !== path.id);
    state.activePathId = state.paths.length ? state.paths[0].id : null;
    persistState();
    renderGallery();
  });
}

function exportPaths() {
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), paths: state.paths }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tft-set17-flowcharts.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importPaths(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedPaths = mergePaths(parsed.paths || []);
    if (!importedPaths.length) {
      throw new Error("No valid paths found in imported file.");
    }
    state.paths = importedPaths;
    state.activePathId = importedPaths[0].id;
    persistState();
    closeEditor();
  } catch (error) {
    alert(error.message || "Unable to import JSON.");
  } finally {
    event.target.value = "";
  }
}

async function loadLiveSetData() {
  try {
    const [mainResponse, champsResponse] = await Promise.all([
      fetch(DATA_URL),
      fetch(PLANNER_URL),
    ]);
    if (!mainResponse.ok) throw new Error(`Unexpected status ${mainResponse.status}`);

    const data = await mainResponse.json();
    const allRawItems = data?.items ?? [];
    const liveUnits = normalizeUnits(data?.sets?.["17"]?.champions ?? []);
    const liveItems = normalizeItems(allRawItems);
    const liveAugments = normalizeAugments(allRawItems, data?.sets?.["17"]?.augments ?? []);
    const liveTraits = normalizeTraits(data?.sets?.["17"]?.traits ?? []);

    if (champsResponse.ok) {
      const champsData = await champsResponse.json();
      const set17Entries = champsData?.TFTSet17 ?? [];
      const plannerIndex = new Map(
        set17Entries.map((entry) => [entry.display_name.toLowerCase(), entry.team_planner_code])
      );
      for (const unit of liveUnits) {
        const code = plannerIndex.get(unit.name.toLowerCase());
        if (code !== undefined) unit.plannerId = code;
      }
    }

    if (liveUnits.length) state.units = liveUnits;
    if (liveItems.length) state.items = liveItems;
    if (liveAugments.length) state.augments = liveAugments;
    state.traits = liveTraits;

    elements.dataStatus.textContent = "Live Set 17 data loaded";
    renderAll();
  } catch (error) {
    console.error(error);
    elements.dataStatus.textContent = "Using local fallback data";
    renderAll();
  }
}

function buildUnitImageSources(unit) {
  return {
    local: `${LOCAL_ASSET_BASE}/units/${slugify(unit.name)}.png`,
    remote: assetPathToUrl(unit.squareIcon || unit.icon),
  };
}

function buildItemImageSources(item) {
  return {
    local: `${LOCAL_ASSET_BASE}/items/${slugify(item.name)}.png`,
    remote: assetPathToUrl(item.icon),
  };
}

function buildAugmentImageSources(aug) {
  return {
    local: `${LOCAL_ASSET_BASE}/augments/${slugify(aug.name)}.png`,
    remote: assetPathToUrl(aug.icon),
  };
}

function normalizeUnits(units) {
  return units
    .filter(
      (unit) =>
        unit &&
        unit.name &&
        typeof unit.cost === "number" &&
        unit.cost >= 1 &&
        unit.cost <= 5 &&
        !EXCLUDED_UNIT_NAMES.has(unit.name.toLowerCase()),
    )
    .map((unit) => ({
      name: unit.name,
      cost: unit.cost,
      traits: Array.isArray(unit.traits) ? unit.traits : [],
      imageUrl: buildUnitImageSources(unit),
      apiName: unit.apiName || "",
      plannerId: null,
    }));
}

function isCurrentSetItem(apiName) {
  // Timeless items use the unprefixed "TFT_Item_*" namespace
  if (/^TFT_Item_/i.test(apiName)) return true;
  // Set 17 specific items (radiant, artifact, support variants)
  if (/^TFTSet17_/i.test(apiName) || /^TFT17_/i.test(apiName)) return true;
  return false;
}

const KNOWN_COMPONENTS = new Set(fallbackItems.map((i) => i.name));

function classifyItem(item) {
  const apiName = item.apiName || "";
  const name = item.name || "";
  if (/augment/i.test(apiName)) return null;
  if (!isCurrentSetItem(apiName)) return null;
  if (/radiant/i.test(apiName)) return "radiant";
  if (/artifact/i.test(apiName)) return "artifact";
  if (Array.isArray(item.composition) && item.composition.length === 2) {
    return /emblem/i.test(name) ? "emblem" : "completed";
  }
  // Use an explicit allowlist for components — composition.length===0 matches
  // too many non-item entries (consumables, champion items, etc.)
  if (KNOWN_COMPONENTS.has(name)) return "component";
  return null;
}

function normalizeItems(items) {
  const seenNames = new Set();
  const categoryOrder = { component: 0, completed: 1, emblem: 2, radiant: 3, artifact: 4 };

  return items
    .filter((item) => {
      if (!item?.name || !item.icon || seenNames.has(item.name)) return false;
      if (!classifyItem(item)) return false;
      seenNames.add(item.name);
      return true;
    })
    .map((item) => ({
      name: item.name,
      category: classifyItem(item),
      imageUrl: buildItemImageSources(item),
      plannerId: typeof item.id === "number" ? item.id : null,
    }))
    .sort((a, b) => {
      const orderDiff = (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
      return orderDiff || a.name.localeCompare(b.name);
    });
}

function isCurrentSetAugment(apiName, iconPath) {
  if (!/augment/i.test(apiName)) return false;
  // Explicitly Set 17 — always include
  if (/^TFTSet17_/i.test(apiName) || /^TFT17_/i.test(apiName)) return true;
  // Generic TFT_Augment_* entries appear across many sets. Use the icon asset
  // path to distinguish: paths containing an old-set folder (tftset10, tftset15,
  // etc.) belong to that set; no set folder or tftset17 means current/valid.
  if (/^TFT_Augment_/i.test(apiName)) {
    const setInIcon = (iconPath || "").match(/tftset(\d+)/i);
    if (setInIcon) return Number(setInIcon[1]) === 17;
    return true; // no set-specific folder → treat as valid
  }
  return false;
}

function normalizeAugments(allItems, setAugments) {
  const seenNames = new Set();
  const results = [];

  for (const aug of setAugments) {
    if (!aug?.name || !aug.icon || seenNames.has(aug.name)) continue;
    seenNames.add(aug.name);
    results.push({ name: aug.name, imageUrl: buildAugmentImageSources(aug) });
  }

  for (const item of allItems) {
    const apiName = item.apiName || "";
    if (!item?.name || !item.icon || seenNames.has(item.name)) continue;
    if (!isCurrentSetAugment(apiName, item.icon)) continue;
    seenNames.add(item.name);
    results.push({ name: item.name, imageUrl: buildAugmentImageSources(item) });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeTraits(traits) {
  return traits.reduce((traitIndex, trait) => {
    if (!trait || !trait.name) {
      return traitIndex;
    }

    const effects = Array.isArray(trait.effects)
      ? trait.effects
          .map((effect) => ({
            minUnits: Number(effect.minUnits),
            style: Number(effect.style) || 0,
          }))
          .filter((effect) => Number.isFinite(effect.minUnits) && effect.minUnits > 0)
          .sort((left, right) => left.minUnits - right.minUnits)
      : [];

    traitIndex[trait.name] = {
      name: trait.name,
      effects: effects.filter(
        (effect, index, list) => list.findIndex((entry) => entry.minUnits === effect.minUnits) === index,
      ),
    };
    return traitIndex;
  }, {});
}
