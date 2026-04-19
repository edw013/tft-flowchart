import { state, getActivePath, findUnit, findItem, persistState } from "./state.js";
import { escapeHtml, escapeAttribute, createImageMarkup, compareUnits } from "./utils.js";
import { EXCLUDED_UNIT_NAMES } from "./data.js";

export const elements = {
  flowchartCanvas: document.getElementById("flowchart-canvas"),
  rosterGrid: document.getElementById("roster-grid"),
  activePathName: document.getElementById("active-path-name"),
  activePathSummary: document.getElementById("active-path-summary"),
  dataStatus: document.getElementById("data-status"),
  pathsGrid: document.getElementById("paths-grid"),
  deleteLineButton: document.getElementById("delete-line-button"),
  viewerOverlay: document.getElementById("viewer-overlay"),
  viewerFlowchart: document.getElementById("viewer-flowchart"),
  viewerPathName: document.getElementById("viewer-path-name"),
  viewerPathSummary: document.getElementById("viewer-path-summary"),
  viewerEditButton: document.getElementById("viewer-edit-button"),
  viewerDuplicateButton: document.getElementById("viewer-duplicate-button"),
  viewerDeleteButton: document.getElementById("viewer-delete-button"),
};

export function renderAll() {
  renderGallery();
  renderHeaderAndFlowchart();
  renderRoster();
}

export function renderGallery(query = "") {
  if (!elements.pathsGrid) return;

  const q = query.toLowerCase().trim();
  const filtered = q
    ? state.paths.filter(
        (path) =>
          path.name.toLowerCase().includes(q) ||
          (path.summary || "").toLowerCase().includes(q) ||
          (path.notes || "").toLowerCase().includes(q) ||
          (path.tags || []).some((tag) => tag.toLowerCase().includes(q)),
      )
    : state.paths;

  if (!filtered.length) {
    elements.pathsGrid.innerHTML = `<p class="gallery-empty">No lines match "${escapeHtml(query)}".</p>`;
    return;
  }

  elements.pathsGrid.innerHTML = "";

  for (const path of filtered) {
    const row = document.createElement("article");
    row.className = "line-row";
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.dataset.pathId = path.id;

    const isCustom = path.source === "custom";
    const previewStages = path.stages.slice(0, 3);

    const nodePreviewsHtml = previewStages
      .map((stage) => {
        const unitIconsHtml = stage.units
          .slice(0, 8)
          .map((unitName) => {
            const unit = findUnit(unitName);
            const costAttr = unit?.cost ? ` data-cost="${unit.cost}"` : "";
            return `<span class="preview-unit-wrap"${costAttr}>${createImageMarkup(unit, unitName, "preview-unit")}</span>`;
          })
          .join("");
        const itemIconsHtml = stage.items
          .slice(0, 4)
          .map((itemName) => createImageMarkup(findItem(itemName), itemName, "preview-item"))
          .join("");
        return `
          <div class="line-node-preview">
            <span class="line-node-preview-label">${escapeHtml(stage.label)}</span>
            ${unitIconsHtml ? `<div class="line-node-preview-portraits">${unitIconsHtml}</div>` : ""}
            ${itemIconsHtml ? `<div class="line-node-preview-items">${itemIconsHtml}</div>` : ""}
            ${!unitIconsHtml && !itemIconsHtml ? `<span class="line-node-preview-empty">Empty</span>` : ""}
          </div>
        `;
      })
      .join("");

    const tagsHtml = (path.tags || [])
      .map((tag) => `<span class="path-tag">${escapeHtml(tag)}</span>`)
      .join("");

    const deleteAction = isCustom
      ? `<button type="button" class="button ghost compact-button danger" data-delete-card="${escapeAttribute(path.id)}">Delete</button>`
      : "";

    row.innerHTML = `
      <div class="line-row-info">
        <p class="line-row-name">${escapeHtml(path.name)}</p>
        ${tagsHtml ? `<div class="line-row-tags">${tagsHtml}</div>` : ""}
      </div>
      <div class="line-row-nodes">${nodePreviewsHtml}</div>
      <div class="line-row-actions">
        <button type="button" class="button ghost compact-button" data-edit-card="${escapeAttribute(path.id)}">Edit</button>
        <button type="button" class="button ghost compact-button" data-duplicate-card="${escapeAttribute(path.id)}">Duplicate</button>
        ${deleteAction}
      </div>
    `;

    row.addEventListener("click", (event) => {
      if (event.target.closest("[data-delete-card], [data-duplicate-card], [data-edit-card]")) return;
      document.dispatchEvent(new CustomEvent("open-viewer", { detail: { pathId: path.id } }));
    });

    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        document.dispatchEvent(new CustomEvent("open-viewer", { detail: { pathId: path.id } }));
      }
    });

    elements.pathsGrid.append(row);
  }

  elements.pathsGrid.querySelectorAll("[data-edit-card]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      document.dispatchEvent(
        new CustomEvent("open-editor", { detail: { pathId: btn.getAttribute("data-edit-card") } }),
      );
    });
  });

  elements.pathsGrid.querySelectorAll("[data-duplicate-card]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      document.dispatchEvent(
        new CustomEvent("duplicate-path", { detail: { pathId: btn.getAttribute("data-duplicate-card") } }),
      );
    });
  });

  elements.pathsGrid.querySelectorAll("[data-delete-card]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      document.dispatchEvent(
        new CustomEvent("delete-path", { detail: { pathId: btn.getAttribute("data-delete-card") } }),
      );
    });
  });
}

