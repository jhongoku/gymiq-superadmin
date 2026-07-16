import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import GymThemeSelector from "./components/GymThemeSelector";
import LayoutManager from "./components/LayoutManager";
import RiskZoneTab from "./RiskZoneTab";

function generateGymCode(gymName) {
  return gymName.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Z0-9]/g,"").slice(0,6);
}

export default function SuperAdminPanel({
  currentUserEmail, handleLogout, loading, errorMessage,
  gyms, setGyms, usersCountByGym, setUsersCountByGym, gymAdmins,
  superAdminTab, setSuperAdminTab,
  editingGymId, setEditingGymId,
  editGymName, setEditGymName,
  editGymPrimaryColor, setEditGymPrimaryColor,
  editGymSecondaryColor, setEditGymSecondaryColor,
  editGymTertiaryColor, setEditGymTertiaryColor,
  editGymThemeStyle, setEditGymThemeStyle,
  editGymPrimaryTextColor, setEditGymPrimaryTextColor,
  editGymSecondaryTextColor, setEditGymSecondaryTextColor,
  editGymLogoUrl, setEditGymLogoUrl,
  editGymLogoFile, setEditGymLogoFile,
  editGymLogoPreview, setEditGymLogoPreview,
  editGymNameImageUrl, setEditGymNameImageUrl,
  editGymNameImageFile, setEditGymNameImageFile,
  editGymNameImagePreview, setEditGymNameImagePreview,
  handleUpdateGym, handleToggleGymActive, handleRegenerateGymCode,
  newGymName, setNewGymName,
  newGymPrimaryColor, setNewGymPrimaryColor,
  newGymSecondaryColor, setNewGymSecondaryColor,
  newGymTertiaryColor, setNewGymTertiaryColor,
  newGymThemeStyle, setNewGymThemeStyle,
  newGymLogoFile, setNewGymLogoFile,
  newGymLogoPreview, setNewGymLogoPreview,
  newGymNameImageFile, setNewGymNameImageFile,
  newGymNameImagePreview, setNewGymNameImagePreview,
  handleSaveGym,
  newGymAdminEmail, setNewGymAdminEmail,
  newGymAdminPassword, setNewGymAdminPassword,
  newGymAdminGymId, setNewGymAdminGymId,
  gymAdminLoading, gymAdminMessage,
  handleCreateGymAdmin,
  handleDeleteGymAdmin,
  editGymTrainButtonColor, setEditGymTrainButtonColor,
  editGymTrainButtonTextColor, setEditGymTrainButtonTextColor,
  newGymTrainButtonColor, setNewGymTrainButtonColor,
  newGymTrainButtonTextColor, setNewGymTrainButtonTextColor,
  muscleCatalog, loadingCatalog,
  newMuscleGroup, setNewMuscleGroup,
  newStations, setNewStations,
  editingMuscleId, setEditingMuscleId,
  editMuscleName, setEditMuscleName,
  editStations, setEditStations,
  catalogError, setCatalogError,
  handleSaveMuscleGroup, handleUpdateMuscleGroup,
  handleDeleteMuscleGroup, handleDeleteStation,
  newGymTapizImageFile, setNewGymTapizImageFile,
  newGymTapizImageUrl, setNewGymTapizImageUrl,
  newGymTapizBgColor, setNewGymTapizBgColor,
  newGymTapizOpacity, setNewGymTapizOpacity,
  newGymTapizLogoSize, setNewGymTapizLogoSize,
  editGymTapizImageFile, setEditGymTapizImageFile,
  editGymTapizImageUrl, setEditGymTapizImageUrl,
  editGymTapizBgColor, setEditGymTapizBgColor,
  editGymTapizOpacity, setEditGymTapizOpacity,
  editGymTapizLogoSize, setEditGymTapizLogoSize,
  appVersion, setAppVersion,
  bannerMessage, setBannerMessage,
  bannerPublishing,
  activeBannerInfo,
  handlePublishBanner,
  handleClearBanner,
  appApkFile, setAppApkFile,
  appApkUploading,
  currentAppRelease,
  loadingAppRelease,
  handleUploadApk,
  handleDeleteApk,
  updateMessage, setUpdateMessage,
  updateMessagePublishing,
  activeCampaign,
  campaignGymId, setCampaignGymId,
  campaignUsers, setCampaignUsers,
  campaignLoading,
  campaignLoaded, setCampaignLoaded,
  handlePublishUpdateMessage,
  handleClearUpdateMessage,
  handleLoadCampaignList,
  handleSendUpdateToUser,
  firstTimeMessage, setFirstTimeMessage,
  firstTimeMessagePublishing,
  activeFirstTimeMessage,
  handleSaveFirstTimeMessage,
}) {
  const [expandedGymId, setExpandedGymId] = useState(null);
  const [gymSearch, setGymSearch] = useState("");

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center" }}>GymIQ Super Admin Panel</h1>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <p style={{ margin: 0 }}>Usuario: <strong>{currentUserEmail}</strong></p>
        <button onClick={handleLogout} style={{ padding: "8px 14px", backgroundColor: "#424242", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Cerrar sesión</button>
      </div>

      <div style={{ display: "flex", marginBottom: "24px", borderBottom: "2px solid #e0e0e0" }}>
        {[{ key: "gimnasios", label: "🏋️ Gimnasios" }, { key: "crear", label: "➕ Crear gimnasio" }, { key: "admins", label: "👤 Administradores" }, { key: "catalogo", label: "💪 Grupos Musculares" }, { key: "credenciales", label: "🔐 Credenciales" }, { key: "aplicacion", label: "📱 Aplicación" }, { key: "riesgo", label: "🗑️ Zona de Riesgo" }].map((tab) => (
          <button key={tab.key} onClick={() => setSuperAdminTab(tab.key)} style={{ padding: "12px 24px", backgroundColor: superAdminTab === tab.key ? "#1976D2" : "#f5f5f5", color: superAdminTab === tab.key ? "#fff" : "#333", border: "none", borderBottom: superAdminTab === tab.key ? "2px solid #1976D2" : "2px solid transparent", cursor: "pointer", fontWeight: superAdminTab === tab.key ? "bold" : "normal", fontSize: "14px" }}>{tab.label}</button>
        ))}
      </div>

      {loading && <p>Cargando...</p>}
      {!loading && errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}

      {superAdminTab === "gimnasios" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <p style={{ margin: 0 }}><strong>Total de gimnasios:</strong> {gyms.length}</p>
            <input
              type="text"
              value={gymSearch}
              onChange={(e) => setGymSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px", width: "220px" }}
            />
          </div>
          {gyms.length === 0 && <p>No hay gimnasios registrados todavía.</p>}
          {gyms
            .filter((gym) => gym.name?.toLowerCase().includes(gymSearch.toLowerCase()))
            .map((gym) => {
              const isExpanded = expandedGymId === gym.id;
              return (
                <div key={gym.id} style={{ border: "1px solid #e0e0e0", borderRadius: "12px", marginBottom: "10px", backgroundColor: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                  <div
                    onClick={() => setExpandedGymId(isExpanded ? null : gym.id)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", cursor: "pointer", userSelect: "none" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <span style={{ fontSize: "16px", fontWeight: "bold" }}>{gym.name}</span>
                      <span style={{ fontSize: "13px", color: gym.active ? "#2E7D32" : "#C62828", fontWeight: "bold" }}>{gym.active ? "Activo" : "Inactivo"}</span>
                      <span style={{ fontSize: "13px", color: "#555" }}>👤 {usersCountByGym[gym.id] || 0}</span>
                    </div>
                    <span style={{ fontSize: "18px", color: "#999" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: "0 20px 20px 20px", borderTop: "1px solid #f0f0f0" }}>
                      <p style={{ margin: "12px 0 4px" }}><strong>ID:</strong> {gym.id}</p>
                      <p style={{ margin: "4px 0" }}><strong>Color 1:</strong> {gym.primaryColor}</p>
                      <p style={{ margin: "4px 0" }}><strong>Color 2:</strong> {gym.secondaryColor}</p>
                      <p style={{ margin: "4px 0" }}><strong>Color 3:</strong> {gym.tertiaryColor || "No definido"}</p>
                      <p style={{ margin: "4px 0" }}><strong>Estilo visual:</strong> {gym.themeStyle || "No definido"}</p>
                      <p style={{ margin: "4px 0" }}><strong>Usuarios:</strong> {usersCountByGym[gym.id] || 0}</p>
                      <p style={{ margin: "4px 0" }}>
                        <strong>Código:</strong> {gym.gymCode || generateGymCode(gym.name || "")}
                        <button onClick={(e) => { e.stopPropagation(); handleRegenerateGymCode(gym.id, gym.name); }} style={{ marginLeft: "12px", padding: "4px 10px", backgroundColor: "#E65100", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>🔄 Regenerar</button>
                      </p>
                      <p style={{ margin: "4px 0" }}><strong>Estado:</strong> <span style={{ color: gym.active ? "green" : "red", fontWeight: "bold" }}>{gym.active ? "Activo" : "Inactivo"}</span></p>
                      {gym.logoUrl && <img src={gym.logoUrl} alt="Logo" style={{ width: "80px", height: "80px", objectFit: "contain", borderRadius: "8px", border: "1px solid #ccc", margin: "10px 0", display: "block" }} />}
                      <div style={{ marginBottom: "10px" }}>
                        <p style={{ fontWeight: "bold", marginBottom: "8px" }}>Código QR:</p>
                        <QRCodeCanvas value={gym.gymCode || generateGymCode(gym.name || "")} size={160} bgColor="#ffffff" fgColor="#000000" level="H" id={`qr-${gym.id}`} />
                        <div style={{ marginTop: "8px" }}>
                          <button onClick={() => { const canvas = document.getElementById(`qr-${gym.id}`); if (!canvas) return; const url = canvas.toDataURL("image/png"); const link = document.createElement("a"); link.href = url; link.download = `QR_${gym.gymCode || gym.name}.png`; link.click(); }} style={{ padding: "8px 14px", backgroundColor: "#6A1B9A", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>⬇️ Descargar QR</button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
                        <button onClick={() => { setEditingGymId(gym.id); setEditGymName(gym.name||""); setEditGymPrimaryColor(gym.primaryColor||"#D32F2F"); setEditGymSecondaryColor(gym.secondaryColor||"#000000"); setEditGymTertiaryColor(gym.tertiaryColor||"#FFFFFF"); setEditGymThemeStyle(gym.themeStyle||"gradH"); setEditGymPrimaryTextColor(gym.primaryTextColor||"#FFFFFF"); setEditGymSecondaryTextColor(gym.secondaryTextColor||"#FFFFFF"); setEditGymLogoUrl(gym.logoUrl||""); setEditGymTrainButtonColor(gym.trainButtonColor||"#1976D2"); setEditGymTrainButtonTextColor(gym.trainButtonTextColor||"#FFFFFF"); setEditGymNameImageUrl(gym.gymNameImageUrl||""); setEditGymNameImageFile(null); setEditGymNameImagePreview(null); setEditGymTapizImageUrl(gym.tapizImageUrl||""); setEditGymTapizBgColor(gym.tapizBgColor||"#1565C0"); setEditGymTapizOpacity(gym.tapizOpacity||0.3); setEditGymTapizLogoSize(gym.tapizLogoSize||70); }} style={{ padding: "8px 14px", backgroundColor: "#1976D2", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>✏️ Editar</button>
                        <button onClick={() => handleToggleGymActive(gym.id, gym.active)} style={{ padding: "8px 14px", backgroundColor: gym.active ? "#C62828" : "#2E7D32", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>{gym.active ? "Desactivar" : "Activar"}</button>
                      </div>
                      {editingGymId === gym.id && (
                        <div style={{ marginTop: "16px", padding: "16px", backgroundColor: "#f5f5f5", border: "1px solid #d0d0d0", borderRadius: "10px" }}>
                          <h3 style={{ marginTop: 0 }}>Editar gimnasio</h3>
                          <div style={{ marginBottom: "10px" }}>
                            <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Nombre</label>
                            <input type="text" value={editGymName} onChange={(e) => setEditGymName(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                          </div>
                          <div style={{ marginBottom: "10px" }}>
                            <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Logo</label>
                            {editGymLogoUrl && !editGymLogoPreview && <img src={editGymLogoUrl} alt="Logo actual" style={{ width: "80px", height: "80px", objectFit: "contain", borderRadius: "8px", border: "1px solid #ccc", marginBottom: "8px", display: "block" }} />}
                            <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; setEditGymLogoFile(file); setEditGymLogoPreview(URL.createObjectURL(file)); }} style={{ width: "100%", boxSizing: "border-box" }} />
                            {editGymLogoPreview && <img src={editGymLogoPreview} alt="Vista previa" style={{ marginTop: "10px", width: "80px", height: "80px", objectFit: "contain", borderRadius: "8px", border: "1px solid #ccc" }} />}
                          </div>
                          <div style={{ marginBottom: "10px" }}>
                            <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Imagen del nombre del gimnasio</label>
                            <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#666" }}>
                              Aparece en la parte superior derecha de la app junto al logo.
                            </p>
                            {editGymNameImageUrl && !editGymNameImagePreview && (
                              <img
                                src={editGymNameImageUrl}
                                alt="Imagen nombre actual"
                                style={{ width: "160px", height: "60px", objectFit: "contain", borderRadius: "8px", border: "1px solid #ccc", marginBottom: "8px", display: "block" }}
                              />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setEditGymNameImageFile(file);
                                setEditGymNameImagePreview(URL.createObjectURL(file));
                              }}
                              style={{ width: "100%", boxSizing: "border-box" }}
                            />
                            {editGymNameImagePreview && (
                              <img
                                src={editGymNameImagePreview}
                                alt="Vista previa nombre"
                                style={{ marginTop: "10px", width: "160px", height: "60px", objectFit: "contain", borderRadius: "8px", border: "1px solid #ccc" }}
                              />
                            )}
                          </div>
                          <GymThemeSelector primaryColor={editGymPrimaryColor} secondaryColor={editGymSecondaryColor} tertiaryColor={editGymTertiaryColor} themeStyle={editGymThemeStyle} onPrimaryColorChange={setEditGymPrimaryColor} onSecondaryColorChange={setEditGymSecondaryColor} onTertiaryColorChange={setEditGymTertiaryColor} onThemeStyleChange={setEditGymThemeStyle} trainButtonColor={editGymTrainButtonColor} onTrainButtonColorChange={setEditGymTrainButtonColor} trainButtonTextColor={editGymTrainButtonTextColor} onTrainButtonTextColorChange={setEditGymTrainButtonTextColor} tapizImageUrl={editGymTapizImageUrl} onTapizImageChange={(file) => { setEditGymTapizImageFile(file); setEditGymTapizImageUrl(URL.createObjectURL(file)); }} tapizBgColor={editGymTapizBgColor} onTapizBgColorChange={setEditGymTapizBgColor} tapizOpacity={editGymTapizOpacity} onTapizOpacityChange={setEditGymTapizOpacity} tapizLogoSize={editGymTapizLogoSize} onTapizLogoSizeChange={setEditGymTapizLogoSize} />
                          <LayoutManager gymId={gym.id} />
                          <button onClick={handleUpdateGym} style={{ marginTop: "16px", padding: "10px 16px", backgroundColor: "#2E7D32", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Guardar cambios</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {superAdminTab === "crear" && (
        <div style={{ backgroundColor: "#fff", border: "1px solid #e0e0e0", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
          <h2 style={{ marginTop: 0 }}>Nuevo gimnasio</h2>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>Nombre del gimnasio</label>
            <input type="text" value={newGymName} onChange={(e) => setNewGymName(e.target.value)} placeholder="Ej: Gym Bronze" style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>Logo del gimnasio</label>
            <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; setNewGymLogoFile(file); setNewGymLogoPreview(URL.createObjectURL(file)); }} style={{ width: "100%", boxSizing: "border-box" }} />
            {newGymLogoPreview && <img src={newGymLogoPreview} alt="Vista previa" style={{ marginTop: "10px", width: "80px", height: "80px", objectFit: "contain", borderRadius: "8px", border: "1px solid #ccc" }} />}
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>Imagen del nombre del gimnasio</label>
            <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#666" }}>
              Esta imagen aparecerá en la parte superior derecha de la app, junto al logo.
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setNewGymNameImageFile(file);
                setNewGymNameImagePreview(URL.createObjectURL(file));
              }}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            {newGymNameImagePreview && (
              <img
                src={newGymNameImagePreview}
                alt="Vista previa nombre"
                style={{ marginTop: "10px", width: "160px", height: "60px", objectFit: "contain", borderRadius: "8px", border: "1px solid #ccc" }}
              />
            )}
          </div>
          <GymThemeSelector primaryColor={newGymPrimaryColor} secondaryColor={newGymSecondaryColor} tertiaryColor={newGymTertiaryColor} themeStyle={newGymThemeStyle} onPrimaryColorChange={setNewGymPrimaryColor} onSecondaryColorChange={setNewGymSecondaryColor} onTertiaryColorChange={setNewGymTertiaryColor} onThemeStyleChange={setNewGymThemeStyle} trainButtonColor={newGymTrainButtonColor} onTrainButtonColorChange={setNewGymTrainButtonColor} trainButtonTextColor={newGymTrainButtonTextColor} onTrainButtonTextColorChange={setNewGymTrainButtonTextColor} tapizImageUrl={newGymTapizImageUrl} onTapizImageChange={(file) => { setNewGymTapizImageFile(file); setNewGymTapizImageUrl(URL.createObjectURL(file)); }} tapizBgColor={newGymTapizBgColor} onTapizBgColorChange={setNewGymTapizBgColor} tapizOpacity={newGymTapizOpacity} onTapizOpacityChange={setNewGymTapizOpacity} tapizLogoSize={newGymTapizLogoSize} onTapizLogoSizeChange={setNewGymTapizLogoSize} />
          <button onClick={handleSaveGym} style={{ marginTop: "16px", padding: "10px 16px", backgroundColor: "#388E3C", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Guardar gimnasio</button>
        </div>
      )}

      {superAdminTab === "catalogo" && (
        <div>
          <h2 style={{ marginTop: 0 }}>💪 Grupos Musculares y Estaciones</h2>
          <p style={{ color: "#666", fontSize: "14px", marginBottom: "20px" }}>
            Catálogo global. Los cambios se reflejan en todas las apps de todos los gimnasios.
          </p>

          {catalogError && (
            <p style={{ color: "red", fontWeight: "bold", marginBottom: "12px" }}>{catalogError}</p>
          )}

          {/* CREAR GRUPO */}
          <div style={{ padding: "16px", backgroundColor: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: "10px", marginBottom: "24px" }}>
            <h3 style={{ marginTop: 0, color: "#2E7D32" }}>➕ Nuevo grupo muscular</h3>
            <div style={{ marginBottom: "10px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Nombre del grupo muscular</label>
              <input type="text" value={newMuscleGroup} onChange={(e) => setNewMuscleGroup(e.target.value)} placeholder="Ej: Pecho" style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box", fontSize: "14px" }} />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Estaciones (separadas por coma)</label>
              <input type="text" value={newStations} onChange={(e) => setNewStations(e.target.value)} placeholder="Ej: Banco Plano, Banco Inclinado, Peso corporal" style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box", fontSize: "14px" }} />
            </div>
            <button onClick={handleSaveMuscleGroup} style={{ padding: "10px 20px", backgroundColor: "#2E7D32", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
              Guardar grupo muscular
            </button>
          </div>

          {/* LISTADO */}
          {loadingCatalog && <p>Cargando catálogo...</p>}
          {!loadingCatalog && muscleCatalog.length === 0 && (
            <p style={{ color: "#777" }}>No hay grupos musculares registrados. Crea el primero arriba.</p>
          )}
          {!loadingCatalog && muscleCatalog.map((muscle) => (
            <div key={muscle.id} style={{ border: "1px solid #e0e0e0", borderRadius: "10px", padding: "16px", marginBottom: "14px", backgroundColor: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
              {editingMuscleId === muscle.id ? (
                <div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Nombre del grupo</label>
                    <input type="text" value={editMuscleName} onChange={(e) => setEditMuscleName(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Estaciones (separadas por coma)</label>
                    <input type="text" value={editStations} onChange={(e) => setEditStations(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => handleUpdateMuscleGroup(muscle.id)} style={{ padding: "8px 16px", backgroundColor: "#2E7D32", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>💾 Guardar cambios</button>
                    <button onClick={() => { setEditingMuscleId(null); setCatalogError(""); }} style={{ padding: "8px 16px", backgroundColor: "#e0e0e0", color: "#333", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h3 style={{ margin: 0, color: "#1565C0", fontSize: "18px" }}>{muscle.name}</h3>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => { setEditingMuscleId(muscle.id); setEditMuscleName(muscle.name); setEditStations((muscle.stations || []).join(", ")); setCatalogError(""); }} style={{ padding: "6px 12px", backgroundColor: "#1976D2", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>✏️ Editar</button>
                      <button onClick={() => handleDeleteMuscleGroup(muscle.id, muscle.name)} style={{ padding: "6px 12px", backgroundColor: "#D32F2F", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>🗑️ Eliminar grupo</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(muscle.stations || []).map((station) => (
                      <div key={station} style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#e3f2fd", border: "1px solid #90caf9", borderRadius: "20px", padding: "4px 12px", fontSize: "13px", color: "#1565C0" }}>
                        <span>{station}</span>
                        <button onClick={() => handleDeleteStation(muscle.id, station)} style={{ background: "none", border: "none", color: "#D32F2F", cursor: "pointer", fontWeight: "bold", fontSize: "13px", padding: "0", lineHeight: 1 }} title="Eliminar estación">✖</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {superAdminTab === "admins" && (
        <div>
          <div style={{ backgroundColor: "#fff", border: "1px solid #e0e0e0", borderRadius: "12px", padding: "24px", marginBottom: "16px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
            <h2 style={{ marginTop: 0 }}>Administradores de gimnasio</h2>
            {gymAdmins.length === 0 ? <p style={{ color: "#777" }}>No hay administradores registrados.</p> : gymAdmins.map((admin) => {
              const assignedGym = gyms.find((g) => g.id === admin.gymId);
              return (
                <div key={admin.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", marginBottom: "8px", border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "#fafafa" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>{admin.email}</p>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#555" }}>{assignedGym ? assignedGym.name : "Sin gimnasio asignado"}</p>
                  </div>
                  <button onClick={() => { if (window.confirm("¿Eliminar este administrador?")) { alert("Funcionalidad próximamente"); } }} style={{ padding: "6px 12px", backgroundColor: "#D32F2F", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>🗑️ Eliminar</button>
                </div>
              );
            })}
          </div>
          <div style={{ backgroundColor: "#fff", border: "1px solid #e0e0e0", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
            <h2 style={{ marginTop: 0 }}>Nuevo administrador</h2>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>Correo electrónico</label>
              <input type="text" value={newGymAdminEmail} onChange={(e) => setNewGymAdminEmail(e.target.value)} placeholder="admin@ejemplo.com" style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>Contraseña</label>
              <input type="password" value={newGymAdminPassword} onChange={(e) => setNewGymAdminPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>Gimnasio asignado</label>
              <select value={newGymAdminGymId} onChange={(e) => setNewGymAdminGymId(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }}>
                <option value="">-- Selecciona un gimnasio --</option>
                {gyms.map((gym) => (<option key={gym.id} value={gym.id}>{gym.name}</option>))}
              </select>
            </div>
            <button onClick={handleCreateGymAdmin} disabled={gymAdminLoading} style={{ padding: "10px 20px", backgroundColor: gymAdminLoading ? "#aaa" : "#1976D2", color: "#fff", border: "none", borderRadius: "8px", cursor: gymAdminLoading ? "not-allowed" : "pointer", fontWeight: "bold" }}>{gymAdminLoading ? "Creando..." : "Crear admin"}</button>
            {gymAdminMessage && <p style={{ marginTop: "12px", fontSize: "14px" }}>{gymAdminMessage}</p>}
          </div>
        </div>
      )}
      {superAdminTab === "riesgo" && (
        <RiskZoneTab
          gyms={gyms}
          setGyms={setGyms}
          setUsersCountByGym={setUsersCountByGym}
        />
      )}

      {superAdminTab === "aplicacion" && (
        <div>
          <div style={{ marginBottom: "24px", padding: "20px", backgroundColor: "#fff", border: "1px solid #e0e0e0", borderRadius: "12px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0 }}>💬 Mensaje de bienvenida (primera descarga)</h3>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "16px" }}>
              Este es el mensaje de confianza que ve cualquier usuario la primera
              vez que entra a la página de descarga (sin que sea una actualización).
            </p>
            <div style={{ marginBottom: "12px" }}>
              <textarea
                value={firstTimeMessage}
                onChange={(e) => setFirstTimeMessage(e.target.value)}
                rows={4}
                style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box", fontSize: "14px", resize: "vertical" }}
              />
            </div>
            {activeFirstTimeMessage && (
              <p style={{ margin: "0 0 12px 0", fontSize: "11px", color: "#666" }}>
                Última actualización: {new Date(activeFirstTimeMessage.updatedAt).toLocaleString("es-CO")}
              </p>
            )}
            <button
              onClick={handleSaveFirstTimeMessage}
              disabled={firstTimeMessagePublishing}
              style={{ padding: "10px 18px", backgroundColor: firstTimeMessagePublishing ? "#90A4AE" : "#1976D2", color: "#fff", border: "none", borderRadius: "6px", cursor: firstTimeMessagePublishing ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "13px" }}
            >
              {firstTimeMessagePublishing ? "Guardando..." : "💾 Guardar mensaje"}
            </button>
          </div>

          <h2 style={{ marginTop: 0 }}>📱 Gestión de la Aplicación</h2>
          <p style={{ color: "#666", fontSize: "14px", marginBottom: "20px" }}>
            Sube el archivo APK que los usuarios descargarán desde la página
            de descarga mientras la app no esté publicada en Google Play.
          </p>

          {loadingAppRelease && <p>Cargando información de la versión actual...</p>}

          {!loadingAppRelease && currentAppRelease && (
            <div style={{ padding: "16px", backgroundColor: "#E8F5E9", border: "1px solid #2E7D32", borderRadius: "10px", marginBottom: "24px" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#1B5E20" }}>Versión actual</h3>
              <p style={{ margin: "4px 0" }}><strong>Versión:</strong> {currentAppRelease.version}</p>
              <p style={{ margin: "4px 0" }}><strong>Subida el:</strong> {new Date(currentAppRelease.uploadedAt).toLocaleString("es-CO")}</p>
              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <a
                  href={currentAppRelease.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: "8px 14px", backgroundColor: "#1976D2", color: "#fff", border: "none", borderRadius: "6px", textDecoration: "none", fontWeight: "bold", fontSize: "13px" }}
                >
                  ⬇️ Descargar APK actual
                </a>
                <button
                  onClick={handleDeleteApk}
                  style={{ padding: "8px 14px", backgroundColor: "#D32F2F", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
                >
                  🗑️ Eliminar versión
                </button>
              </div>
            </div>
          )}

          {!loadingAppRelease && !currentAppRelease && (
            <p style={{ color: "#777", marginBottom: "20px" }}>No hay ninguna versión publicada todavía.</p>
          )}

          <div style={{ padding: "20px", backgroundColor: "#fff", border: "1px solid #e0e0e0", borderRadius: "12px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0 }}>
              {currentAppRelease ? "Subir nueva versión (reemplaza la actual)" : "Subir primera versión"}
            </h3>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>
                Número de versión
              </label>
              <input
                type="text"
                value={appVersion}
                onChange={(e) => setAppVersion(e.target.value)}
                placeholder="Ej: 1.2.0"
                style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>
                Mensaje del banner para gym admins (se mostrará 5 días)
              </label>
              <textarea
                value={bannerMessage}
                onChange={(e) => setBannerMessage(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box", fontSize: "14px", resize: "vertical" }}
              />
              {activeBannerInfo && (
                <div style={{ marginTop: "10px", padding: "10px 14px", backgroundColor: "#E3F2FD", border: "1px solid #1976D2", borderRadius: "8px" }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: "12px", fontWeight: "bold", color: "#0D47A1" }}>
                    📌 Banner actualmente activo:
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", color: "#333" }}>{activeBannerInfo.message}</p>
                  <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#666" }}>
                    Publicado el: {new Date(activeBannerInfo.startDate).toLocaleString("es-CO")}
                  </p>
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <button
                  onClick={handlePublishBanner}
                  disabled={bannerPublishing}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: bannerPublishing ? "#90A4AE" : "#1976D2",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: bannerPublishing ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                    fontSize: "13px",
                  }}
                >
                  {bannerPublishing ? "Publicando..." : "📤 Publicar banner"}
                </button>
                <button
                  onClick={handleClearBanner}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: "#D32F2F",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "13px",
                  }}
                >
                  🧹 Limpiar mensaje
                </button>
              </div>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>
                Archivo APK
              </label>
              <input
                type="file"
                accept=".apk"
                onChange={(e) => setAppApkFile(e.target.files?.[0] || null)}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              {appApkFile && (
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#555" }}>
                  Archivo seleccionado: {appApkFile.name}
                </p>
              )}
            </div>
            <button
              onClick={handleUploadApk}
              disabled={appApkUploading}
              style={{
                padding: "10px 20px",
                backgroundColor: appApkUploading ? "#90A4AE" : "#388E3C",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: appApkUploading ? "not-allowed" : "pointer",
                fontWeight: "bold",
              }}
            >
              {appApkUploading ? "Subiendo..." : "⬆️ Publicar versión"}
            </button>
          </div>

          <div style={{ marginTop: "24px", padding: "20px", backgroundColor: "#fff", border: "1px solid #e0e0e0", borderRadius: "12px", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0 }}>📲 Campaña de actualización para usuarios</h3>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "16px" }}>
              Este mensaje se mostrará tanto en el WhatsApp que se envía a los
              usuarios como en la página de descarga cuando accedan al link de
              actualización.
            </p>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>
                Mensaje de actualización
              </label>
              <textarea
                value={updateMessage}
                onChange={(e) => setUpdateMessage(e.target.value)}
                rows={4}
                style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box", fontSize: "14px", resize: "vertical" }}
              />
            </div>

            {activeCampaign && (
              <div style={{ marginBottom: "12px", padding: "10px 14px", backgroundColor: "#E8F5E9", border: "1px solid #2E7D32", borderRadius: "8px" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "12px", fontWeight: "bold", color: "#1B5E20" }}>
                  📌 Campaña activa:
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#333" }}>{activeCampaign.message}</p>
                <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#666" }}>
                  Publicada el: {new Date(activeCampaign.publishedAt).toLocaleString("es-CO")}
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <button
                onClick={handlePublishUpdateMessage}
                disabled={updateMessagePublishing}
                style={{ padding: "10px 18px", backgroundColor: updateMessagePublishing ? "#90A4AE" : "#25D366", color: "#fff", border: "none", borderRadius: "6px", cursor: updateMessagePublishing ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "13px" }}
              >
                {updateMessagePublishing ? "Publicando..." : "📤 Publicar mensaje de actualización"}
              </button>
              <button
                onClick={handleClearUpdateMessage}
                style={{ padding: "10px 18px", backgroundColor: "#D32F2F", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
              >
                🧹 Limpiar mensaje
              </button>
            </div>

            <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "16px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>
                Seleccionar gimnasio
              </label>
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                <select
                  value={campaignGymId}
                  onChange={(e) => { setCampaignGymId(e.target.value); setCampaignUsers([]); setCampaignLoaded(false); }}
                  style={{ flex: 1, minWidth: "220px", padding: "10px", border: "1px solid #ccc", borderRadius: "6px" }}
                >
                  <option value="">-- Selecciona un gimnasio --</option>
                  {gyms.map((gym) => (
                    <option key={gym.id} value={gym.id}>{gym.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleLoadCampaignList}
                  disabled={campaignLoading || !campaignGymId}
                  style={{ padding: "10px 18px", backgroundColor: campaignLoading || !campaignGymId ? "#90A4AE" : "#1976D2", color: "#fff", border: "none", borderRadius: "6px", cursor: campaignLoading || !campaignGymId ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "13px" }}
                >
                  {campaignLoading ? "Cargando..." : "📋 Cargar listado de teléfonos"}
                </button>
              </div>

              {campaignLoaded && campaignUsers.length === 0 && (
                <p style={{ color: "#777" }}>No hay usuarios con membresía activa y teléfono registrado en este gimnasio.</p>
              )}

              {campaignLoaded && campaignUsers.length > 0 && campaignUsers.every((u) => u.sent) && (
                <p style={{ color: "#2E7D32", fontWeight: "bold", padding: "14px", backgroundColor: "#E8F5E9", borderRadius: "8px" }}>
                  ✅ Todos los usuarios de este gimnasio ya fueron notificados de esta actualización.
                </p>
              )}

              {campaignLoaded && campaignUsers.length > 0 && !campaignUsers.every((u) => u.sent) && (
                <div>
                  <p style={{ fontWeight: "bold", marginBottom: "10px", fontSize: "13px" }}>
                    {campaignUsers.filter((u) => u.sent).length} / {campaignUsers.length} enviados
                  </p>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {campaignUsers.map((user) => (
                      <div
                        key={user.id}
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "10px 14px", borderRadius: "8px",
                          backgroundColor: user.sent ? "#EEEEEE" : "#E8F5E9",
                          border: user.sent ? "1px solid #BDBDBD" : "1px solid #25D366",
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontWeight: "bold", fontSize: "13px" }}>{user.name || user.nickname || user.idNumber}</p>
                          <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>{user.phone}</p>
                        </div>
                        {user.sent ? (
                          <span style={{ padding: "6px 12px", backgroundColor: "#9E9E9E", color: "#fff", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" }}>
                            ✅ Enviado
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendUpdateToUser(user)}
                            style={{ padding: "6px 14px", backgroundColor: "#25D366", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
                          >
                            📲 Enviar actualización
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {superAdminTab === "credenciales" && (
        <div>
          <h2 style={{ marginTop: 0 }}>🔐 Credenciales de Gimnasios</h2>
          <p style={{ color: "#666", fontSize: "14px", marginBottom: "20px" }}>
            Desde aquí puedes eliminar el acceso de un administrador de gimnasio. El gimnasio y sus datos no se verán afectados. Luego puedes crear un nuevo administrador desde la pestaña Administradores.
          </p>

          {gymAdmins.length === 0 && (
            <p style={{ color: "#777" }}>No hay administradores registrados.</p>
          )}

          {gymAdmins.length > 0 && (
            <div style={{ display: "grid", gap: "10px" }}>
              {gymAdmins.map((admin) => {
                const assignedGym = gyms.find((g) => g.id === admin.gymId);
                return (
                  <div
                    key={admin.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 16px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "10px",
                      backgroundColor: "#fafafa",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: "bold", fontSize: "14px" }}>
                        {admin.email}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#555" }}>
                        {assignedGym ? assignedGym.name : "Sin gimnasio asignado"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteGymAdmin(admin.id, admin.email)}
                      style={{
                        padding: "8px 14px",
                        backgroundColor: "#D32F2F",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "13px",
                        flexShrink: 0,
                      }}
                    >
                      🗑️ Eliminar acceso
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
