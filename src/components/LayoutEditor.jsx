import React from "react";

export const ELEMENT_CATALOG = {
  mascota:   { label: "Mascota GymIQ" },
  logogym:   { label: "Logo del gimnasio" },
  hero:      { label: "Perfil (foto + nombre + cédula)" },
  alerta:    { label: "Alerta de membresía" },
  tip:       { label: "Tip / recomendación del día" },
  character: { label: "Tarjeta de personaje y progreso" },
  boton:     { label: "Botón Entrenar hoy" },
  rutina:    { label: "Acceso: Rutina" },
  progreso:  { label: "Acceso: Progreso" },
  unrm:      { label: "Acceso: 1RM" },
  nav:       { label: "Barra de navegación inferior" },
};

const BLOCK_PREVIEW = {
  mascota: () => (
    <div style={{ padding: "10px", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#fde4c8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🧠</div>
    </div>
  ),
  logogym: () => (
    <div style={{ padding: "10px", textAlign: "center" }}>
      <div style={{ fontWeight: 600 }}>Gym IQ</div>
      <div style={{ fontSize: "10px", color: "#888" }}>Train smart</div>
    </div>
  ),
  hero: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px" }}>
      <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#eee" }} />
      <div>
        <div style={{ fontWeight: 600, fontSize: "14px" }}>JhonnyMuscles</div>
        <div style={{ fontSize: "11px", color: "#888" }}>****2010</div>
      </div>
    </div>
  ),
  alerta: () => (
    <div style={{ background: "#fde2e2", padding: "10px", fontSize: "12px", color: "#b91c1c", borderRadius: "8px" }}>
      ⚠️ Tu membresía vence en 2 días.
    </div>
  ),
  tip: () => (
    <div style={{ background: "#fef3c7", padding: "10px", fontSize: "12px", color: "#92400e", borderRadius: "8px" }}>
      💡 Hoy enfócate en volumen progresivo
    </div>
  ),
  character: () => (
    <div style={{ padding: "10px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
      <div style={{ width: "50px", height: "60px", background: "#eee", borderRadius: "8px", flexShrink: 0 }} />
      <div style={{ flex: "1 1 100px", minWidth: "80px" }}>
        <div style={{ fontWeight: 600, fontSize: "13px" }}>Bárbaro en adaptación</div>
        <div style={{ fontSize: "11px", color: "#888" }}>158 / 1000 pts</div>
      </div>
    </div>
  ),
  boton: () => (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", background: "#16a34a", color: "#fff", fontWeight: 600, borderRadius: "8px" }}>
      ★ Entrenar hoy
    </div>
  ),
  rutina: () => (
    <div style={{ padding: "8px", textAlign: "center" }}>
      ⭐<div style={{ fontSize: "11px", color: "#666" }}>Rutina</div>
    </div>
  ),
  progreso: () => (
    <div style={{ padding: "8px", textAlign: "center" }}>
      ⭐<div style={{ fontSize: "11px", color: "#666" }}>Progreso</div>
    </div>
  ),
  unrm: () => (
    <div style={{ padding: "8px", textAlign: "center" }}>
      ⭐<div style={{ fontSize: "11px", color: "#666" }}>1RM</div>
    </div>
  ),
  nav: () => (
    <div style={{ display: "flex", justifyContent: "space-around", background: "#fde4c8", padding: "8px", borderRadius: "8px" }}>
      <div style={{ fontSize: "10px" }}>🏠 Inicio</div>
      <div style={{ fontSize: "10px" }}>👤 Perfil</div>
      <div style={{ fontSize: "10px" }}>📊 Progreso</div>
      <div style={{ fontSize: "10px" }}>👥 Comunidad</div>
    </div>
  ),
};

export function buildDefaultElements() {
  return Object.keys(ELEMENT_CATALOG).map((id, i) => ({
    id,
    row: i,
    colOrder: 0,
    colSpan: 4,
    rowSpan: 1,
    fx: 1,
    fy: 1,
    shape: "square",
    visible: true,
    fontScale: 1,
    photoScale: 1,
  }));
}

function toRows(elements) {
  const byRow = {};
  elements.forEach((el) => {
    if (!byRow[el.row]) byRow[el.row] = [];
    byRow[el.row].push(el);
  });
  return Object.keys(byRow)
    .sort((a, b) => a - b)
    .map((r) => byRow[r].sort((a, b) => a.colOrder - b.colOrder));
}

function fromRows(rows) {
  const out = [];
  rows.forEach((row, r) => {
    row.forEach((el, c) => {
      out.push({ ...el, row: r, colOrder: c });
    });
  });
  return out;
}

export default function LayoutEditor({ elements, onChange, readOnly = false }) {
  const rows = toRows(elements && elements.length ? elements : buildDefaultElements());
  const dragRef = React.useRef({ id: null, target: null, zone: null });

  function updateElement(id, patch) {
    const flat = fromRows(rows).map((el) => (el.id === id ? { ...el, ...patch } : el));
    onChange(flat);
  }

  function findLoc(id) {
    for (let r = 0; r < rows.length; r++) {
      const c = rows[r].findIndex((el) => el.id === id);
      if (c !== -1) return { r, c };
    }
    return null;
  }

  function reorder(dragId, targetId, zone) {
    const newRows = rows.map((row) => [...row]);
    const loc = findLoc(dragId);
    if (!loc) return;
    const [dragged] = newRows[loc.r].splice(loc.c, 1);
    if (newRows[loc.r].length === 0) newRows.splice(loc.r, 1);

    const tLoc = (() => {
      for (let r = 0; r < newRows.length; r++) {
        const c = newRows[r].findIndex((el) => el.id === targetId);
        if (c !== -1) return { r, c };
      }
      return null;
    })();
    if (!tLoc) return;

    if (zone === "left") newRows[tLoc.r].splice(tLoc.c, 0, dragged);
    else if (zone === "right") newRows[tLoc.r].splice(tLoc.c + 1, 0, dragged);
    else if (zone === "top") newRows.splice(tLoc.r, 0, [dragged]);
    else newRows.splice(tLoc.r + 1, 0, [dragged]);

    onChange(fromRows(newRows));
  }

  function onHandlePointerDown(id, ev) {
    if (readOnly) return;
    ev.preventDefault();
    dragRef.current.id = id;
    const handle = ev.currentTarget;
    handle.setPointerCapture(ev.pointerId);

    const onMove = (moveEv) => {
      document
        .querySelectorAll("[data-layout-block]")
        .forEach((n) => n.removeAttribute("data-drop-zone"));
      const el = document.elementFromPoint(moveEv.clientX, moveEv.clientY);
      const block = el ? el.closest("[data-layout-block]") : null;
      if (!block || block.dataset.layoutBlock === id) {
        dragRef.current.target = null;
        return;
      }
      const rect = block.getBoundingClientRect();
      const x = (moveEv.clientX - rect.left) / rect.width;
      const y = (moveEv.clientY - rect.top) / rect.height;
      let zone;
      if (x < 0.4) zone = "left";
      else if (x > 0.6) zone = "right";
      else if (y < 0.5) zone = "top";
      else zone = "bottom";
      block.setAttribute("data-drop-zone", zone);
      dragRef.current.target = block.dataset.layoutBlock;
      dragRef.current.zone = zone;
    };

    const onUp = () => {
      document
        .querySelectorAll("[data-layout-block]")
        .forEach((n) => n.removeAttribute("data-drop-zone"));
      const { id: dragId, target, zone } = dragRef.current;
      if (dragId && target && target !== dragId) {
        reorder(dragId, target, zone);
      }
      dragRef.current = { id: null, target: null, zone: null };
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  return (
    <div className="layout-editor">
      <div className="layout-editor__preview">
        {rows.map((row, ri) => (
          <div key={ri} className="layout-editor__row" style={{ display: "flex", justifyContent: "flex-start", gap: "8px", marginBottom: "8px" }}>
            {row.map((el) => {
              const meta = ELEMENT_CATALOG[el.id] || { label: el.id };
              const widthPercent = Math.min(150, (el.colSpan / 4) * el.fx * 100);
              const BASE_HEIGHT = 70; // px — alto de referencia uniforme para TODOS los elementos
              const heightPx = BASE_HEIGHT * el.rowSpan * el.fy;
              const shapeClass =
                el.shape === "circle"
                  ? "is-circle"
                  : el.shape === "ellipse"
                  ? "is-ellipse"
                  : "is-square";
              const shapeStyle =
                el.shape === "circle" ? { borderRadius: "50%" } :
                el.shape === "ellipse" ? { borderRadius: "50% / 40%" } :
                { borderRadius: "8px" };
              return (
                <div
                  key={el.id}
                  data-layout-block={el.id}
                  className={`layout-editor__block ${shapeClass} ${
                    el.visible ? "" : "is-hidden"
                  }`}
                  style={{
                    flex: `0 1 ${widthPercent}%`,
                    width: `${widthPercent}%`,
                    minHeight: `${heightPx}px`,
                    position: "relative",
                    overflow: "hidden",
                    border: "1px dashed #90a4ae",
                    backgroundColor: "#ffffff",
                    ...shapeStyle,
                  }}
                >
                  {!readOnly && (
                    <span
                      className="layout-editor__handle"
                      onPointerDown={(ev) => onHandlePointerDown(el.id, ev)}
                      style={{
                        position: "absolute",
                        top: "4px",
                        right: "4px",
                        zIndex: 10,
                        background: "rgba(255,255,255,0.85)",
                        borderRadius: "4px",
                        padding: "1px 4px",
                        fontSize: "12px",
                        cursor: "grab",
                      }}
                    >
                      ⠿
                    </span>
                  )}
                  {el.visible ? (
                    (BLOCK_PREVIEW[el.id] || (() => <span className="layout-editor__block-label">{meta.label}</span>))()
                  ) : (
                    <div style={{ padding: "10px", fontSize: "12px", color: "#999" }}>{meta.label} (oculto)</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div
          className="layout-editor__controls"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "12px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {fromRows(rows).map((el) => {
            const meta = ELEMENT_CATALOG[el.id] || { label: el.id };
            return (
              <div
                key={el.id}
                className="layout-editor__control-card"
                style={{
                  border: "1px solid #c5d5f5",
                  borderRadius: "8px",
                  padding: "12px",
                  backgroundColor: "#ffffff",
                  textAlign: "left",
                }}
              >
                <div className="layout-editor__control-top">
                  <strong>{meta.label}</strong>
                  <button onClick={() => updateElement(el.id, { visible: !el.visible })}>
                    {el.visible ? "👁 Ocultar" : "🚫 Restaurar"}
                  </button>
                </div>

                <div
                  className="layout-editor__control-row"
                  style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px", marginBottom: "4px" }}
                >
                  <span style={{ minWidth: "110px", fontSize: "12px", color: "#555" }}>Celdas ancho</span>
                  <button onClick={() => updateElement(el.id, { colSpan: Math.max(1, el.colSpan - 1) })}>-</button>
                  <span>{el.colSpan}</span>
                  <button onClick={() => updateElement(el.id, { colSpan: Math.min(10, el.colSpan + 1) })}>+</button>
                </div>

                <div
                  className="layout-editor__control-row"
                  style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px", marginBottom: "4px" }}
                >
                  <span style={{ minWidth: "110px", fontSize: "12px", color: "#555" }}>Celdas alto</span>
                  <button onClick={() => updateElement(el.id, { rowSpan: Math.max(1, el.rowSpan - 1) })}>-</button>
                  <span>{el.rowSpan}</span>
                  <button onClick={() => updateElement(el.id, { rowSpan: Math.min(10, el.rowSpan + 1) })}>+</button>
                </div>

                <div
                  className="layout-editor__control-row"
                  style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px", marginBottom: "4px" }}
                >
                  <span style={{ minWidth: "110px", fontSize: "12px", color: "#555" }}>Ajuste fino ancho</span>
                  <button onClick={() => updateElement(el.id, { fx: Math.max(0.1, +(el.fx - 0.1).toFixed(1)) })}>-</button>
                  <span>{Math.round(el.fx * 100)}%</span>
                  <button onClick={() => updateElement(el.id, { fx: Math.min(10, +(el.fx + 0.1).toFixed(1)) })}>+</button>
                </div>

                <div
                  className="layout-editor__control-row"
                  style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px", marginBottom: "4px" }}
                >
                  <span style={{ minWidth: "110px", fontSize: "12px", color: "#555" }}>Ajuste fino alto</span>
                  <button onClick={() => updateElement(el.id, { fy: Math.max(0.1, +(el.fy - 0.1).toFixed(1)) })}>-</button>
                  <span>{Math.round(el.fy * 100)}%</span>
                  <button onClick={() => updateElement(el.id, { fy: Math.min(10, +(el.fy + 0.1).toFixed(1)) })}>+</button>
                </div>

                <div
                  className="layout-editor__control-row"
                  style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px", marginBottom: "4px" }}
                >
                  <span style={{ minWidth: "110px", fontSize: "12px", color: "#555" }}>Forma</span>
                  <button
                    className={el.shape === "square" ? "is-active" : ""}
                    onClick={() => updateElement(el.id, { shape: "square" })}
                  >
                    ▭
                  </button>
                  <button
                    className={el.shape === "circle" ? "is-active" : ""}
                    onClick={() => updateElement(el.id, { shape: "circle" })}
                  >
                    ●
                  </button>
                  <button
                    className={el.shape === "ellipse" ? "is-active" : ""}
                    onClick={() => updateElement(el.id, { shape: "ellipse" })}
                  >
                    ⬭
                  </button>
                </div>

                <div
                  className="layout-editor__control-row"
                  style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px", marginBottom: "4px" }}
                >
                  <span style={{ minWidth: "110px", fontSize: "12px", color: "#555" }}>Tamaño de fuente</span>
                  <button onClick={() => updateElement(el.id, { fontScale: Math.max(0.5, +((el.fontScale ?? 1) - 0.1).toFixed(1)) })}>-</button>
                  <span>{Math.round((el.fontScale ?? 1) * 100)}%</span>
                  <button onClick={() => updateElement(el.id, { fontScale: Math.min(3, +((el.fontScale ?? 1) + 0.1).toFixed(1)) })}>+</button>
                </div>

                {["mascota", "logogym", "hero", "character"].includes(el.id) && (
                  <div
                    className="layout-editor__control-row"
                    style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px", marginBottom: "4px" }}
                  >
                    <span style={{ minWidth: "110px", fontSize: "12px", color: "#555" }}>Tamaño de foto</span>
                    <button onClick={() => updateElement(el.id, { photoScale: Math.max(0.2, +((el.photoScale ?? 1) - 0.05).toFixed(2)) })}>-</button>
                    <span>{Math.round((el.photoScale ?? 1) * 100)}%</span>
                    <button onClick={() => updateElement(el.id, { photoScale: +((el.photoScale ?? 1) + 0.05).toFixed(2) })}>+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
