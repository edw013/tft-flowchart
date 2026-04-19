export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttribute(value) {
  return escapeHtml(value);
}

export function escapeJs(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createTextAvatar(label) {
  const text = String(label).slice(0, 16);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="18" fill="#102544"/>
      <text x="40" y="45" font-family="Segoe UI, sans-serif" font-size="12" fill="#eef4ff" text-anchor="middle">
        ${escapeHtml(text)}
      </text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function assetPathToUrl(assetPath) {
  if (!assetPath) {
    return createTextAvatar("TFT");
  }
  const normalized = assetPath.toLowerCase().replace(/\.tex$/i, ".png");
  return `https://raw.communitydragon.org/latest/game/${normalized}`;
}

export function normalizeImageValue(imageValue, label) {
  if (imageValue && typeof imageValue === "object" && imageValue.imageUrl) {
    return normalizeImageValue(imageValue.imageUrl, label);
  }

  if (imageValue && typeof imageValue === "object" && imageValue.local && imageValue.remote) {
    return imageValue;
  }

  if (typeof imageValue === "string" && imageValue) {
    return { local: imageValue, remote: imageValue };
  }

  return { local: createTextAvatar(label), remote: createTextAvatar(label) };
}

export function createImageMarkup(imageValue, label, className) {
  const source = normalizeImageValue(imageValue, label);
  return `<img class="${className}-image" src="${source.local}" data-remote-src="${escapeAttribute(source.remote)}" alt="${escapeAttribute(label)}" loading="lazy" onerror="window.__tftFallbackImage(event, '${escapeJs(label)}')" />`;
}

export function applyImageFallback(image, label) {
  const remoteSrc = image.getAttribute("data-remote-src");
  if (remoteSrc && image.src !== remoteSrc) {
    image.src = remoteSrc;
    return;
  }
  image.src = createTextAvatar(label);
}

export function compareUnits(left, right) {
  return left.cost - right.cost || left.name.localeCompare(right.name);
}

export function toggleInSet(set, value) {
  if (set.has(value)) {
    set.delete(value);
    return;
  }
  set.add(value);
}