export function renderHeaderAndFlowchart() {
  const activePath = getActivePath();

  if (!activePath) {
    elements.activePathName.value = "";
    elements.activePathName.placeholder = "Select a line";
    elements.activePathSummary.textContent = "Choose a suggestion or create a blank flowchart.";
    if (elements.deleteLineButton) elements.deleteLineButton.classList.add("hidden");
    renderEmptyFlowchart();
    return;
  }

  elements.activePathName.value = activePath.name;
  elements.activePathName.placeholder = "Line name…";
  elements.activePathSummary.textContent = activePath.summary || activePath.notes || "No summary yet.";
  if (elements.deleteLineButton) {
    elements.deleteLineButton.classList.toggle("hidden", activePath.source !== "custom");
  }
  renderFlowchart(activePath);
}

function renderEmptyFlowchart(canvas = elements.flowchartCanvas) {
  canvas.classList.add("empty-state");
  canvas.innerHTML = "<p>Your flowchart will render here.</p>";
}

function renderFlowchart(path, { canvas = elements.flowchartCanvas, readonly = false } = {}) {
  if (!path.stages.length) {
    renderEmptyFlowchart(canvas);
    return;
  }

  canvas.classList.remove("empty-state");

  const layout = document.createElement("div");
  layout.className = "flowchart-layout";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("flowchart-lines");

  path.stages.forEach((stage, index) => {
    const stageColumn = document.createElement("section");
    stageColumn.className = "flow-stage";
    stageColumn.dataset.index = String(index);

    if (readonly) {
      stageColumn.innerHTML = `
        <div class="stage-heading-row">
          <span class="stage-heading-text">${escapeHtml(stage.label)}</span>
          <button class="icon-button" type="button" data-export-stage="${index}" title="Copy planner code">↗</button>
        </div>
      `;
    } else {
      stageColumn.innerHTML = `
        <div class="stage-heading-row">
          <input class="stage-heading-input" data-stage-index="${index}" type="text" maxlength="48" value="${escapeAttribute(stage.label)}" />
          <button class="icon-button" type="button" data-export-stage="${index}" title="Copy planner code">↗</button>
          <button class="icon-button" type="button" data-clone-stage="${index}" title="Clone stage">+</button>
          <button class="icon-button danger" type="button" data-remove-stage="${index}" title="Remove stage">×</button>
        </div>
      `;
    }

    const node = document.createElement("article");
    node.className = "flow-node";
    node.id = `flow-node-${index}`;
    if (!readonly) node.setAttribute("data-drop-stage-any", String(index));

    const unitsHtml = stage.units.map((unitName) => createPortraitMarkup(unitName, "unit", readonly)).join("");
    const itemsHtml = stage.items.map((itemName) => createPortraitMarkup(itemName, "item", readonly)).join("");

    const hasUnits = stage.units.length > 0;
    const hasItems = stage.items.length > 0;
    const bothEmpty = !hasUnits && !hasItems;

    const unitsSection = (hasUnits || bothEmpty) ? `
      <div>
        <p class="stage-note">Units</p>
        <div class="portrait-row">${unitsHtml || (!readonly ? "<span class='empty-portrait-state'>Drop units anywhere in the node</span>" : "")}</div>
      </div>
    ` : "";

    const itemsSection = (hasItems || bothEmpty) ? `
      <div>
        <p class="stage-note">Items</p>
        <div class="portrait-row portrait-row-items">${itemsHtml || (!readonly ? "<span class='empty-portrait-state'>Drop items anywhere in the node</span>" : "")}</div>
      </div>
    ` : "";

    const showTraits = hasUnits || bothEmpty;
    const itemsOnly = !hasUnits && hasItems;
    const traitSidebarHtml = showTraits ? createTraitSidebarMarkup(stage) : "";
    const bodyClass = showTraits ? "flow-node-body" : "flow-node-body flow-node-body-items-only";

    if (itemsOnly) {
      stageColumn.classList.add("items-only");
    }

    node.innerHTML = `
      <div class="${bodyClass}">
        <div class="flow-node-main">
          ${unitsSection}
          ${itemsSection}
        </div>
        ${traitSidebarHtml}
      </div>
    `;

    stageColumn.append(node);
    layout.append(stageColumn);
  });

  layout.append(svg);

  if (readonly) {
    canvas.replaceChildren(layout);
  } else {
    const notesPanel = document.createElement("section");
    notesPanel.className = "flow-notes-panel";
    notesPanel.innerHTML = createFlowNotesMarkup(path);
    canvas.replaceChildren(layout, notesPanel);
    wireFlowchartInteractions(path, canvas);
  }

  requestAnimationFrame(() => drawConnections(path.stages.length, canvas));
}

