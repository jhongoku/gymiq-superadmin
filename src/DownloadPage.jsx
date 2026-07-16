import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import gymiqLogo from "./assets/hero.png";

export default function DownloadPage() {
  const [searchParams] = useSearchParams();
  const gymId = searchParams.get("gym");
  const isUpdate = searchParams.get("update") === "1";

  const [showSplash, setShowSplash] = useState(true);
  const [splashVisible, setSplashVisible] = useState(false);
  const [gymInfo, setGymInfo] = useState(null);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [campaignMessage, setCampaignMessage] = useState(null);
  const [firstTimeMessage, setFirstTimeMessage] = useState(null);

  useEffect(() => {
    setSplashVisible(true);
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!gymId) return;
    const loadGym = async () => {
      try {
        const gymSnap = await getDoc(doc(db, "gyms", gymId));
        if (gymSnap.exists()) {
          setGymInfo(gymSnap.data());
        }
      } catch (error) {
        console.error("❌ ERROR CARGANDO GIMNASIO:", error);
      }
    };
    loadGym();
  }, [gymId]);

  useEffect(() => {
    if (!isUpdate) return;
    const loadCampaignMessage = async () => {
      try {
        const campaignSnap = await getDoc(doc(db, "app_config", "update_campaign"));
        if (campaignSnap.exists()) {
          setCampaignMessage(campaignSnap.data().message);
        }
      } catch (error) {
        console.error("❌ ERROR CARGANDO MENSAJE DE CAMPAÑA:", error);
      }
    };
    loadCampaignMessage();
  }, [isUpdate]);

  useEffect(() => {
    const loadFirstTimeMessage = async () => {
      try {
        const snap = await getDoc(doc(db, "app_config", "first_time_message"));
        if (snap.exists()) {
          setFirstTimeMessage(snap.data().message);
        }
      } catch (error) {
        console.error("❌ ERROR CARGANDO MENSAJE DE PRIMERA DESCARGA:", error);
      }
    };
    loadFirstTimeMessage();
  }, []);

  const handleDownload = async () => {
    setDownloadMessage("");
    try {
      const releaseSnap = await getDoc(doc(db, "app_config", "current_release"));
      if (releaseSnap.exists() && releaseSnap.data().downloadUrl) {
        window.location.href = releaseSnap.data().downloadUrl;
      } else {
        setDownloadMessage("La aplicación no está disponible por el momento. Intenta más tarde.");
      }
    } catch (error) {
      console.error("❌ ERROR OBTENIENDO RELEASE:", error);
      setDownloadMessage("La aplicación no está disponible por el momento. Intenta más tarde.");
    }
  };

  if (showSplash) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <img
          src={gymiqLogo}
          alt="GymIQ"
          style={{
            width: "180px",
            height: "180px",
            objectFit: "contain",
            opacity: splashVisible ? 1 : 0,
            transition: "opacity 0.8s ease-in-out",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundColor: "#F5F5F5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
        padding: "24px",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      {gymInfo ? (
        <>
          {gymInfo.logoUrl && (
            <div
              style={{
                width: "180px",
                height: "180px",
                borderRadius: "20px",
                backgroundColor: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                padding: "12px",
                boxSizing: "border-box",
                marginBottom: "12px",
              }}
            >
              <img
                src={gymInfo.logoUrl}
                alt={gymInfo.name || "Gimnasio"}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          )}
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 24px 0", color: "#222" }}>
            {gymInfo.name}
          </h1>
        </>
      ) : (
        <>
          <div
            style={{
              width: "180px",
              height: "180px",
              borderRadius: "20px",
              backgroundColor: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              padding: "12px",
              boxSizing: "border-box",
              marginBottom: "12px",
            }}
          >
            <img
              src={gymiqLogo}
              alt="GymIQ"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 24px 0", color: "#222" }}>
            GymIQ
          </h1>
        </>
      )}

      <p
        style={{
          maxWidth: "480px",
          fontSize: "15px",
          lineHeight: "1.6",
          color: "#444",
          marginBottom: "32px",
        }}
      >
        {campaignMessage ? campaignMessage : firstTimeMessage ? firstTimeMessage : (
          <>
            Estamos publicando GymIQ en Google Play. Mientras tanto, puedes
            descargar la app de forma segura desde aquí. Es posible que tu
            celular muestre una advertencia de "fuente desconocida": es
            normal en este proceso y no significa ningún riesgo para tus
            datos. Si prefieres confirmarlo antes de descargar, no dudes en
            preguntarle directamente al personal de tu gimnasio — con gusto
            te lo confirman.
          </>
        )}
      </p>

      <button
        onClick={handleDownload}
        style={{
          padding: "16px 36px",
          backgroundColor: "#1976D2",
          color: "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "17px",
          fontWeight: "bold",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(25,118,210,0.35)",
        }}
      >
        ⬇️ Descargar GymIQ
      </button>

      {downloadMessage && (
        <p style={{ marginTop: "16px", color: "#D32F2F", fontSize: "14px" }}>
          {downloadMessage}
        </p>
      )}
    </div>
  );
}
