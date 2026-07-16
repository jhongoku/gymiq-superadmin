import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export default function RiskZoneTab({ gyms, setGyms, setUsersCountByGym }) {
  // --- Sección A: eliminar gimnasio ---
  const [gymToDelete, setGymToDelete] = useState(null);
  const [showGymConfirm1, setShowGymConfirm1] = useState(false);
  const [showGymConfirm2, setShowGymConfirm2] = useState(false);
  const [gymConfirmText, setGymConfirmText] = useState("");
  const [deletingGym, setDeletingGym] = useState(false);
  const [gymDeleteMessage, setGymDeleteMessage] = useState("");

  const startDeleteGym = (gym) => {
    setGymToDelete(gym);
    setGymConfirmText("");
    setGymDeleteMessage("");
    setShowGymConfirm1(true);
  };

  const confirmGymStep1 = () => {
    setShowGymConfirm1(false);
    setShowGymConfirm2(true);
  };

  const cancelGymDelete = () => {
    setShowGymConfirm1(false);
    setShowGymConfirm2(false);
    setGymToDelete(null);
    setGymConfirmText("");
  };

  const executeGymDelete = async () => {
    if (!gymToDelete) return;
    if (gymConfirmText !== gymToDelete.name) {
      setGymDeleteMessage("❌ El nombre escrito no coincide exactamente.");
      return;
    }
    try {
      setDeletingGym(true);
      setGymDeleteMessage("");
      const functions = getFunctions();
      const deleteGymCascade = httpsCallable(functions, "deleteGymCascade");
      await deleteGymCascade({ gymId: gymToDelete.id });

      setGyms((prev) => prev.filter((g) => g.id !== gymToDelete.id));
      if (setUsersCountByGym) {
        setUsersCountByGym((prev) => {
          const copy = { ...prev };
          delete copy[gymToDelete.id];
          return copy;
        });
      }

      setGymDeleteMessage("✅ Gimnasio eliminado por completo, junto con todos sus datos.");
      setShowGymConfirm2(false);
      setTimeout(() => {
        setGymToDelete(null);
        setGymDeleteMessage("");
      }, 2500);
    } catch (error) {
      console.error("Error eliminando gimnasio:", error);
      setGymDeleteMessage("❌ No se pudo eliminar el gimnasio: " + error.message);
    } finally {
      setDeletingGym(false);
    }
  };

  // --- Sección B: eliminar persona específica ---
  const [selectedGymId, setSelectedGymId] = useState("");
  const [idNumberInput, setIdNumberInput] = useState("");
  const [searchingPerson, setSearchingPerson] = useState(false);
  const [foundPerson, setFoundPerson] = useState(null);
  const [personSearchMessage, setPersonSearchMessage] = useState("");
  const [showPersonConfirm1, setShowPersonConfirm1] = useState(false);
  const [deletingPerson, setDeletingPerson] = useState(false);
  const [personDeleteMessage, setPersonDeleteMessage] = useState("");

  const handleSearchPerson = async () => {
    const cedula = idNumberInput.trim();
    if (!selectedGymId) {
      setPersonSearchMessage("❌ Selecciona un gimnasio primero.");
      return;
    }
    if (!cedula) {
      setPersonSearchMessage("❌ Escribe una cédula.");
      return;
    }
    try {
      setSearchingPerson(true);
      setPersonSearchMessage("");
      setFoundPerson(null);
      const q = query(
        collection(db, "user_profiles"),
        where("gymId", "==", selectedGymId),
        where("idNumber", "==", cedula)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setPersonSearchMessage("No se encontró ninguna persona con esa cédula en ese gimnasio.");
        return;
      }
      const docSnap = snap.docs[0];
      setFoundPerson({ id: docSnap.id, ...docSnap.data() });
    } catch (error) {
      console.error("Error buscando persona:", error);
      setPersonSearchMessage("❌ Ocurrió un error al buscar.");
    } finally {
      setSearchingPerson(false);
    }
  };

  const startDeletePerson = () => {
    setShowPersonConfirm1(true);
  };

  const executePersonDelete = async () => {
    if (!window.confirm("¿Estás 100% seguro? Esta acción no se puede deshacer.")) {
      return;
    }
    if (!foundPerson || !selectedGymId) return;
    try {
      setDeletingPerson(true);
      setPersonDeleteMessage("");
      const functions = getFunctions();
      const deletePersonCascade = httpsCallable(functions, "deletePersonCascade");
      await deletePersonCascade({ profileId: foundPerson.id, gymId: selectedGymId });

      setPersonDeleteMessage("✅ Persona eliminada correctamente.");
      setShowPersonConfirm1(false);
      setFoundPerson(null);
      setIdNumberInput("");
      setTimeout(() => setPersonDeleteMessage(""), 2500);
    } catch (error) {
      console.error("Error eliminando persona:", error);
      setPersonDeleteMessage("❌ No se pudo eliminar: " + error.message);
    } finally {
      setDeletingPerson(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, color: "#B71C1C" }}>🗑️ Zona de Riesgo</h2>
      <p style={{ color: "#666", fontSize: "13px", marginBottom: "24px" }}>
        Las acciones de esta sección son irreversibles. Procede con cuidado.
      </p>

      {/* SECCIÓN A */}
      <div
        style={{
          marginBottom: "32px",
          padding: "20px",
          backgroundColor: "#FFEBEE",
          border: "1px solid #EF9A9A",
          borderRadius: "10px",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#B71C1C" }}>Eliminar gimnasio completo</h3>
        <p style={{ fontSize: "13px", color: "#555", marginBottom: "16px" }}>
          Borra el gimnasio y TODOS sus datos asociados: usuarios, rutinas, historias, avisos,
          encuestas, asistencia e imágenes. No se puede deshacer.
        </p>

        {gyms.length === 0 && <p style={{ color: "#777" }}>No hay gimnasios registrados.</p>}

        <div style={{ display: "grid", gap: "8px" }}>
          {gyms.map((gym) => (
            <div
              key={gym.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "8px",
              }}
            >
              <span style={{ fontWeight: "bold" }}>{gym.name}</span>
              <button
                onClick={() => startDeleteGym(gym)}
                style={{
                  padding: "6px 14px",
                  backgroundColor: "#D32F2F",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "13px",
                }}
              >
                🗑️ Eliminar gimnasio
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN B */}
      <div
        style={{
          padding: "20px",
          backgroundColor: "#FFF3E0",
          border: "1px solid #FFCC80",
          borderRadius: "10px",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#E65100" }}>Eliminar persona de un gimnasio</h3>
        <p style={{ fontSize: "13px", color: "#555", marginBottom: "16px" }}>
          Borra el perfil, historial de entrenamientos y asistencia de una persona específica. El
          gimnasio y el resto de usuarios no se ven afectados.
        </p>

        <div style={{ marginBottom: "12px" }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px", fontSize: "13px" }}>
            Gimnasio
          </label>
          <select
            value={selectedGymId}
            onChange={(e) => {
              setSelectedGymId(e.target.value);
              setFoundPerson(null);
              setPersonSearchMessage("");
            }}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              boxSizing: "border-box",
            }}
          >
            <option value="">-- Selecciona un gimnasio --</option>
            {gyms.map((gym) => (
              <option key={gym.id} value={gym.id}>
                {gym.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px", fontSize: "13px" }}>
            Cédula de la persona
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              value={idNumberInput}
              onChange={(e) => setIdNumberInput(e.target.value)}
              placeholder="Ej: 80722011"
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={handleSearchPerson}
              disabled={searchingPerson}
              style={{
                padding: "10px 16px",
                backgroundColor: searchingPerson ? "#90A4AE" : "#E65100",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: searchingPerson ? "not-allowed" : "pointer",
                fontWeight: "bold",
              }}
            >
              {searchingPerson ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </div>

        {personSearchMessage && (
          <p style={{ fontSize: "13px", color: "#B71C1C", fontWeight: "bold" }}>
            {personSearchMessage}
          </p>
        )}

        {foundPerson && (
          <div
            style={{
              marginTop: "12px",
              padding: "14px",
              backgroundColor: "#fff",
              border: "1px solid #FFB74D",
              borderRadius: "8px",
            }}
          >
            <p style={{ margin: "0 0 4px 0" }}>
              <strong>Nombre:</strong> {foundPerson.name || foundPerson.nickname || "Sin nombre"}
            </p>
            <p style={{ margin: "0 0 12px 0" }}>
              <strong>Cédula:</strong> {foundPerson.idNumber}
            </p>
            <button
              onClick={startDeletePerson}
              style={{
                padding: "8px 16px",
                backgroundColor: "#D32F2F",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              🗑️ Eliminar persona
            </button>
          </div>
        )}

        {personDeleteMessage && (
          <p style={{ marginTop: "10px", fontWeight: "bold", fontSize: "13px" }}>
            {personDeleteMessage}
          </p>
        )}
      </div>

      {/* MODAL: confirmación 1 - gimnasio */}
      {showGymConfirm1 && gymToDelete && (
        <div style={modalOverlayStyle}>
          <div style={modalBoxStyle}>
            <h3 style={{ marginTop: 0, color: "#B71C1C" }}>⚠️ Confirmar eliminación</h3>
            <p>
              Estás a punto de eliminar <strong>{gymToDelete.name}</strong> y TODOS sus datos:
              usuarios, rutinas, historias, avisos, encuestas, asistencia e imágenes. Esta acción
              es irreversible.
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button onClick={confirmGymStep1} style={dangerButtonStyle}>
                Continuar
              </button>
              <button onClick={cancelGymDelete} style={cancelButtonStyle}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: confirmación 2 - gimnasio (escribir nombre) */}
      {showGymConfirm2 && gymToDelete && (
        <div style={modalOverlayStyle}>
          <div style={modalBoxStyle}>
            <h3 style={{ marginTop: 0, color: "#B71C1C" }}>Última confirmación</h3>
            <p>
              Escribe exactamente el nombre del gimnasio (<strong>{gymToDelete.name}</strong>) para
              habilitar la eliminación definitiva:
            </p>
            <input
              type="text"
              value={gymConfirmText}
              onChange={(e) => setGymConfirmText(e.target.value)}
              placeholder={gymToDelete.name}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                boxSizing: "border-box",
                marginBottom: "12px",
              }}
            />
            {gymDeleteMessage && (
              <p style={{ color: gymDeleteMessage.startsWith("✅") ? "#2E7D32" : "#C62828", fontWeight: "bold" }}>
                {gymDeleteMessage}
              </p>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={executeGymDelete}
                disabled={deletingGym || gymConfirmText !== gymToDelete.name}
                style={{
                  ...dangerButtonStyle,
                  backgroundColor:
                    deletingGym || gymConfirmText !== gymToDelete.name ? "#EF9A9A" : "#D32F2F",
                  cursor:
                    deletingGym || gymConfirmText !== gymToDelete.name ? "not-allowed" : "pointer",
                }}
              >
                {deletingGym ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
              <button onClick={cancelGymDelete} disabled={deletingGym} style={cancelButtonStyle}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: confirmación 1 - persona */}
      {showPersonConfirm1 && foundPerson && (
        <div style={modalOverlayStyle}>
          <div style={modalBoxStyle}>
            <h3 style={{ marginTop: 0, color: "#B71C1C" }}>⚠️ Confirmar eliminación</h3>
            <p>
              Vas a eliminar a <strong>{foundPerson.name || foundPerson.nickname}</strong> (cédula{" "}
              {foundPerson.idNumber}): su perfil, historial de entrenamientos y registros de
              asistencia. Esta acción es irreversible.
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                onClick={executePersonDelete}
                disabled={deletingPerson}
                style={dangerButtonStyle}
              >
                {deletingPerson ? "Eliminando..." : "Sí, eliminar"}
              </button>
              <button
                onClick={() => setShowPersonConfirm1(false)}
                disabled={deletingPerson}
                style={cancelButtonStyle}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0,0,0,0.75)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  padding: "20px",
  boxSizing: "border-box",
};

const modalBoxStyle = {
  backgroundColor: "white",
  padding: "24px",
  borderRadius: "12px",
  width: "100%",
  maxWidth: "450px",
  boxSizing: "border-box",
};

const dangerButtonStyle = {
  flex: 1,
  padding: "12px",
  backgroundColor: "#D32F2F",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "bold",
};

const cancelButtonStyle = {
  flex: 1,
  padding: "12px",
  backgroundColor: "#e0e0e0",
  color: "#333",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "bold",
};