export function renderViewer(path) {
  elements.viewerPathName.textContent = path.name;
  elements.viewerPathSummary.textContent = path.summary || path.notes || "";
  elements.viewerDeleteButton.classList.toggle("hidden", path.source !== "custom");
  renderFlowchart(path, { canvas: elements.viewerFlowchart, readonly: true });
}

export function drawConnections(stageCount, canvas = elements.flowchartCanvas) {
  const layout = canvas.querySelector(".flowchart-layout");
  const svg = layout ? layout.querySelector(".flowchart-lines") : null;

  if (!layout || !svg || stageCount < 2) {
    return;
  }

  const layoutRect = layout.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${layoutRect.width} ${layoutRect.height}`);
  svg.innerHTML = "";

  for (let index = 0; index < stageCount - 1; index += 1) {
    const current = canvas.querySelector(`#flow-node-${index}`);
    const next = canvas.querySelector(`#flow-node-${index + 1}`);
    if (!current || !next) {
      continue;
    }

    const currentRect = current.getBoundingClientRect();
    const nextRect = next.getBoundingClientRect();

    const startX = currentRect.right - layoutRect.left;
    const startY = currentRect.top - layoutRect.top + currentRect.height / 2;
    const endX = nextRect.left - layoutRect.left;
    const endY = nextRect.top - layoutRect.top + nextRect.height / 2;
    const curve = Math.max((endX - startX) * 0.45, 40);

    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute(
      "d",
      `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`,
    );
    pathElement.setAttribute("fill", "none");
    pathElement.setAttribute("stroke", "rgba(95, 208, 255, 0.45)");
    pathElement.setAttribute("stroke-width", "4");
    pathElement.setAttribute("stroke-linecap", "round");
    pathElement.setAttribute("stroke-dasharray", "8 10");

    svg.append(pathElement);
  }
}

