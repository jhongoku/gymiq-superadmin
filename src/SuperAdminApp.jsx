import { useEffect, useState } from "react";
import SuperAdminPanel from "./SuperAdminPanel";
import { db, auth } from "./firebase";
import { collection, getDocs, doc, setDoc, updateDoc, getDoc, query, where, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import GymThemeSelector from "./components/GymThemeSelector";

function generateGymCode(gymName) {
  return gymName.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Z0-9]/g,"").slice(0,6);
}

function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 1200;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) { height = Math.round((height * MAX_DIM) / width); width = MAX_DIM; }
        else { width = Math.round((width * MAX_DIM) / height); height = MAX_DIM; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      let quality = 0.85;
      const compress = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= 500 * 1024 || quality <= 0.1) { resolve(blob); return; }
          quality = Math.max(0.1, quality - 0.15);
          compress();
        }, "image/jpeg", quality);
      };
      compress();
    };
    img.onerror = () => resolve(file);
    img.src = objectUrl;
  });
}

export default function SuperAdminApp() {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAccessLoading, setIsAccessLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [superAdminTab, setSuperAdminTab] = useState("gimnasios");
  const [gymsLoaded, setGymsLoaded] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const [bannerMessage, setBannerMessage] = useState(
    "Se estará aplicando una actualización de la aplicación a los usuarios en el transcurso de los próximos 5 días. Por favor informa a tus usuarios que estén pendientes del mensaje de actualización."
  );
  const [bannerPublishing, setBannerPublishing] = useState(false);
  const [activeBannerInfo, setActiveBannerInfo] = useState(null);
  const [updateMessage, setUpdateMessage] = useState(
    "Esta descarga es una actualización de la aplicación GymIQ. Aunque tu celular pueda mostrar una advertencia indicando que es un riesgo instalarla, es un software completamente confiable. Si prefieres confirmarlo antes de continuar, no dudes en validarlo directamente con el personal de tu gimnasio."
  );
  const [updateMessagePublishing, setUpdateMessagePublishing] = useState(false);
  const [firstTimeMessage, setFirstTimeMessage] = useState(
    'Estamos publicando GymIQ en Google Play. Mientras tanto, puedes descargar la app de forma segura desde aquí. Es posible que tu celular muestre una advertencia de "fuente desconocida": es normal en este proceso y no significa ningún riesgo para tus datos. Si prefieres confirmarlo antes de descargar, no dudes en preguntarle directamente al personal de tu gimnasio — con gusto te lo confirman.'
  );
  const [firstTimeMessagePublishing, setFirstTimeMessagePublishing] = useState(false);
  const [activeFirstTimeMessage, setActiveFirstTimeMessage] = useState(null);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [campaignGymId, setCampaignGymId] = useState("");
  const [campaignUsers, setCampaignUsers] = useState([]);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignLoaded, setCampaignLoaded] = useState(false);
  const [appApkFile, setAppApkFile] = useState(null);
  const [appApkUploading, setAppApkUploading] = useState(false);
  const [currentAppRelease, setCurrentAppRelease] = useState(null);
  const [loadingAppRelease, setLoadingAppRelease] = useState(false);

  // Gym states
  const [newGymName, setNewGymName] = useState("");
  const [newGymPrimaryColor, setNewGymPrimaryColor] = useState("#D32F2F");
  const [newGymSecondaryColor, setNewGymSecondaryColor] = useState("#000000");
  const [newGymTertiaryColor, setNewGymTertiaryColor] = useState("#FFFFFF");
  const [newGymThemeStyle, setNewGymThemeStyle] = useState("gradH");
  const [newGymPrimaryTextColor, setNewGymPrimaryTextColor] = useState("#FFFFFF");
  const [newGymSecondaryTextColor, setNewGymSecondaryTextColor] = useState("#FFFFFF");
  const [newGymLogoUrl, setNewGymLogoUrl] = useState("");
  const [newGymLogoFile, setNewGymLogoFile] = useState(null);
  const [newGymLogoPreview, setNewGymLogoPreview] = useState(null);
  const [newGymNameImageFile, setNewGymNameImageFile] = useState(null);
  const [newGymNameImagePreview, setNewGymNameImagePreview] = useState(null);
  const [editGymNameImageFile, setEditGymNameImageFile] = useState(null);
  const [editGymNameImagePreview, setEditGymNameImagePreview] = useState(null);
  const [editGymNameImageUrl, setEditGymNameImageUrl] = useState("");
  const [newGymTrainButtonColor, setNewGymTrainButtonColor] = useState("#1976D2");
  const [newGymTrainButtonTextColor, setNewGymTrainButtonTextColor] = useState("#FFFFFF");
  const [newGymTapizImageFile, setNewGymTapizImageFile] = useState(null);
  const [newGymTapizImageUrl, setNewGymTapizImageUrl] = useState("");
  const [newGymTapizBgColor, setNewGymTapizBgColor] = useState("#1565C0");
  const [newGymTapizOpacity, setNewGymTapizOpacity] = useState(0.3);
  const [newGymTapizLogoSize, setNewGymTapizLogoSize] = useState(70);
  const [editingGymId, setEditingGymId] = useState(null);
  const [editGymName, setEditGymName] = useState("");
  const [editGymPrimaryColor, setEditGymPrimaryColor] = useState("#D32F2F");
  const [editGymSecondaryColor, setEditGymSecondaryColor] = useState("#000000");
  const [editGymTertiaryColor, setEditGymTertiaryColor] = useState("#FFFFFF");
  const [editGymThemeStyle, setEditGymThemeStyle] = useState("gradH");
  const [editGymPrimaryTextColor, setEditGymPrimaryTextColor] = useState("#FFFFFF");
  const [editGymSecondaryTextColor, setEditGymSecondaryTextColor] = useState("#FFFFFF");
  const [editGymLogoUrl, setEditGymLogoUrl] = useState("");
  const [editGymLogoFile, setEditGymLogoFile] = useState(null);
  const [editGymLogoPreview, setEditGymLogoPreview] = useState(null);
  const [editGymTrainButtonColor, setEditGymTrainButtonColor] = useState("#1976D2");
  const [editGymTrainButtonTextColor, setEditGymTrainButtonTextColor] = useState("#FFFFFF");
  const [editGymTapizImageFile, setEditGymTapizImageFile] = useState(null);
  const [editGymTapizImageUrl, setEditGymTapizImageUrl] = useState("");
  const [editGymTapizBgColor, setEditGymTapizBgColor] = useState("#1565C0");
  const [editGymTapizOpacity, setEditGymTapizOpacity] = useState(0.3);
  const [editGymTapizLogoSize, setEditGymTapizLogoSize] = useState(70);
  const [usersCountByGym, setUsersCountByGym] = useState({});
  const [gymAdmins, setGymAdmins] = useState([]);
  const [newGymAdminEmail, setNewGymAdminEmail] = useState("");
  const [newGymAdminPassword, setNewGymAdminPassword] = useState("");
  const [newGymAdminGymId, setNewGymAdminGymId] = useState("");
  const [gymAdminLoading, setGymAdminLoading] = useState(false);
  const [gymAdminMessage, setGymAdminMessage] = useState("");
  const [muscleCatalog, setMuscleCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [newMuscleGroup, setNewMuscleGroup] = useState("");
  const [newStations, setNewStations] = useState("");
  const [editingMuscleId, setEditingMuscleId] = useState(null);
  const [editMuscleName, setEditMuscleName] = useState("");
  const [editStations, setEditStations] = useState("");
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setIsAccessLoading(true);
        if (!user) {
          setIsAuthenticated(false);
          setIsSuperAdmin(false);
          setCurrentUserEmail("");
          setLoading(false);
          return;
        }
        const idTokenResult = await user.getIdTokenResult(true);
        const role = idTokenResult.claims.role || "";
        setIsAuthenticated(true);
        setCurrentUserEmail(user.email || "");
        if (role === "super_admin") {
          setIsSuperAdmin(true);
        } else {
          setIsSuperAdmin(false);
          setLoading(false);
        }
      } catch (error) {
        console.error("❌ ERROR VALIDANDO ACCESO SUPER ADMIN:", error);
        setErrorMessage("No se pudo validar el acceso.");
        setLoading(false);
      } finally {
        setIsAccessLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin || gymsLoaded) return;
    const loadAll = async () => {
      try {
        setLoading(true);
        const gymsSnap = await getDocs(collection(db, "gyms"));
        const gymsList = gymsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const usersSnap = await getDocs(collection(db, "users"));
        const countMap = {};
        usersSnap.docs.forEach((d) => {
          const gymId = d.data().gymId;
          if (gymId) countMap[gymId] = (countMap[gymId] || 0) + 1;
        });
        const adminsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "gym_admin")));
        const adminsList = adminsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const catalogSnap = await getDocs(collection(db, "muscle_catalog"));
        const catalogList = catalogSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        catalogList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setGyms(gymsList);
        setUsersCountByGym(countMap);
        setGymAdmins(adminsList);
        setMuscleCatalog(catalogList);
        setGymsLoaded(true);
      } catch (error) {
        console.error("❌ ERROR CARGANDO DATOS:", error);
        setErrorMessage("No se pudo cargar la información.");
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [isAuthenticated, isSuperAdmin, gymsLoaded]);

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) return;
    const loadCurrentRelease = async () => {
      try {
        setLoadingAppRelease(true);
        const releaseSnap = await getDoc(doc(db, "app_config", "current_release"));
        if (releaseSnap.exists()) {
          setCurrentAppRelease(releaseSnap.data());
        }
      } catch (error) {
        console.error("❌ ERROR CARGANDO RELEASE ACTUAL:", error);
      } finally {
        setLoadingAppRelease(false);
      }
    };
    loadCurrentRelease();
  }, [isAuthenticated, isSuperAdmin]);

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) return;
    const loadActiveBanner = async () => {
      try {
        const bannerSnap = await getDoc(doc(db, "app_config", "update_banner"));
        if (bannerSnap.exists()) {
          setActiveBannerInfo(bannerSnap.data());
        }
      } catch (error) {
        console.error("❌ ERROR CARGANDO BANNER ACTIVO:", error);
      }
    };
    loadActiveBanner();
  }, [isAuthenticated, isSuperAdmin]);

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) return;
    const loadActiveCampaign = async () => {
      try {
        const campaignSnap = await getDoc(doc(db, "app_config", "update_campaign"));
        if (campaignSnap.exists()) {
          setActiveCampaign(campaignSnap.data());
        }
      } catch (error) {
        console.error("❌ ERROR CARGANDO CAMPAÑA ACTIVA:", error);
      }
    };
    loadActiveCampaign();
  }, [isAuthenticated, isSuperAdmin]);

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) return;
    const loadFirstTimeMessage = async () => {
      try {
        const snap = await getDoc(doc(db, "app_config", "first_time_message"));
        if (snap.exists() && snap.data().message) {
          setFirstTimeMessage(snap.data().message);
          setActiveFirstTimeMessage(snap.data());
        }
      } catch (error) {
        console.error("❌ ERROR CARGANDO MENSAJE DE PRIMERA DESCARGA:", error);
      }
    };
    loadFirstTimeMessage();
  }, [isAuthenticated, isSuperAdmin]);

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMessage("Completa todos los campos.");
      return;
    }
    try {
      setLoginLoading(true);
      setErrorMessage("");
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword.trim());
      setLoginPassword("");
    } catch (error) {
      setErrorMessage("No se pudo iniciar sesión. Verifica correo y contraseña.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAuthenticated(false);
    setIsSuperAdmin(false);
    setCurrentUserEmail("");
    setGyms([]);
    setGymsLoaded(false);
  };

  const handleUploadApk = async () => {
    const version = appVersion.trim();
    if (!version) {
      alert("Debes escribir el número de versión.");
      return;
    }
    if (!appApkFile) {
      alert("Debes seleccionar un archivo APK.");
      return;
    }
    try {
      setAppApkUploading(true);

      if (currentAppRelease?.storagePath) {
        try {
          await deleteObject(storageRef(storage, currentAppRelease.storagePath));
        } catch (deleteError) {
          console.warn("⚠️ No se pudo borrar el APK anterior:", deleteError);
        }
      }

      const storagePath = `app_releases/gymiq-${version}.apk`;
      const fileRef = storageRef(storage, storagePath);
      await uploadBytes(fileRef, appApkFile, { contentType: "application/vnd.android.package-archive" });
      const downloadUrl = await getDownloadURL(fileRef);

      const releaseData = {
        version,
        downloadUrl,
        storagePath,
        uploadedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "app_config", "current_release"), releaseData);

      setCurrentAppRelease(releaseData);
      setAppVersion("");
      setAppApkFile(null);
      alert("✅ Nueva versión de la aplicación publicada correctamente.");
    } catch (error) {
      console.error("❌ ERROR SUBIENDO APK:", error);
      alert("No se pudo subir el APK. Intenta de nuevo.");
    } finally {
      setAppApkUploading(false);
    }
  };

  const handlePublishBanner = async () => {
    const message = bannerMessage.trim();
    if (!message) {
      alert("Escribe un mensaje antes de publicar el banner.");
      return;
    }
    try {
      setBannerPublishing(true);
      const bannerData = {
        message,
        startDate: new Date().toISOString(),
      };
      await setDoc(doc(db, "app_config", "update_banner"), bannerData);
      setActiveBannerInfo(bannerData);
      alert("✅ Banner publicado. Los gym admins lo verán durante 5 días.");
    } catch (error) {
      console.error("❌ ERROR PUBLICANDO BANNER:", error);
      alert("No se pudo publicar el banner.");
    } finally {
      setBannerPublishing(false);
    }
  };

  const handleClearBanner = async () => {
    const confirmed = window.confirm("¿Eliminar el banner activo? Los gym admins dejarán de verlo inmediatamente.");
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, "app_config", "update_banner"));
      setActiveBannerInfo(null);
      setBannerMessage("");
      alert("🧹 Banner eliminado correctamente.");
    } catch (error) {
      console.error("❌ ERROR ELIMINANDO BANNER:", error);
      alert("No se pudo eliminar el banner.");
    }
  };

  const handleSaveFirstTimeMessage = async () => {
    const message = firstTimeMessage.trim();
    if (!message) {
      alert("Escribe un mensaje antes de guardar.");
      return;
    }
    try {
      setFirstTimeMessagePublishing(true);
      const data = { message, updatedAt: new Date().toISOString() };
      await setDoc(doc(db, "app_config", "first_time_message"), data);
      setActiveFirstTimeMessage(data);
      alert("✅ Mensaje de primera descarga actualizado correctamente.");
    } catch (error) {
      console.error("❌ ERROR GUARDANDO MENSAJE DE PRIMERA DESCARGA:", error);
      alert("No se pudo guardar el mensaje.");
    } finally {
      setFirstTimeMessagePublishing(false);
    }
  };

  const handlePublishUpdateMessage = async () => {
    const message = updateMessage.trim();
    if (!message) {
      alert("Escribe un mensaje antes de publicar.");
      return;
    }
    try {
      setUpdateMessagePublishing(true);
      const campaignId = new Date().toISOString();
      const campaignData = { message, campaignId, publishedAt: campaignId };
      await setDoc(doc(db, "app_config", "update_campaign"), campaignData);
      setActiveCampaign(campaignData);
      setCampaignUsers([]);
      setCampaignLoaded(false);
      alert("✅ Mensaje de actualización publicado. Ya puedes cargar el listado de teléfonos por gimnasio.");
    } catch (error) {
      console.error("❌ ERROR PUBLICANDO MENSAJE DE ACTUALIZACIÓN:", error);
      alert("No se pudo publicar el mensaje.");
    } finally {
      setUpdateMessagePublishing(false);
    }
  };

  const handleClearUpdateMessage = async () => {
    const confirmed = window.confirm("¿Eliminar el mensaje de actualización activo? La campaña actual quedará cerrada.");
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, "app_config", "update_campaign"));
      setActiveCampaign(null);
      setUpdateMessage("");
      setCampaignUsers([]);
      setCampaignLoaded(false);
    } catch (error) {
      console.error("❌ ERROR ELIMINANDO MENSAJE DE ACTUALIZACIÓN:", error);
      alert("No se pudo eliminar el mensaje.");
    }
  };

  const handleLoadCampaignList = async () => {
    if (!campaignGymId) {
      alert("Selecciona un gimnasio primero.");
      return;
    }
    if (!activeCampaign) {
      alert("Debes publicar el mensaje de actualización antes de cargar el listado.");
      return;
    }
    try {
      setCampaignLoading(true);
      const usersQuery = query(collection(db, "user_profiles"), where("gymId", "==", campaignGymId));
      const usersSnap = await getDocs(usersQuery);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const list = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => {
          if (!u.phone || !u.phone.trim()) return false;
          const endDate = u.membershipEndDate?.toDate
            ? u.membershipEndDate.toDate()
            : u.membershipEndDate ? new Date(u.membershipEndDate) : null;
          const isExpired = endDate && endDate < today;
          return u.membershipStatus === "active" && !isExpired;
        })
        .map((u) => ({
          ...u,
          sent: u.updateCampaignSentId === activeCampaign.campaignId,
        }));
      setCampaignUsers(list);
      setCampaignLoaded(true);
    } catch (error) {
      console.error("❌ ERROR CARGANDO LISTADO DE CAMPAÑA:", error);
      alert("No se pudo cargar el listado.");
    } finally {
      setCampaignLoading(false);
    }
  };

  const handleSendUpdateToUser = async (user) => {
    if (!activeCampaign) return;
    const phone = (user.phone || "").replace(/\D/g, "");
    if (!phone) return;
    const fullPhone = phone.startsWith("57") ? phone : `57${phone}`;
    const downloadLink = `https://gymiq-saas.web.app/download?gym=${user.gymId}&update=1`;
    const fullMessage = `${activeCampaign.message}\n\n${downloadLink}`;
    const encodedMessage = encodeURIComponent(fullMessage);
    const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
    try {
      await updateDoc(doc(db, "user_profiles", user.id), {
        updateCampaignSentId: activeCampaign.campaignId,
        updateCampaignSentAt: new Date().toISOString(),
      });
      setCampaignUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, sent: true } : u))
      );
    } catch (error) {
      console.error("❌ ERROR MARCANDO USUARIO COMO ENVIADO:", error);
    }
  };

  const handleDeleteApk = async () => {
    if (!currentAppRelease) return;
    const confirmed = window.confirm(
      `¿Eliminar la versión ${currentAppRelease.version}? Los usuarios ya no podrán descargar la app desde el link hasta que subas una nueva versión.`
    );
    if (!confirmed) return;
    try {
      if (currentAppRelease.storagePath) {
        await deleteObject(storageRef(storage, currentAppRelease.storagePath));
      }
      await deleteDoc(doc(db, "app_config", "current_release"));
      setCurrentAppRelease(null);
      alert("🗑️ Versión eliminada correctamente.");
    } catch (error) {
      console.error("❌ ERROR ELIMINANDO APK:", error);
      alert("No se pudo eliminar la versión.");
    }
  };

  const handleSaveGym = async () => {
    const trimmedName = newGymName.trim();
    if (!trimmedName) { setErrorMessage("Debes escribir el nombre del gimnasio."); return; }
    let logoUrl = "";
    if (newGymLogoFile) {
      const compressed = await compressImage(newGymLogoFile);
      const fileRef = storageRef(storage, `gym_logos/${Date.now()}`);
      await uploadBytes(fileRef, compressed, { contentType: "image/jpeg" });
      logoUrl = await getDownloadURL(fileRef);
    }
    let gymNameImageUrl = "";
    if (newGymNameImageFile) {
      const compressed = await compressImage(newGymNameImageFile);
      const fileRef = storageRef(storage, `gym_name_images/${Date.now()}`);
      await uploadBytes(fileRef, compressed, { contentType: "image/jpeg" });
      gymNameImageUrl = await getDownloadURL(fileRef);
    }
    let gymTapizImageUrl = "";
    if (newGymTapizImageFile) {
      const compressed = await compressImage(newGymTapizImageFile);
      const timestamp = Date.now();
      const gymId = "gym_" + trimmedName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
      const fileRef = storageRef(storage, `gym_tapiz/${gymId}/${timestamp}`);
      await uploadBytes(fileRef, compressed, { contentType: "image/jpeg" });
      gymTapizImageUrl = await getDownloadURL(fileRef);
    }
    try {
      const gymId = "gym_" + trimmedName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
      const gymCode = generateGymCode(trimmedName);
      const newGymData = { name: trimmedName, gymCode, primaryColor: newGymPrimaryColor, secondaryColor: newGymSecondaryColor, primaryTextColor: newGymPrimaryTextColor, secondaryTextColor: newGymSecondaryTextColor, tertiaryColor: newGymTertiaryColor, themeStyle: newGymThemeStyle, logoUrl, trainButtonColor: newGymTrainButtonColor, trainButtonTextColor: newGymTrainButtonTextColor, gymNameImageUrl: gymNameImageUrl, tapizImageUrl: gymTapizImageUrl, tapizBgColor: newGymTapizBgColor, tapizOpacity: newGymTapizOpacity, tapizLogoSize: newGymTapizLogoSize, active: true };
      await setDoc(doc(db, "gyms", gymId), newGymData);
      setGyms((prev) => [...prev, { id: gymId, ...newGymData }]);
      setNewGymName(""); setNewGymLogoFile(null); setNewGymLogoPreview(null); setNewGymNameImageFile(null); setNewGymNameImagePreview(null); setNewGymTapizImageFile(null); setNewGymTapizImageUrl(""); setNewGymTapizBgColor("#1565C0"); setNewGymTapizOpacity(0.3); setNewGymTapizLogoSize(70);
    } catch (error) { setErrorMessage("No se pudo guardar el gimnasio."); }
  };

  const handleUpdateGym = async () => {
    if (!editingGymId) return;
    let logoUrl = editGymLogoUrl;
    if (editGymLogoFile) {
      const compressed = await compressImage(editGymLogoFile);
      const fileRef = storageRef(storage, `gym_logos/${Date.now()}`);
      await uploadBytes(fileRef, compressed, { contentType: "image/jpeg" });
      logoUrl = await getDownloadURL(fileRef);
    }
    let updatedGymNameImageUrl = editGymNameImageUrl;
    if (editGymNameImageFile) {
      const compressed = await compressImage(editGymNameImageFile);
      const fileRef = storageRef(storage, `gym_name_images/${Date.now()}`);
      await uploadBytes(fileRef, compressed, { contentType: "image/jpeg" });
      updatedGymNameImageUrl = await getDownloadURL(fileRef);
    }
    let updatedTapizImageUrl = editGymTapizImageUrl;
    if (editGymTapizImageFile) {
      const compressed = await compressImage(editGymTapizImageFile);
      const timestamp = Date.now();
      const fileRef = storageRef(storage, `gym_tapiz/${editingGymId}/${timestamp}`);
      await uploadBytes(fileRef, compressed, { contentType: "image/jpeg" });
      updatedTapizImageUrl = await getDownloadURL(fileRef);
    }
    try {
      const updatedData = { name: editGymName, primaryColor: editGymPrimaryColor, secondaryColor: editGymSecondaryColor, primaryTextColor: editGymPrimaryTextColor, secondaryTextColor: editGymSecondaryTextColor, tertiaryColor: editGymTertiaryColor, themeStyle: editGymThemeStyle, logoUrl, trainButtonColor: editGymTrainButtonColor, trainButtonTextColor: editGymTrainButtonTextColor, gymNameImageUrl: updatedGymNameImageUrl, tapizImageUrl: updatedTapizImageUrl, tapizBgColor: editGymTapizBgColor, tapizOpacity: editGymTapizOpacity, tapizLogoSize: editGymTapizLogoSize };
      await updateDoc(doc(db, "gyms", editingGymId), updatedData);
      setGyms((prev) => prev.map((g) => g.id === editingGymId ? { ...g, ...updatedData } : g));
      setEditingGymId(null); setEditGymLogoFile(null); setEditGymLogoPreview(null); setEditGymNameImageFile(null); setEditGymNameImagePreview(null); setEditGymTapizImageFile(null); setEditGymTapizImageUrl("");
    } catch (error) { setErrorMessage("No se pudo actualizar el gimnasio."); }
  };

  const handleToggleGymActive = async (gymId, currentActive) => {
    try {
      await updateDoc(doc(db, "gyms", gymId), { active: !currentActive });
      setGyms((prev) => prev.map((g) => g.id === gymId ? { ...g, active: !currentActive } : g));
    } catch (error) { setErrorMessage("No se pudo cambiar el estado."); }
  };

  const handleRegenerateGymCode = async (gymId, gymName) => {
    if (!window.confirm(`¿Regenerar el código del gimnasio "${gymName}"?`)) return;
    const newCode = generateGymCode(gymName).slice(0, 4) + Math.floor(10 + Math.random() * 90);
    try {
      await updateDoc(doc(db, "gyms", gymId), { gymCode: newCode });
      setGyms((prev) => prev.map((g) => g.id === gymId ? { ...g, gymCode: newCode } : g));
      alert(`✅ Nuevo código: ${newCode}`);
    } catch (error) { alert("No se pudo regenerar el código."); }
  };

  const handleCreateGymAdmin = async () => {
    const email = newGymAdminEmail.trim();
    const password = newGymAdminPassword.trim();
    const gymId = newGymAdminGymId.trim();
    if (!email || !password || !gymId) { setGymAdminMessage("❌ Completa todos los campos."); return; }
    if (password.length < 6) { setGymAdminMessage("❌ La contraseña debe tener al menos 6 caracteres."); return; }
    try {
      setGymAdminLoading(true);
      setGymAdminMessage("");
      const { initializeApp, getApps } = await import("firebase/app");
      const { getAuth, createUserWithEmailAndPassword, signOut: signOutSecondary } = await import("firebase/auth");
      const secondaryAppName = "gymAdminCreator";
      const existingApp = getApps().find((app) => app.name === secondaryAppName);
      const secondaryApp = existingApp || initializeApp({ apiKey: "AIzaSyC42izEanGrKtBRembZazAZWkKkLUxACZY", authDomain: "gymiq-saas.firebaseapp.com", projectId: "gymiq-saas", storageBucket: "gymiq-saas.firebasestorage.app", messagingSenderId: "350019249810", appId: "1:350019249810:web:b4d181e297b4842be3e84b" }, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;
      await signOutSecondary(secondaryAuth);
      await setDoc(doc(db, "users", uid), { email, role: "gym_admin", gymId, createdAt: Date.now() });
      const functions = getFunctions();
      const assignClaims = httpsCallable(functions, "assignGymAdminClaims");
      await assignClaims({ uid, gymId });
      setGymAdmins((prev) => [...prev, { id: uid, email, gymId, role: "gym_admin" }]);
      setNewGymAdminEmail(""); setNewGymAdminPassword(""); setNewGymAdminGymId("");
      setGymAdminMessage("✅ Gym admin creado correctamente.");
    } catch (error) {
      setGymAdminMessage("❌ Error: " + error.message);
    } finally {
      setGymAdminLoading(false);
    }
  };

  const handleDeleteGymAdmin = async (adminId, adminEmail) => {
    if (!window.confirm(`¿Eliminar el administrador "${adminEmail}"?`)) return;
    try {
      const functions = getFunctions();
      const revokeAccess = httpsCallable(functions, "revokeGymAdminAccess");
      try { await revokeAccess({ uid: adminId }); } catch (e) { console.warn("No se pudo revocar token:", e); }
      await deleteDoc(doc(db, "users", adminId));
      setGymAdmins((prev) => prev.filter((a) => a.id !== adminId));
      alert(`✅ Administrador "${adminEmail}" eliminado.`);
    } catch (error) { alert("❌ No se pudo eliminar: " + error.message); }
  };

  const handleSaveMuscleGroup = async () => {
    const name = newMuscleGroup.trim();
    const stationsArr = newStations.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    if (!name) { setCatalogError("Escribe el nombre del grupo muscular."); return; }
    if (stationsArr.length === 0) { setCatalogError("Agrega al menos una estación."); return; }
    try {
      setCatalogError("");
      const docId = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
      const data = { name, stations: stationsArr };
      await setDoc(doc(db, "muscle_catalog", docId), data);
      setMuscleCatalog((prev) => [...prev, { id: docId, ...data }].sort((a, b) => (a.name||"").localeCompare(b.name||"")));
      setNewMuscleGroup(""); setNewStations("");
    } catch (error) { setCatalogError("No se pudo guardar."); }
  };

  const handleUpdateMuscleGroup = async (id) => {
    const name = editMuscleName.trim();
    const stationsArr = editStations.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    if (!name) { setCatalogError("El nombre no puede estar vacío."); return; }
    if (stationsArr.length === 0) { setCatalogError("Agrega al menos una estación."); return; }
    try {
      setCatalogError("");
      await updateDoc(doc(db, "muscle_catalog", id), { name, stations: stationsArr });
      setMuscleCatalog((prev) => prev.map((m) => m.id === id ? { ...m, name, stations: stationsArr } : m).sort((a, b) => (a.name||"").localeCompare(b.name||"")));
      setEditingMuscleId(null); setEditMuscleName(""); setEditStations("");
    } catch (error) { setCatalogError("No se pudo actualizar."); }
  };

  const handleDeleteMuscleGroup = async (id, name) => {
    if (!window.confirm(`¿Eliminar "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "muscle_catalog", id));
      setMuscleCatalog((prev) => prev.filter((m) => m.id !== id));
    } catch (error) { setCatalogError("No se pudo eliminar."); }
  };

  const handleDeleteStation = async (muscleId, stationToRemove) => {
    if (!window.confirm(`¿Eliminar la estación "${stationToRemove}"?`)) return;
    try {
      const target = muscleCatalog.find((m) => m.id === muscleId);
      if (!target) return;
      const updatedStations = target.stations.filter((s) => s !== stationToRemove);
      await updateDoc(doc(db, "muscle_catalog", muscleId), { stations: updatedStations });
      setMuscleCatalog((prev) => prev.map((m) => m.id === muscleId ? { ...m, stations: updatedStations } : m));
    } catch (error) { setCatalogError("No se pudo eliminar la estación."); }
  };

  if (isAccessLoading) return <div style={{ padding: "20px", fontFamily: "Arial" }}><p>Validando acceso...</p></div>;

  if (!isAuthenticated || !isSuperAdmin) {
    return (
      <div style={{ padding: "20px", fontFamily: "Arial", maxWidth: "480px", margin: "40px auto" }}>
        <h1 style={{ textAlign: "center" }}>GymIQ Super Admin</h1>
        <div style={{ backgroundColor: "#fff", border: "1px solid #e0e0e0", borderRadius: "12px", padding: "20px" }}>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>Correo</label>
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>Contraseña</label>
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", boxSizing: "border-box" }} />
          </div>
          {errorMessage && <p style={{ color: "red", marginBottom: "12px" }}>{errorMessage}</p>}
          <button onClick={handleLogin} disabled={loginLoading} style={{ width: "100%", padding: "12px", backgroundColor: loginLoading ? "#90A4AE" : "#1976D2", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
            {loginLoading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <SuperAdminPanel
      currentUserEmail={currentUserEmail}
      handleLogout={handleLogout}
      loading={loading}
      errorMessage={errorMessage}
      gyms={gyms}
      setGyms={setGyms}
      usersCountByGym={usersCountByGym}
      setUsersCountByGym={setUsersCountByGym}
      gymAdmins={gymAdmins}
      superAdminTab={superAdminTab}
      setSuperAdminTab={setSuperAdminTab}
      editingGymId={editingGymId}
      setEditingGymId={setEditingGymId}
      editGymName={editGymName} setEditGymName={setEditGymName}
      editGymPrimaryColor={editGymPrimaryColor} setEditGymPrimaryColor={setEditGymPrimaryColor}
      editGymSecondaryColor={editGymSecondaryColor} setEditGymSecondaryColor={setEditGymSecondaryColor}
      editGymTertiaryColor={editGymTertiaryColor} setEditGymTertiaryColor={setEditGymTertiaryColor}
      editGymThemeStyle={editGymThemeStyle} setEditGymThemeStyle={setEditGymThemeStyle}
      editGymPrimaryTextColor={editGymPrimaryTextColor} setEditGymPrimaryTextColor={setEditGymPrimaryTextColor}
      editGymSecondaryTextColor={editGymSecondaryTextColor} setEditGymSecondaryTextColor={setEditGymSecondaryTextColor}
      editGymLogoUrl={editGymLogoUrl} setEditGymLogoUrl={setEditGymLogoUrl}
      editGymLogoFile={editGymLogoFile} setEditGymLogoFile={setEditGymLogoFile}
      editGymLogoPreview={editGymLogoPreview} setEditGymLogoPreview={setEditGymLogoPreview}
      editGymNameImageUrl={editGymNameImageUrl} setEditGymNameImageUrl={setEditGymNameImageUrl}
      editGymNameImageFile={editGymNameImageFile} setEditGymNameImageFile={setEditGymNameImageFile}
      editGymNameImagePreview={editGymNameImagePreview} setEditGymNameImagePreview={setEditGymNameImagePreview}
      handleUpdateGym={handleUpdateGym}
      handleToggleGymActive={handleToggleGymActive}
      handleRegenerateGymCode={handleRegenerateGymCode}
      newGymName={newGymName} setNewGymName={setNewGymName}
      newGymPrimaryColor={newGymPrimaryColor} setNewGymPrimaryColor={setNewGymPrimaryColor}
      newGymSecondaryColor={newGymSecondaryColor} setNewGymSecondaryColor={setNewGymSecondaryColor}
      newGymTertiaryColor={newGymTertiaryColor} setNewGymTertiaryColor={setNewGymTertiaryColor}
      newGymThemeStyle={newGymThemeStyle} setNewGymThemeStyle={setNewGymThemeStyle}
      newGymLogoFile={newGymLogoFile} setNewGymLogoFile={setNewGymLogoFile}
      newGymLogoPreview={newGymLogoPreview} setNewGymLogoPreview={setNewGymLogoPreview}
      newGymNameImageFile={newGymNameImageFile} setNewGymNameImageFile={setNewGymNameImageFile}
      newGymNameImagePreview={newGymNameImagePreview} setNewGymNameImagePreview={setNewGymNameImagePreview}
      handleSaveGym={handleSaveGym}
      newGymAdminEmail={newGymAdminEmail} setNewGymAdminEmail={setNewGymAdminEmail}
      newGymAdminPassword={newGymAdminPassword} setNewGymAdminPassword={setNewGymAdminPassword}
      newGymAdminGymId={newGymAdminGymId} setNewGymAdminGymId={setNewGymAdminGymId}
      gymAdminLoading={gymAdminLoading}
      gymAdminMessage={gymAdminMessage}
      handleCreateGymAdmin={handleCreateGymAdmin}
      handleDeleteGymAdmin={handleDeleteGymAdmin}
      muscleCatalog={muscleCatalog}
      loadingCatalog={loadingCatalog}
      newMuscleGroup={newMuscleGroup} setNewMuscleGroup={setNewMuscleGroup}
      newStations={newStations} setNewStations={setNewStations}
      editingMuscleId={editingMuscleId} setEditingMuscleId={setEditingMuscleId}
      editMuscleName={editMuscleName} setEditMuscleName={setEditMuscleName}
      editStations={editStations} setEditStations={setEditStations}
      catalogError={catalogError} setCatalogError={setCatalogError}
      handleSaveMuscleGroup={handleSaveMuscleGroup}
      handleUpdateMuscleGroup={handleUpdateMuscleGroup}
      handleDeleteMuscleGroup={handleDeleteMuscleGroup}
      handleDeleteStation={handleDeleteStation}
      editGymTrainButtonColor={editGymTrainButtonColor} setEditGymTrainButtonColor={setEditGymTrainButtonColor}
      editGymTrainButtonTextColor={editGymTrainButtonTextColor} setEditGymTrainButtonTextColor={setEditGymTrainButtonTextColor}
      newGymTrainButtonColor={newGymTrainButtonColor} setNewGymTrainButtonColor={setNewGymTrainButtonColor}
      newGymTrainButtonTextColor={newGymTrainButtonTextColor} setNewGymTrainButtonTextColor={setNewGymTrainButtonTextColor}
      newGymTapizImageFile={newGymTapizImageFile} setNewGymTapizImageFile={setNewGymTapizImageFile}
      newGymTapizImageUrl={newGymTapizImageUrl} setNewGymTapizImageUrl={setNewGymTapizImageUrl}
      newGymTapizBgColor={newGymTapizBgColor} setNewGymTapizBgColor={setNewGymTapizBgColor}
      newGymTapizOpacity={newGymTapizOpacity} setNewGymTapizOpacity={setNewGymTapizOpacity}
      newGymTapizLogoSize={newGymTapizLogoSize} setNewGymTapizLogoSize={setNewGymTapizLogoSize}
      editGymTapizImageFile={editGymTapizImageFile} setEditGymTapizImageFile={setEditGymTapizImageFile}
      editGymTapizImageUrl={editGymTapizImageUrl} setEditGymTapizImageUrl={setEditGymTapizImageUrl}
      editGymTapizBgColor={editGymTapizBgColor} setEditGymTapizBgColor={setEditGymTapizBgColor}
      editGymTapizOpacity={editGymTapizOpacity} setEditGymTapizOpacity={setEditGymTapizOpacity}
      editGymTapizLogoSize={editGymTapizLogoSize} setEditGymTapizLogoSize={setEditGymTapizLogoSize}
      appVersion={appVersion}
      setAppVersion={setAppVersion}
      bannerMessage={bannerMessage}
      setBannerMessage={setBannerMessage}
      bannerPublishing={bannerPublishing}
      activeBannerInfo={activeBannerInfo}
      handlePublishBanner={handlePublishBanner}
      handleClearBanner={handleClearBanner}
      appApkFile={appApkFile}
      setAppApkFile={setAppApkFile}
      appApkUploading={appApkUploading}
      currentAppRelease={currentAppRelease}
      loadingAppRelease={loadingAppRelease}
      handleUploadApk={handleUploadApk}
      handleDeleteApk={handleDeleteApk}
      updateMessage={updateMessage}
      setUpdateMessage={setUpdateMessage}
      updateMessagePublishing={updateMessagePublishing}
      activeCampaign={activeCampaign}
      campaignGymId={campaignGymId}
      setCampaignGymId={setCampaignGymId}
      campaignUsers={campaignUsers}
      setCampaignUsers={setCampaignUsers}
      campaignLoading={campaignLoading}
      campaignLoaded={campaignLoaded}
      setCampaignLoaded={setCampaignLoaded}
      handlePublishUpdateMessage={handlePublishUpdateMessage}
      handleClearUpdateMessage={handleClearUpdateMessage}
      handleLoadCampaignList={handleLoadCampaignList}
      handleSendUpdateToUser={handleSendUpdateToUser}
      firstTimeMessage={firstTimeMessage}
      setFirstTimeMessage={setFirstTimeMessage}
      firstTimeMessagePublishing={firstTimeMessagePublishing}
      activeFirstTimeMessage={activeFirstTimeMessage}
      handleSaveFirstTimeMessage={handleSaveFirstTimeMessage}
    />
  );
}
