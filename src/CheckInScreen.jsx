import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";

function diasRestantes(membershipExpiry) {
  if (!membershipExpiry) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let expiry;
  if (membershipExpiry?.toDate) {
    expiry = membershipExpiry.toDate();
  } else {
    expiry = new Date(membershipExpiry);
  }
  expiry.setHours(0, 0, 0, 0);
  const diff = Math.round((expiry - hoy) / (1000 * 60 * 60 * 24));
  return diff;
}

function mensajeDias(dias) {
  if (dias === null || dias === undefined) return null;
  if (dias < 0) return "⚠️ Tu membresía ha vencido.";
  if (dias === 0) return "⚠️ Hoy es el último día de tu membresía.";
  if (dias <= 5) return `⏳ Te faltan ${dias} día${dias === 1 ? "" : "s"} para que termine tu membresía.`;
  return null;
}

function textoConEstilo(colorRelleno) {
  return {
    color: colorRelleno || "#FFFFFF",
  };
}

export default function CheckInScreen() {
  const [fase, setFase] = useState("setup");

  // Setup
  const [codigoGym, setCodigoGym] = useState("");
  const [mensajeDia, setMensajeDia] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  // Colores nombre del gimnasio
  const [colorNombreRelleno, setColorNombreRelleno] = useState("#FFFFFF");
  const [colorNombreBorde, setColorNombreBorde] = useState("#000000");

  // Colores mensaje de bienvenida
  const [colorMensajeRelleno, setColorMensajeRelleno] = useState("#FFFFFF");
  const [colorMensajeBorde, setColorMensajeBorde] = useState("#000000");

  const [gymData, setGymData] = useState(null);

  // Check-in
  const [cedula, setCedula] = useState("");
  const [teclaActiva, setTeclaActiva] = useState(null);
  const [checkError, setCheckError] = useState("");
  const [checkLoading, setCheckLoading] = useState(false);

  // Resultado
  const [resultadoUsuario, setResultadoUsuario] = useState(null);
  const [resultadoDias, setResultadoDias] = useState(null);

  const handleConfirmarCedula = useCallback(async () => {
    const ced = cedula.trim();
    if (!ced) { setCheckError("Ingresa tu número de documento."); return; }
    if (!gymData?.id) { setCheckError("Error interno: gimnasio no identificado."); return; }

    setCheckLoading(true);
    setCheckError("");

    try {
      const profilesRef = collection(db, "user_profiles");
      const q = query(
        profilesRef,
        where("gymId", "==", gymData.id),
        where("idNumber", "==", ced)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setCheckError("Número de documento no encontrado. Verifica e intenta de nuevo.");
        setCheckLoading(false);
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      try {
        await addDoc(collection(db, "gym_attendance"), {
          gymId: gymData.id,
          idNumber: ced,
          userName: userData.name || "",
          membershipType: userData.membershipType || "",
          membershipStart: userData.membershipStart || null,
          membershipExpiry: userData.membershipExpiry || null,
          timestamp: new Date(),
        });
      } catch (attendanceErr) {
        console.warn("No se pudo registrar asistencia:", attendanceErr);
      }

      const dias = diasRestantes(userData.membershipExpiry);
      setResultadoUsuario(userData);
      setResultadoDias(dias);
      setFase("result");
    } catch (err) {
      console.error(err);
      setCheckError("Error al consultar la base de datos.");
    } finally {
      setCheckLoading(false);
    }
  }, [cedula, gymData]);

  const handleKeyDown = useCallback(
    (e) => {
      if (fase !== "checkin") return;
      if (e.key >= "0" && e.key <= "9") {
        setCedula((prev) => (prev.length < 15 ? prev + e.key : prev));
        setCheckError("");
        setTeclaActiva(e.key);
        setTimeout(() => setTeclaActiva(null), 150);
      }
      if (e.key === "Backspace") {
        setCedula((prev) => prev.slice(0, -1));
        setCheckError("");
      }
      if (e.key === "Enter") handleConfirmarCedula();
    },
    [fase, handleConfirmarCedula]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (fase !== "result") return;
    const timer = setTimeout(() => {
      setCedula("");
      setCheckError("");
      setResultadoUsuario(null);
      setResultadoDias(null);
      setFase("checkin");
    }, 6000);
    return () => clearTimeout(timer);
  }, [fase]);

  const handleConfirmarSetup = async () => {
    const codigo = codigoGym.trim().toUpperCase();
    const mensaje = mensajeDia.trim();
    if (!codigo) { setSetupError("Ingresa el código del gimnasio."); return; }
    if (!mensaje) { setSetupError("Ingresa el mensaje del día."); return; }

    setSetupLoading(true);
    setSetupError("");

    try {
      const gymsRef = collection(db, "gyms");
      const q = query(gymsRef, where("gymCode", "==", codigo));
      const snap = await getDocs(q);

      if (snap.empty) {
        setSetupError("Código de gimnasio no encontrado.");
        setSetupLoading(false);
        return;
      }

      const gymDoc = snap.docs[0];
      const data = { id: gymDoc.id, ...gymDoc.data() };
      setGymData({
        ...data,
        welcomeMessage: mensaje,
        colorNombreRelleno,
        colorNombreBorde,
        colorMensajeRelleno,
        colorMensajeBorde,
      });
      setFase("checkin");
    } catch (err) {
      console.error(err);
      setSetupError("Error al conectar con la base de datos.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDigito = (d) => {
    if (cedula.length >= 15) return;
    setCedula((prev) => prev + d);
    setCheckError("");
    setTeclaActiva(d);
    setTimeout(() => setTeclaActiva(null), 150);
  };

  const handleBorrar = () => { setCedula((prev) => prev.slice(0, -1)); setCheckError(""); };
  const handleLimpiar = () => { setCedula(""); setCheckError(""); };

  const primary = gymData?.primaryColor || "#1976D2";
  const secondary = gymData?.secondaryColor || "#000000";

  // ── SETUP ────────────────────────────────────────────────────────────────────
  if (fase === "setup") {
    return (
      <div style={styles.setupRoot}>
        <div style={styles.setupCard}>
          <div style={styles.setupLogo}>
            <span style={styles.setupLogoIcon}>🏋️</span>
            <span style={styles.setupLogoText}>GymIQ</span>
          </div>
          <h1 style={styles.setupTitle}>Panel de Ingreso</h1>
          <p style={styles.setupSubtitle}>Configura la pantalla de recepción</p>

          <div style={styles.setupField}>
            <label style={styles.setupLabel}>Código del gimnasio</label>
            <input
              type="text"
              value={codigoGym}
              onChange={(e) => { setCodigoGym(e.target.value.toUpperCase()); setSetupError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirmarSetup(); }}
              placeholder="Ej: GYMBRZ"
              maxLength={10}
              style={styles.setupInput}
            />
          </div>

          <div style={styles.setupField}>
            <label style={styles.setupLabel}>Mensaje de bienvenida del día</label>
            <input
              type="text"
              value={mensajeDia}
              onChange={(e) => { setMensajeDia(e.target.value); setSetupError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirmarSetup(); }}
              placeholder='Ej: ¡Es hora de entrenar,'
              style={styles.setupInput}
            />
            <p style={styles.setupHint}>
              Aparecerá seguido del nombre. Ej: "¡Es hora de entrenar, Juan!"
            </p>
          </div>

          {/* COLORES MENSAJE BIENVENIDA */}
          <div style={styles.seccionColores}>
            <p style={styles.seccionColoresTitulo}>💬 Colores del mensaje de bienvenida</p>
            <div style={styles.coloresRow}>
              <div style={styles.colorItem}>
                <label style={styles.colorLabel}>Relleno del texto</label>
                <div style={styles.colorInputRow}>
                  <input type="color" value={colorMensajeRelleno} onChange={(e) => setColorMensajeRelleno(e.target.value)} style={styles.colorPicker} />
                  <input type="text" value={colorMensajeRelleno} onChange={(e) => setColorMensajeRelleno(e.target.value)} style={styles.colorText} />
                </div>
              </div>
            </div>
            <div style={styles.preview}>
              <span style={{
                fontSize: "22px", fontWeight: "900",
                color: colorMensajeRelleno,
                letterSpacing: "-0.5px",
              }}>
                {mensajeDia || "Vista previa del mensaje"} Juan
              </span>
            </div>
          </div>

          {setupError && <p style={styles.setupError}>{setupError}</p>}

          <button
            onClick={handleConfirmarSetup}
            disabled={setupLoading}
            style={{ ...styles.setupBtn, opacity: setupLoading ? 0.7 : 1 }}
          >
            {setupLoading ? "Verificando..." : "Activar pantalla de ingreso →"}
          </button>
        </div>
      </div>
    );
  }

  // ── RESULTADO ────────────────────────────────────────────────────────────────
  if (fase === "result") {
    const alertaDias = mensajeDias(resultadoDias);
    const nombreUsuario = resultadoUsuario?.name || resultadoUsuario?.nickname || "Usuario";
    const mensajeCompleto = `${gymData?.welcomeMessage || "Bienvenido,"} ${nombreUsuario}`;
    const estiloNombre = textoConEstilo(gymData?.colorNombreRelleno);
    const estiloMensaje = textoConEstilo(gymData?.colorMensajeRelleno);

    return (
      <div style={{ ...styles.checkinRoot, background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}>
        <button onClick={() => { setFase("setup"); setCedula(""); }} style={styles.volverBtn}>
          ⚙️ Cambiar configuración
        </button>

        <div style={styles.brandingCard}>
          <div style={styles.brandingLeft}>
            {gymData?.logoUrl && (
              <img src={gymData.logoUrl} alt="Logo" style={styles.brandingLogo} />
            )}
          </div>
          {gymData?.logoUrl && gymData?.gymNameImageUrl && (
            <div style={styles.brandingSeparator} />
          )}
          <div style={styles.brandingRight}>
            {gymData?.gymNameImageUrl
              ? <img src={gymData.gymNameImageUrl} alt="Nombre del gimnasio" style={styles.brandingNameImage} />
              : <span style={{ ...styles.headerGymName, ...estiloNombre }}>{gymData?.name || "GymIQ"}</span>
            }
          </div>
        </div>

        <div style={styles.resultCard}>
          <div style={styles.resultCheck}>✅</div>
          <h1 style={{ ...styles.resultMessage, ...estiloMensaje }}>
            {mensajeCompleto}
          </h1>
          {alertaDias && (
            <div style={styles.alertaDias}>
              <p style={styles.alertaDiasText}>{alertaDias}</p>
            </div>
          )}
          <p style={styles.resultCountdown}>Volviendo en unos segundos...</p>
        </div>
      </div>
    );
  }

  // ── CHECKIN ──────────────────────────────────────────────────────────────────
  const estiloNombreCheckin = textoConEstilo(gymData?.colorNombreRelleno);

  return (
    <div style={{ ...styles.checkinRoot, background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}>
      <button onClick={() => setFase("setup")} style={styles.volverBtn}>
        ⚙️ Cambiar configuración
      </button>

      <div style={styles.brandingCard}>
        <div style={styles.brandingLeft}>
          {gymData?.logoUrl && (
            <img src={gymData.logoUrl} alt="Logo" style={styles.brandingLogo} />
          )}
        </div>
        {gymData?.logoUrl && gymData?.gymNameImageUrl && (
          <div style={styles.brandingSeparator} />
        )}
        <div style={styles.brandingRight}>
          {gymData?.gymNameImageUrl
            ? <img src={gymData.gymNameImageUrl} alt="Nombre del gimnasio" style={styles.brandingNameImage} />
            : <span style={{ ...styles.headerGymName, ...estiloNombreCheckin }}>{gymData?.name || "GymIQ"}</span>
          }
        </div>
      </div>

      <div style={styles.checkinCard}>
        <p style={styles.checkinLabel}>Ingrese su número de documento</p>

        <div style={styles.cedulaDisplay}>
          <span style={styles.cedulaTexto}>
            {cedula || <span style={{ color: "#bbb" }}>_ _ _ _ _ _ _ _ _ _</span>}
          </span>
        </div>

        {checkError && <p style={styles.checkError}>{checkError}</p>}

        <div style={styles.teclado}>
          <div style={styles.tecladoFila}>
            {["7","8","9"].map((d) => (
              <button key={d} onClick={() => handleDigito(d)} style={{ ...styles.teclaBtn, background: teclaActiva === d ? "#FFC107" : "#fff", transform: teclaActiva === d ? "scale(0.94)" : "scale(1)" }}>{d}</button>
            ))}
            <button onClick={handleBorrar} style={styles.teclaAccion}>⌫</button>
          </div>
          <div style={styles.tecladoFila}>
            {["4","5","6"].map((d) => (
              <button key={d} onClick={() => handleDigito(d)} style={{ ...styles.teclaBtn, background: teclaActiva === d ? "#FFC107" : "#fff", transform: teclaActiva === d ? "scale(0.94)" : "scale(1)" }}>{d}</button>
            ))}
            <button onClick={handleLimpiar} style={{ ...styles.teclaAccion, fontSize: "13px" }}>Limpiar</button>
          </div>
          <div style={styles.tecladoFila}>
            {["1","2","3"].map((d) => (
              <button key={d} onClick={() => handleDigito(d)} style={{ ...styles.teclaBtn, background: teclaActiva === d ? "#FFC107" : "#fff", transform: teclaActiva === d ? "scale(0.94)" : "scale(1)" }}>{d}</button>
            ))}
            <div style={{ width: "72px" }} />
          </div>
          <div style={styles.tecladoFila}>
            <div style={{ width: "72px" }} />
            <button onClick={() => handleDigito("0")} style={{ ...styles.teclaBtn, background: teclaActiva === "0" ? "#FFC107" : "#fff", transform: teclaActiva === "0" ? "scale(0.94)" : "scale(1)" }}>0</button>
            <div style={{ width: "72px" }} />
            <button onClick={handleConfirmarCedula} disabled={checkLoading} style={{ ...styles.teclaConfirmar, background: primary, opacity: checkLoading ? 0.7 : 1 }}>
              {checkLoading ? "..." : "✓"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const CARD_MAX_WIDTH = 420;
const LOGO_SIZE = CARD_MAX_WIDTH / 2;

const styles = {
  setupRoot: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif", padding: "20px",
  },
  setupCard: {
    background: "rgba(255,255,255,0.97)", borderRadius: "20px", padding: "40px",
    width: "100%", maxWidth: "520px", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  },
  setupLogo: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" },
  setupLogoIcon: { fontSize: "32px" },
  setupLogoText: { fontSize: "26px", fontWeight: "900", color: "#1976D2", letterSpacing: "-1px" },
  setupTitle: { margin: "0 0 6px", fontSize: "22px", fontWeight: "800", color: "#111" },
  setupSubtitle: { margin: "0 0 28px", color: "#666", fontSize: "14px" },
  setupField: { marginBottom: "20px" },
  setupLabel: { display: "block", fontWeight: "700", marginBottom: "8px", color: "#333", fontSize: "14px" },
  setupInput: {
    width: "100%", padding: "12px 14px", border: "2px solid #e0e0e0",
    borderRadius: "10px", fontSize: "16px", boxSizing: "border-box",
  },
  setupHint: { margin: "6px 0 0", fontSize: "12px", color: "#888" },
  setupError: { color: "#D32F2F", fontWeight: "bold", marginBottom: "12px", fontSize: "14px" },
  setupBtn: {
    width: "100%", padding: "14px", backgroundColor: "#1976D2", color: "#fff",
    border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "800", cursor: "pointer",
  },
  seccionColores: {
    background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "12px",
    padding: "16px", marginBottom: "16px",
  },
  seccionColoresTitulo: { margin: "0 0 12px", fontWeight: "700", fontSize: "14px", color: "#333" },
  coloresRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  colorItem: { flex: 1, minWidth: "180px" },
  colorLabel: { display: "block", fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "6px" },
  colorInputRow: { display: "flex", alignItems: "center", gap: "8px" },
  colorPicker: { width: "40px", height: "36px", border: "1px solid #ccc", borderRadius: "6px", padding: "2px", cursor: "pointer" },
  colorText: { flex: 1, padding: "8px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" },
  preview: {
    marginTop: "12px", padding: "12px", background: "#1a1a2e",
    borderRadius: "8px", textAlign: "center",
  },
  checkinRoot: {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "flex-start",
    fontFamily: "'Segoe UI', sans-serif", padding: "20px", position: "relative",
  },
  volverBtn: {
    position: "absolute", top: "16px", right: "16px", padding: "8px 14px",
    backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
    border: "1px solid rgba(255,255,255,0.3)", borderRadius: "20px",
    cursor: "pointer", fontSize: "13px", fontWeight: "600",
  },
  header: {
    display: "flex", alignItems: "center", gap: "20px",
    marginTop: "16px", marginBottom: "28px",
    width: "100%", maxWidth: `${CARD_MAX_WIDTH}px`, justifyContent: "center",
  },
  headerLogo: {
    width: `${LOGO_SIZE}px`, height: `${LOGO_SIZE}px`,
    objectFit: "contain", borderRadius: "16px",
    background: "rgba(255,255,255,0.1)",
    flexShrink: 0,
  },
  headerLogoPlaceholder: { fontSize: `${LOGO_SIZE * 0.7}px`, flexShrink: 0 },
  headerGymName: {
    fontSize: "clamp(22px, 4vw, 36px)", fontWeight: "900",
    letterSpacing: "-1px", lineHeight: 1.1,
  },
  checkinCard: {
    background: "rgba(255,255,255,0.97)", borderRadius: "24px", padding: "28px 24px",
    width: "100%", maxWidth: `${CARD_MAX_WIDTH}px`,
    boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  checkinLabel: { fontSize: "16px", fontWeight: "700", color: "#444", marginBottom: "14px", textAlign: "center" },
  cedulaDisplay: {
    width: "100%", minHeight: "54px", background: "#f5f7fa", border: "2px solid #e0e0e0",
    borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: "12px", padding: "0 16px", boxSizing: "border-box",
  },
  cedulaTexto: { fontSize: "28px", fontWeight: "800", color: "#222", letterSpacing: "4px" },
  checkError: { color: "#D32F2F", fontWeight: "700", fontSize: "13px", textAlign: "center", marginBottom: "8px" },
  teclado: { display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" },
  tecladoFila: { display: "flex", gap: "10px", alignItems: "center", justifyContent: "center" },
  teclaBtn: {
    width: "72px", height: "72px", border: "2px solid #e0e0e0", borderRadius: "14px",
    fontSize: "26px", fontWeight: "800", color: "#222", cursor: "pointer",
    transition: "background 0.1s, transform 0.1s", boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
  },
  teclaAccion: {
    width: "72px", height: "72px", border: "none", borderRadius: "14px",
    fontSize: "22px", fontWeight: "800", color: "#fff", cursor: "pointer",
    background: "#E53935", boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
  },
  teclaConfirmar: {
    width: "72px", height: "72px", border: "none", borderRadius: "14px",
    fontSize: "28px", fontWeight: "900", color: "#fff", cursor: "pointer",
    boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
  },
  resultCard: {
    background: "transparent",
    borderRadius: "24px",
    padding: "48px 36px",
    width: "100%",
    maxWidth: "700px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  resultCheck: { fontSize: "80px", marginBottom: "24px" },
  resultMessage: {
    fontSize: "clamp(28px, 5vw, 52px)",
    fontWeight: "900",
    margin: "0 0 24px",
    lineHeight: 1.2,
  },
  alertaDias: {
    background: "#FFF8E1", border: "2px solid #FFC107",
    borderRadius: "12px", padding: "14px 20px", marginBottom: "20px", width: "100%",
  },
  alertaDiasText: { margin: 0, color: "#E65100", fontWeight: "700", fontSize: "16px" },
  resultCountdown: { color: "#999", fontSize: "13px", margin: 0 },
  brandingCard: {
    display: "flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.97)",
    borderRadius: "20px",
    padding: "16px 24px",
    marginTop: "16px",
    marginBottom: "28px",
    width: "100%",
    maxWidth: "520px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
    gap: "0",
    justifyContent: "center",
  },
  brandingLeft: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "140px",
  },
  brandingLogo: {
    maxHeight: "140px",
    maxWidth: "100%",
    objectFit: "contain",
  },
  brandingSeparator: {
    width: "1px",
    height: "100px",
    background: "rgba(200,200,200,0.5)",
    margin: "0 16px",
    flexShrink: 0,
  },
  brandingRight: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "140px",
  },
  brandingNameImage: {
    maxHeight: "100px",
    maxWidth: "100%",
    objectFit: "contain",
  },
};