let benchSearch = "";

export function setBenchSearch(query) {
  benchSearch = query;
  renderRoster();
}

export function renderRoster() {
  elements.rosterGrid.innerHTML = "";
  const q = benchSearch.toLowerCase().trim();

  // Champions column
  const champCol = createBenchCol("Champions");
  const rosterUnits = state.units
    .filter(
      (unit) =>
        unit.cost >= 1 &&
        unit.cost <= 5 &&
        !EXCLUDED_UNIT_NAMES.has(unit.name.toLowerCase()) &&
        (!q || unit.name.toLowerCase().includes(q)),
    )
    .sort(compareUnits);

  if (rosterUnits.length) {
    const costGroups = new Map();
    for (const unit of rosterUnits) {
      if (!costGroups.has(unit.cost)) costGroups.set(unit.cost, []);
      costGroups.get(unit.cost).push(unit);
    }
    for (const [, units] of [...costGroups.entries()].sort(([a], [b]) => a - b)) {
      const group = document.createElement("div");
      group.className = "bench-cost-group";
      for (const unit of units) {
        const el = document.createElement("div");
        el.className = "bench-unit";
        el.dataset.cost = unit.cost;
        el.draggable = true;
        el.setAttribute("data-tooltip", unit.name);
        el.title = unit.name;
        el.innerHTML = createImageMarkup(unit, unit.name, "bench-unit");
        attachDragSource(el, { kind: "unit", name: unit.name });
        group.append(el);
      }
      champCol.body.append(group);
    }
  } else {
    champCol.body.innerHTML = `<p class="bench-empty">No matches.</p>`;
  }

  // Items column
  const itemsCol = createBenchCol("Items");
  const benchItems = state.items.filter(
    (item) => item.category && (!q || item.name.toLowerCase().includes(q)),
  );
  if (benchItems.length) {
    const grid = document.createElement("div");
    grid.className = "bench-icons-grid";
    for (const item of benchItems) {
      grid.append(createBenchIcon(item, "item"));
    }
    itemsCol.body.append(grid);
  } else {
    itemsCol.body.innerHTML = `<p class="bench-empty">${q ? "No matches." : "Live data loading\u2026"}</p>`;
  }

  // Augments column
  const augsCol = createBenchCol("Augments");
  const augments = state.augments.filter((aug) => !q || aug.name.toLowerCase().includes(q));
  if (augments.length) {
    const grid = document.createElement("div");
    grid.className = "bench-icons-grid";
    for (const aug of augments) {
      grid.append(createBenchIcon(aug, "item"));
    }
    augsCol.body.append(grid);
  } else {
    augsCol.body.innerHTML = `<p class="bench-empty">${q ? "No matches." : "Live data loading\u2026"}</p>`;
  }

  elements.rosterGrid.append(champCol.el, itemsCol.el, augsCol.el);
}

function createBenchCol(label) {
  const el = document.createElement("div");
  el.className = "bench-col";
  const header = document.createElement("p");
  header.className = "bench-col-header";
  header.textContent = label;
  const body = document.createElement("div");
  body.className = "bench-col-body";
  el.append(header, body);
  return { el, body };
}

function createBenchIcon(entry, kind) {
  const el = document.createElement("div");
  el.className = "bench-item";
  el.draggable = true;
  el.setAttribute("data-tooltip", entry.name);
  el.title = entry.name;
  el.innerHTML = createImageMarkup(entry, entry.name, "bench-item");
  attachDragSource(el, { kind, name: entry.name });
  return el;
}

function createPortraitMarkup(name, type, readonly = false) {
  const entry = type === "unit" ? findUnit(name) : findItem(name);
  const className = type === "unit" ? "unit-portrait" : "item-portrait";
  const costAttr = type === "unit" && entry?.cost ? ` data-cost="${entry.cost}"` : "";
  const removeButton = readonly
    ? ""
    : `<button class="portrait-remove" type="button" data-remove-kind="${type}" data-remove-name="${escapeAttribute(name)}" title="Remove ${escapeAttribute(name)}">×</button>`;
  return `
    <span class="${className}"${costAttr} data-tooltip="${escapeAttribute(name)}" title="${escapeAttribute(name)}">
      ${createImageMarkup(entry, name, className)}
      ${removeButton}
    </span>
  `;
}

