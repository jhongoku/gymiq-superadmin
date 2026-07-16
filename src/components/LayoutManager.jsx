import React, { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import LayoutEditor, { buildDefaultElements } from "./LayoutEditor";

const SELECTION_OPTIONS = [
  { id: "default", label: "Original (base del proyecto)" },
  { id: "template_1", label: "Plantilla 1" },
  { id: "template_2", label: "Plantilla 2" },
  { id: "template_3", label: "Plantilla 3" },
  { id: "custom", label: "Personalizado para este gimnasio" },
];

export default function LayoutManager({ gymId }) {
  const [templates, setTemplates] = useState({});
  const [selection, setSelection] = useState("default");
  const [customElements, setCustomElements] = useState(buildDefaultElements());
  const [templateDraft, setTemplateDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultUnlocked, setDefaultUnlocked] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const snap = await getDocs(collection(db, "layout_templates"));
      const map = {};
      snap.forEach((d) => (map[d.id] = d.data()));
      setTemplates(map);

      const gymSnap = await getDoc(doc(db, "gyms", gymId));
      const gymData = gymSnap.data() || {};
      setSelection(gymData.homeLayoutSelection || "default");
      setCustomElements(gymData.customHomeLayout || buildDefaultElements());
      setLoading(false);
    }
    load();
  }, [gymId]);

  async function chooseSelection(id) {
    setSelection(id);
    if (id !== "custom") {
      setSaving(true);
      await updateDoc(doc(db, "gyms", gymId), {
        homeLayoutSelection: id,
        homeLayoutUpdatedAt: new Date(),
      });
      setSaving(false);
    }
    if (id !== "default" && id !== "custom") {
      const existingElements = templates[id]?.elements || [];
      const baseElements = templates.default?.elements || buildDefaultElements();
      setTemplateDraft({
        id,
        elements: existingElements.length > 0 ? existingElements : baseElements,
      });
    } else {
      setTemplateDraft(null);
    }
  }

  async function saveCustomLayout(elements) {
    setCustomElements(elements);
    setSaving(true);
    await updateDoc(doc(db, "gyms", gymId), {
      customHomeLayout: elements,
      homeLayoutUpdatedAt: new Date(),
    });
    setSaving(false);
  }

  async function saveTemplateDraft() {
    if (!templateDraft) return;
    setSaving(true);
    await updateDoc(doc(db, "layout_templates", templateDraft.id), {
      elements: templateDraft.elements,
      updatedAt: new Date(),
    });
    setTemplates((prev) => ({
      ...prev,
      [templateDraft.id]: { ...prev[templateDraft.id], elements: templateDraft.elements },
    }));
    setSaving(false);
  }

  function resetTemplateDraftToBase() {
    if (!templateDraft) return;
    const baseElements = templates.default?.elements || buildDefaultElements();
    setTemplateDraft({ ...templateDraft, elements: baseElements });
  }

  async function saveDefaultTemplate() {
    setSaving(true);
    await updateDoc(doc(db, "layout_templates", "default"), {
      elements: templates.default.elements,
      updatedAt: new Date(),
    });
    setSaving(false);
    setDefaultUnlocked(false);
  }

  if (loading) return <p style={{ color: "#777", fontSize: "13px" }}>Cargando editor de layout…</p>;

  return (
    <div
      style={{
        marginTop: "16px",
        padding: "16px",
        backgroundColor: "#f0f4ff",
        border: "1px solid #c5d5f5",
        borderRadius: "10px",
        boxSizing: "border-box",
        maxWidth: "100%",
        overflowX: "hidden",
      }}
    >
      <h4 style={{ margin: "0 0 14px 0", color: "#1565C0" }}>Diseño del HomeScreen</h4>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
        {SELECTION_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => chooseSelection(opt.id)}
            disabled={saving}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: selection === opt.id ? "2px solid #1976D2" : "1px solid #ccc",
              backgroundColor: selection === opt.id ? "#1976D2" : "#fff",
              color: selection === opt.id ? "#fff" : "#333",
              fontWeight: selection === opt.id ? "bold" : "normal",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: "13px",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {selection === "default" && templates.default && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
            <button
              onClick={async () => {
                if (defaultUnlocked) {
                  // Se está bloqueando sin guardar — recargar desde Firestore para descartar cambios en memoria
                  const freshDoc = await getDoc(doc(db, "layout_templates", "default"));
                  setTemplates((prev) => ({ ...prev, default: freshDoc.data() }));
                }
                setDefaultUnlocked((prev) => !prev);
              }}
              style={{
                padding: "8px 16px",
                backgroundColor: defaultUnlocked ? "#D32F2F" : "#ECEFF1",
                color: defaultUnlocked ? "#fff" : "#333",
                border: "1px solid #ccc",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              {defaultUnlocked ? "🔓 Bloquear edición" : "🔒 Desbloquear para editar"}
            </button>
          </div>

          <LayoutEditor
            elements={templates.default.elements}
            onChange={(els) => setTemplates((prev) => ({
              ...prev,
              default: { ...prev.default, elements: els },
            }))}
            readOnly={!defaultUnlocked}
          />

          {defaultUnlocked && (
            <button
              onClick={saveDefaultTemplate}
              disabled={saving}
              style={{
                marginTop: "12px",
                padding: "8px 16px",
                backgroundColor: "#2E7D32",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: "bold",
              }}
            >
              💾 Guardar cambios en Original
            </button>
          )}
        </div>
      )}

      {selection !== "default" && selection !== "custom" && templateDraft && (
        <div>
          <LayoutEditor
            elements={templateDraft.elements}
            onChange={(els) => setTemplateDraft({ ...templateDraft, elements: els })}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button
              onClick={saveTemplateDraft}
              disabled={saving}
              style={{ padding: "8px 16px", backgroundColor: "#2E7D32", color: "#fff", border: "none", borderRadius: "6px", cursor: saving ? "not-allowed" : "pointer", fontWeight: "bold" }}
            >
              💾 Guardar plantilla
            </button>
            <button
              onClick={resetTemplateDraftToBase}
              disabled={saving}
              style={{ padding: "8px 16px", backgroundColor: "#ECEFF1", color: "#333", border: "1px solid #ccc", borderRadius: "6px", cursor: saving ? "not-allowed" : "pointer", fontWeight: "bold" }}
            >
              ↺ Restablecer a base
            </button>
          </div>
        </div>
      )}

      {selection === "custom" && (
        <LayoutEditor elements={customElements} onChange={saveCustomLayout} />
      )}

      {saving && <span style={{ fontSize: "12px", color: "#1976D2" }}>Guardando…</span>}
    </div>
  );
}
