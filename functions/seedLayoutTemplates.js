const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

const DEFAULT_ELEMENTS = [
  { id: "mascota",      row: 0,  colOrder: 0, colSpan: 4, rowSpan: 1, fx: 1, fy: 1, shape: "square", visible: true },
  { id: "nombregym",    row: 1,  colOrder: 0, colSpan: 4, rowSpan: 1, fx: 1, fy: 1, shape: "square", visible: true },
  { id: "perfil",       row: 2,  colOrder: 0, colSpan: 4, rowSpan: 1, fx: 1, fy: 1, shape: "square", visible: true },
  { id: "alerta",       row: 3,  colOrder: 0, colSpan: 4, rowSpan: 1, fx: 1, fy: 1, shape: "square", visible: true },
  { id: "tip",          row: 4,  colOrder: 0, colSpan: 4, rowSpan: 1, fx: 1, fy: 1, shape: "square", visible: true },
  { id: "progresocard", row: 5,  colOrder: 0, colSpan: 4, rowSpan: 1, fx: 1, fy: 1, shape: "square", visible: true },
  { id: "boton",        row: 6,  colOrder: 0, colSpan: 4, rowSpan: 1, fx: 1, fy: 1, shape: "square", visible: true },
  { id: "rutina",       row: 7,  colOrder: 0, colSpan: 4, rowSpan: 1, fx: 1, fy: 1, shape: "square", visible: true },
  { id: "progresobox",  row: 8,  colOrder: 0, colSpan: 4, rowSpan: 1, fx: 1, fy: 1, shape: "square", visible: true },
  { id: "unrm",         row: 9,  colOrder: 0, colSpan: 4, rowSpan: 1, fx: 1, fy: 1, shape: "square", visible: true },
  { id: "nav",          row: 10, colOrder: 0, colSpan: 4, rowSpan: 1, fx: 1, fy: 1, shape: "square", visible: true },
];

// ============================================================
// seedDefaultLayoutTemplate
// ============================================================
exports.seedDefaultLayoutTemplate = functions.https.onCall(async (request) => {
  if (!request.auth || request.auth.token.role !== "super_admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo un super administrador puede ejecutar esta acción."
    );
  }

  const ref = db.collection("layout_templates").doc("default");
  const existing = await ref.get();

  if (existing.exists) {
    return {
      status: "already_exists",
      message: "El documento 'default' ya existe. No se sobrescribió nada.",
    };
  }

  await ref.set({
    name: "Original",
    isProtected: true,
    elements: DEFAULT_ELEMENTS,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { status: "created", message: "layout_templates/default creado correctamente." };
});