function createTraitSidebarMarkup(stage) {
  const traits = summarizeStageTraits(stage.units);
  if (!traits.length) {
    return `
      <aside class="trait-sidebar">
        <p class="stage-note">Traits</p>
        <div class="empty-trait-state">Add units to see active synergies.</div>
      </aside>
    `;
  }

  const traitRows = traits
    .map((trait) => {
      const nextBreakpoint = getNextBreakpoint(trait);
      const currentTierClass = getActiveBreakpoint(trait) > 0 ? `trait-tier-${getTraitTierName(trait.activeStyle)}` : "";
      const currentBreakpointClass = currentTierClass
        ? `trait-breakpoint active ${currentTierClass}`
        : "trait-breakpoint";
      const breakpointMarkup = `
        <span class="${currentBreakpointClass}">${trait.count}</span>
        <span class="trait-breakpoint-separator">/</span>
        <span class="trait-breakpoint">${nextBreakpoint || "Max"}</span>
      `;
      return `
        <div class="trait-row">
          <div class="trait-row-header">
            <span class="trait-name">${escapeHtml(trait.name)}</span>
          </div>
          <div class="trait-breakpoints">${breakpointMarkup}</div>
        </div>
      `;
    })
    .join("");

  return `
    <aside class="trait-sidebar">
      <p class="stage-note">Traits</p>
      <div class="trait-list">${traitRows}</div>
    </aside>
  `;
}

function createFlowNotesMarkup(path) {
  return `
    <div class="flow-notes-header">
      <h3>Flow Notes</h3>
      <div class="flow-notes-actions">
        <button class="button ghost" type="button" data-add-stage>+ Add Stage</button>
      </div>
    </div>
    <textarea class="flow-note-textarea" data-path-notes rows="3" placeholder="Add overall line notes...">${escapeHtml(path.notes || "")}</textarea>
  `;
}

function summarizeStageTraits(unitNames) {
  const traitCounts = new Map();

  unitNames.forEach((unitName) => {
    const unit = findUnit(unitName);
    if (!unit || !Array.isArray(unit.traits)) {
      return;
    }
    unit.traits.forEach((traitName) => {
      if (!traitName || traitName === "Choose Trait") {
        return;
      }
      traitCounts.set(traitName, (traitCounts.get(traitName) || 0) + 1);
    });
  });

  return Array.from(traitCounts.entries())
    .map(([name, count]) => {
      const traitMeta = state.traits[name] || { effects: [] };
      return {
        name,
        count,
        effects: traitMeta.effects || [],
        activeStyle: getActiveBreakpointStyle(count, traitMeta.effects || []),
      };
    })
    .sort((left, right) => {
      const activeDelta = getActiveBreakpoint(right) - getActiveBreakpoint(left);
      if (activeDelta !== 0) {
        return activeDelta;
      }
      return right.count - left.count || left.name.localeCompare(right.name);
    })
    .slice(0, 8);
}

function getActiveBreakpoint(trait) {
  return trait.effects.reduce((active, effect) => (trait.count >= effect.minUnits ? effect.minUnits : active), 0);
}

function getNextBreakpoint(trait) {
  for (const effect of trait.effects) {
    if (effect.minUnits > trait.count) {
      return effect.minUnits;
    }
  }
  return null;
}

function getActiveBreakpointStyle(count, effects) {
  return effects.reduce((activeStyle, effect) => (count >= effect.minUnits ? effect.style : activeStyle), 0);
}

function getTraitTierName(style) {
  if (style >= 6) return "prismatic";
  if (style >= 5) return "gold";
  if (style >= 3) return "silver";
  if (style >= 1) return "bronze";
  return "base";
}

function wireFlowchartInteractions(path, canvas = elements.flowchartCanvas) {
  canvas.querySelectorAll(".stage-heading-input").forEach((input) => {
    input.addEventListener("input", (event) => {
      const stageIndex = Number(event.currentTarget.getAttribute("data-stage-index"));
      const stage = path.stages[stageIndex];
      if (!stage) {
        return;
      }
      stage.label = event.currentTarget.value || `Stage ${stageIndex + 1}`;
      persistState();
    });
  });

  canvas.querySelectorAll("[data-remove-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      if (path.stages.length === 1) {
        return;
      }
      const stageIndex = Number(button.getAttribute("data-remove-stage"));
      path.stages.splice(stageIndex, 1);
      persistState();
      renderHeaderAndFlowchart();
    });
  });

  canvas.querySelectorAll("[data-clone-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      const stageIndex = Number(button.getAttribute("data-clone-stage"));
      const stage = path.stages[stageIndex];
      if (!stage) {
        return;
      }
      path.stages.splice(stageIndex + 1, 0, {
        label: `${stage.label} Copy`,
        units: [...stage.units],
        items: [...stage.items],
        notes: stage.notes || "",
      });
      persistState();
      renderHeaderAndFlowchart();
    });
  });

  canvas.querySelectorAll("[data-drop-stage-any]").forEach((node) => {
    node.addEventListener("dragover", (event) => {
      if (!state.dragPayload) {
        return;
      }
      event.preventDefault();
      node.classList.add("dropzone-active");
    });

    node.addEventListener("dragleave", () => {
      node.classList.remove("dropzone-active");
    });

    node.addEventListener("drop", (event) => {
      event.preventDefault();
      node.classList.remove("dropzone-active");
      const payload = parseDropPayload(event);
      if (!payload) {
        return;
      }

      const stageIndex = Number(node.getAttribute("data-drop-stage-any"));
      const stage = path.stages[stageIndex];
      if (!stage) {
        return;
      }

      const targetList = payload.kind === "unit" ? stage.units : stage.items;
      if (!targetList.includes(payload.name)) {
        targetList.push(payload.name);
        persistState();
        renderHeaderAndFlowchart();
      }
    });
  });

  canvas.querySelectorAll(".portrait-remove").forEach((button) => {
    button.addEventListener("click", () => {
      const node = button.closest("[data-drop-stage-any]");
      if (!node) {
        return;
      }
      const stageIndex = Number(node.getAttribute("data-drop-stage-any"));
      const stage = path.stages[stageIndex];
      if (!stage) {
        return;
      }

      const kind = button.getAttribute("data-remove-kind");
      const name = button.getAttribute("data-remove-name");
      const targetList = kind === "unit" ? stage.units : stage.items;
      const nextList = targetList.filter((entry) => entry !== name);
      if (kind === "unit") {
        stage.units = nextList;
      } else {
        stage.items = nextList;
      }
      persistState();
      renderHeaderAndFlowchart();
    });
  });

  const pathNotes = canvas.querySelector("[data-path-notes]");
  if (pathNotes) {
    pathNotes.addEventListener("input", (event) => {
      path.notes = event.currentTarget.value.trim();
      persistState();
    });
  }

  const addStageButton = canvas.querySelector("[data-add-stage]");
  if (addStageButton) {
    addStageButton.addEventListener("click", () => {
      path.stages.push({ label: `Stage ${path.stages.length + 1}`, units: [], items: [], notes: "" });
      persistState();
      renderHeaderAndFlowchart();
    });
  }

}

export function attachDragSource(element, payload) {
  element.addEventListener("dragstart", (event) => {
    state.dragPayload = payload;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
  });

  element.addEventListener("dragend", () => {
    state.dragPayload = null;
    document.querySelectorAll(".dropzone-active").forEach((zone) => {
      zone.classList.remove("dropzone-active");
    });
  });
}

function parseDropPayload(event) {
  if (state.dragPayload) {
    return state.dragPayload;
  }
  try {
    return JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch {
    return null;
  }
}
