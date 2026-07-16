import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import GymThemeSelector from "./components/GymThemeSelector";
import gymiqLogo from "./assets/hero.png";
import { db, auth } from "./firebase";
import { collection, getDocs, addDoc, doc, setDoc, updateDoc, getDoc, query, where, deleteDoc, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import * as XLSX from "xlsx";

function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 1200;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      let quality = 0.85;
      const compress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size <= 500 * 1024 || quality <= 0.1) { resolve(blob); return; }
            quality = Math.max(0.1, quality - 0.15);
            compress();
          },
          "image/jpeg",
          quality
        );
      };
      compress();
    };
    img.onerror = () => resolve(file);
    img.src = objectUrl;
  });
}

function storagePathFromUrl(url) {
  try {
    const match = url.match(/\/o\/(.+?)(?:\?|$)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function generateGymCode(gymName) {
  return gymName
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function timeAgo(createdAt) {
  const date = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Hace un momento";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

const exerciseNameSuggestions = {
  "Pecho": { "Banco Plano": "Press de Banca Plano", "Banco Inclinado": "Press de Banca Inclinado", "Banco Declinado": "Press de Banca Declinado", "Contractora de pecho": "Contractora de Pecho", "Peso corporal": "Fondos de Pecho" },
  "Cuello": { "Lastre": "Flexión de Cuello con Lastre", "Peso corporal": "Flexión de Cuello" },
  "Deltoides": { "Polea Multipower": "Elevación Lateral en Polea", "Mancuerna": "Elevación Lateral con Mancuerna", "Barra": "Press Militar con Barra", "Maquina Smith": "Press de Hombro en Smith", "Hammer": "Press Hammer de Hombro" },
  "Hombro": { "Polea Multipower": "Elevación Frontal en Polea", "Mancuerna": "Press de Hombro con Mancuerna", "Barra": "Press Militar con Barra", "Maquina Smith": "Press de Hombro en Smith", "Hammer": "Press Hammer de Hombro" },
  "Biceps": { "Mancuerna": "Curl de Bíceps con Mancuerna", "Polea Multipower": "Curl de Bíceps en Polea", "Banco Predicador": "Curl en Banco Predicador", "Maquina Predicador": "Curl en Máquina Predicador" },
  "Triceps": { "Mancuerna": "Extensión de Tríceps con Mancuerna", "Polea Multipower": "Jalón de Tríceps en Polea", "Maq.Triceps Frontal": "Tríceps Frontal en Máquina", "Maq.triceps Sobre la Cabeza": "Tríceps Sobre la Cabeza en Máquina" },
  "Antebrazo": { "Barra": "Curl de Muñeca con Barra", "Mancuerna": "Curl de Muñeca con Mancuerna" },
  "Abdomen": { "Ab Wheel": "Rueda Abdominal", "Polea Multipower": "Crunch en Polea", "Maquina Abdominales": "Crunch en Máquina", "Banco Declinado": "Crunch en Banco Declinado", "Balon Suizo": "Crunch en Balón Suizo", "Peso corporal": "Crunch Abdominal" },
  "Espalda": { "Hammer": "Remo en Hammer", "Estacion de Dominadas": "Dominadas", "Maq Dominadas Asistidas": "Dominadas Asistidas", "Barra": "Remo con Barra", "Banda Elastica": "Jalón con Banda Elástica", "Peso corporal": "Dominadas en Peso Corporal" },
  "Gluteo": { "Hip Thrust": "Hip Thrust", "Maq.Patada de gluteo de pie": "Patada de Glúteo de Pie", "Maq.Patada de gluteo arrodillado": "Patada de Glúteo Arrodillado", "Banco": "Puente de Glúteo en Banco", "Peso Corporal": "Puente de Glúteo" },
  "Cuadriceps": { "Sentadilla Pendulo": "Sentadilla Péndulo", "Prensa de 45": "Prensa 45°", "Extensor": "Extensión de Cuádriceps", "Smith": "Sentadilla en Smith", "Haka": "Sentadilla Haka", "Prensa Pendular": "Prensa Pendular", "Prensa Unilateral": "Prensa Unilateral", "Prensa Horizontal": "Prensa Horizontal" },
  "Abductor": { "Maquina": "Abducción en Máquina" },
  "Aductor": { "Maquina": "Aducción en Máquina" },
  "Femoral": { "Estacion Femoral de Pie": "Curl Femoral de Pie", "Estacion Femoral de Sentado": "Curl Femoral Sentado", "Estacion Femoral de Tumbado": "Curl Femoral Tumbado", "Curl Nordico": "Curl Nórdico" },
  "Gemelos": { "Elevacion Gemelos de Pie": "Elevación de Talones de Pie", "Elevacion Gemelos de Sentado": "Elevación de Talones Sentado" }
};

function App() {
  const [editingRoutineUserId, setEditingRoutineUserId] = useState(null);
  const [isTemplateMode, setIsTemplateMode] = useState(false);
const [editingTemplateName, setEditingTemplateName] = useState("");
  const [tempExercises, setTempExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
    const [isAccessLoading, setIsAccessLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isGymAdmin, setIsGymAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
    const [currentUserUid, setCurrentUserUid] = useState("");
    const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserGymId, setCurrentUserGymId] = useState("");
const [gymData, setGymData] = useState(null);
const [gymUsersCount, setGymUsersCount] = useState(0);
const [gymUsers, setGymUsers] = useState([]);
const [searchTerm, setSearchTerm] = useState("");
const [editingPhoneUserId, setEditingPhoneUserId] = useState(null);
const [editPhoneValue, setEditPhoneValue] = useState("");
const [gymRoutineTemplates, setGymRoutineTemplates] = useState([]);
const [showExpressModal, setShowExpressModal] = useState(false);
const [editingTemplateId, setEditingTemplateId] = useState(null);
const [showSelectTemplateModal, setShowSelectTemplateModal] = useState(false);
const [selectTemplateTargetUserId, setSelectTemplateTargetUserId] = useState(null);
const [loadingTemplates, setLoadingTemplates] = useState(false);
const [notificacionesIngreso, setNotificacionesIngreso] = useState([]);
const [updateBanner, setUpdateBanner] = useState(null);
const [showUpdateBanner, setShowUpdateBanner] = useState(true);
    const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [muscleCatalog, setMuscleCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [gymStories, setGymStories] = useState([]);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [storyFile, setStoryFile] = useState(null);
  const [storyMessage, setStoryMessage] = useState("");
  const [storyPreviewUrl, setStoryPreviewUrl] = useState(null);
  const [storyUploading, setStoryUploading] = useState(false);
  const [loadingStories, setLoadingStories] = useState(false);
  const [gymNotices, setGymNotices] = useState([]);
  const [loadingNotices, setLoadingNotices] = useState(false);
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [noticeText, setNoticeText] = useState("");
  const [noticeSaving, setNoticeSaving] = useState(false);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifSending, setNotifSending] = useState(false);
  const [notifMessage, setNotifMessage] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [membershipSearchTerm, setMembershipSearchTerm] = useState("");
  const [machineReportStartDate, setMachineReportStartDate] = useState("");
  const [machineReportEndDate, setMachineReportEndDate] = useState("");
  const [machineReportLoading, setMachineReportLoading] = useState(false);
  const [showReportSection, setShowReportSection] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [activeTab, setActiveTab] = useState("usuarios");
  const [renewTargetUser, setRenewTargetUser] = useState(null);
  const [renewStartDate, setRenewStartDate] = useState("");
  const [renewEndDate, setRenewEndDate] = useState("");
  const [renewPlan, setRenewPlan] = useState("monthly");
  const [renewLoading, setRenewLoading] = useState(false);
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUserIdNumber, setNewUserIdNumber] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPlan, setNewUserPlan] = useState("monthly");
  const [newUserStartDate, setNewUserStartDate] = useState("");
  const [newUserEndDate, setNewUserEndDate] = useState("");
  const [newUserLoading, setNewUserLoading] = useState(false);
  const [newUserMessage, setNewUserMessage] = useState("");
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [gymPolls, setGymPolls] = useState([]);
  const [loadingPolls, setLoadingPolls] = useState(false);

      useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setIsAccessLoading(true);
        setErrorMessage("");
                setIsSuperAdmin(false);
                setIsGymAdmin(false);
        setLoading(true);

                if (!user) {
          setIsAuthenticated(false);
          setIsSuperAdmin(false);
          setCurrentUserEmail("");
          setCurrentUserUid("");
          setCurrentUserRole("");
          setLoading(false);
          return;
        }

                        const validatedUid = user.uid;

        setIsAuthenticated(true);
        setCurrentUserEmail(user.email || "");
        setCurrentUserUid(validatedUid);

        if (auth.currentUser?.uid !== validatedUid) {
          console.warn("⚠️ VALIDACIÓN ANTIGUA IGNORADA:", validatedUid);
          return;
        }

        // Leer rol desde Custom Claims del token
        const idTokenResult = await user.getIdTokenResult(true);
        const claims = idTokenResult.claims;
        const role = (claims.role) || "";
        const gymId = (claims.gymId) || "";

        // Si no hay claims todavía, intentar leer desde Firestore como fallback
        let finalRole = role;
        let finalGymId = gymId;

        if (!role) {
          console.warn("⚠️ Sin claims en token, leyendo Firestore como fallback");
          try {
            const userDocRef = doc(db, "users", validatedUid);
            const userDocSnapshot = await getDoc(userDocRef);
            if (userDocSnapshot.exists()) {
              const userData = userDocSnapshot.data();
              finalRole = userData.role || "";
              finalGymId = userData.gymId || "";
            }
          } catch (firestoreError) {
            console.warn("⚠️ Firestore fallback falló:", firestoreError);
          }
        }

        setCurrentUserGymId(finalGymId);
        setCurrentUserRole(finalRole);

        if (auth.currentUser?.uid !== validatedUid) {
          console.warn("⚠️ ROL IGNORADO POR CAMBIO DE USUARIO:", validatedUid);
          return;
        }

        console.log("🔐 Usuario autenticado:", user.email || validatedUid);
        console.log("🛂 Rol detectado desde claims:", finalRole);

        if (finalRole === "super_admin") {
          console.log("✅ ACCESO SUPER ADMIN OK");
          setIsSuperAdmin(true);
          setIsGymAdmin(false);
        } else if (finalRole === "gym_admin") {
          console.log("🏋️ ACCESO GYM ADMIN OK");
          setIsSuperAdmin(false);

          // Cargar datos del gym directamente aquí, con el token ya fresco
          try {
            const gymRef = doc(db, "gyms", finalGymId);
            const gymSnap = await getDoc(gymRef);

            if (!gymSnap.exists()) {
              setErrorMessage("No se encontró el gimnasio del administrador.");
              setLoading(false);
              return;
            }

            const gymInfo = { id: gymSnap.id, ...gymSnap.data() };

            const usersQuery = query(
              collection(db, "users"),
              where("gymId", "==", finalGymId)
            );
            const usersSnapshot = await getDocs(usersQuery);
            const count = usersSnapshot.size;

            const profilesQuery = query(
              collection(db, "user_profiles"),
              where("gymId", "==", finalGymId)
            );
            const profilesSnapshot = await getDocs(profilesQuery);
            const usersList = profilesSnapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));

            setGymData(gymInfo);
            setGymUsers(usersList);
            setGymUsersCount(count);
            console.log("✅ DATOS DEL GYM CARGADOS OK");
          } catch (gymError) {
            console.error("❌ ERROR CARGANDO DATOS DEL GYM:", gymError);
            setErrorMessage("No se pudo cargar la información del gimnasio.");
          }

          setIsGymAdmin(true);
        } else {
          console.log("⛔ ACCESO DENEGADO POR ROL:", finalRole);
          setIsSuperAdmin(false);
          setIsGymAdmin(false);
          setLoading(false);
        }
      } catch (error) {
        console.error("❌ ERROR VALIDANDO ACCESO:", error);
        setErrorMessage("No se pudo validar el acceso al panel.");
        setIsSuperAdmin(false);
        setLoading(false);
      } finally {
        setIsAccessLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
  if (!isAuthenticated || !isGymAdmin || !currentUserGymId) {
    return;
  }

  const loadGymData = async () => {
    try {
      setLoading(true);

      // Obtener gym
      const gymRef = doc(db, "gyms", currentUserGymId);
      const gymSnap = await getDoc(gymRef);

      if (!gymSnap.exists()) {
        setErrorMessage("No se encontró el gimnasio del administrador.");
        setLoading(false);
        return;
      }

      const gymInfo = {
        id: gymSnap.id,
        ...gymSnap.data(),
      };

      // 🔥 FASE 6.4: SEGURIDAD - Contar solo los usuarios permitidos desde el servidor
      const usersQuery = query(
        collection(db, "users"),
        where("gymId", "==", currentUserGymId)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      const count = usersSnapshot.size;

      // 🔥 FASE 6.4: SEGURIDAD - Cargar solo perfiles del gym actual desde el servidor
      const profilesQuery = query(
        collection(db, "user_profiles"),
        where("gymId", "==", currentUserGymId)
      );
      const profilesSnapshot = await getDocs(profilesQuery);

      const usersList = [];

      profilesSnapshot.forEach((doc) => {
        usersList.push({
          id: doc.id,
          ...doc.data(),
        });
      });


      setGymUsers(usersList);       // Guardamos usuarios
setGymData(gymInfo);          // Guardamos info del gym
setGymUsersCount(count);

    } catch (error) {
      console.error("❌ ERROR CARGANDO DATOS DEL GYM:", error);
      setErrorMessage("No se pudo cargar la información del gimnasio.");
    } finally {
      setLoading(false);
    }
  };
  

  loadGymData();
}, [isAuthenticated, isGymAdmin, currentUserGymId]);
useEffect(() => {
  if (!isAuthenticated || !isGymAdmin || !currentUserGymId) {
    return;
  }

  const loadGymRoutineTemplates = async () => {
    try {
      setLoadingTemplates(true);

      const templatesQuery = query(
        collection(db, "gym_routine_templates"),
        where("gymId", "==", currentUserGymId),
        orderBy("createdAt", "desc")
      );

      const templatesSnapshot = await getDocs(templatesQuery);

      const templatesList = templatesSnapshot.docs.map((templateDoc) => ({
        id: templateDoc.id,
        ...templateDoc.data(),
      }));

      setGymRoutineTemplates(templatesList);
    } catch (error) {
      console.error("❌ ERROR CARGANDO RUTINAS EXPRESS:", error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  loadGymRoutineTemplates();
}, [isAuthenticated, isGymAdmin, currentUserGymId]);

useEffect(() => {
  if (!isAuthenticated || !isGymAdmin || !currentUserGymId) return;

  let inicializado = false;

  const q = query(
    collection(db, "gym_attendance"),
    where("gymId", "==", currentUserGymId),
    orderBy("timestamp", "desc")
  );

  const unsub = onSnapshot(q, (snapshot) => {
    if (!inicializado) {
      inicializado = true;
      return;
    }
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        const id = change.doc.id;
        const nombre = data.userName || "Usuario";
        setNotificacionesIngreso((prev) => [...prev, { id, nombre }]);
        setTimeout(() => {
          setNotificacionesIngreso((prev) => prev.filter((n) => n.id !== id));
        }, 6000);
      }
    });
  });

  return () => unsub();
}, [isAuthenticated, isGymAdmin, currentUserGymId]);

useEffect(() => {
  if (!isAuthenticated || !isGymAdmin || !currentUserGymId) return;

  const loadMuscleCatalogForGymAdmin = async () => {
    try {
      const snapshot = await getDocs(collection(db, "muscle_catalog"));
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setMuscleCatalog(list);
    } catch (error) {
      console.error("❌ ERROR CARGANDO CATÁLOGO (GYM ADMIN):", error);
    }
  };

  loadMuscleCatalogForGymAdmin();
}, [isAuthenticated, isGymAdmin, currentUserGymId]);

useEffect(() => {
  if (!isAuthenticated || !isGymAdmin || !currentUserGymId) return;
  const loadGymStories = async () => {
    try {
      setLoadingStories(true);
      const snap = await getDocs(
        query(collection(db, "gym_stories"), where("gymId", "==", currentUserGymId))
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aD = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const bD = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return bD - aD;
        });
      setGymStories(list);
      const storiesWithReactions = [];
      for (const story of list) {
        try {
          const likesSnap = await getDocs(
            collection(db, "gym_stories", story.id, "likes")
          );
          const likes = {};
          likesSnap.forEach((likeDoc) => {
            likes[likeDoc.id] = likeDoc.data().emoji;
          });
          storiesWithReactions.push({ ...story, likes });
        } catch (likeErr) {
          console.error("Error cargando reacciones de historia:", story.id, likeErr);
          storiesWithReactions.push({ ...story, likes: {} });
        }
      }
      setGymStories(storiesWithReactions);
      loadGymNotices();
    } catch (err) {
      console.error("Error cargando historias:", err);
    } finally {
      setLoadingStories(false);
    }
  };
  loadGymStories();
}, [isAuthenticated, isGymAdmin, currentUserGymId]);

useEffect(() => {
  if (!isAuthenticated || !isGymAdmin) return;
  const loadUpdateBanner = async () => {
    try {
      const bannerSnap = await getDoc(doc(db, "app_config", "update_banner"));
      if (!bannerSnap.exists()) return;
      const bannerData = bannerSnap.data();
      if (!bannerData.message || !bannerData.startDate) return;
      const startDate = new Date(bannerData.startDate);
      const fiveDaysLater = new Date(startDate);
      fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
      const now = new Date();
      if (now >= startDate && now <= fiveDaysLater) {
        setUpdateBanner({ message: bannerData.message });
      }
    } catch (error) {
      console.error("❌ ERROR CARGANDO BANNER DE ACTUALIZACIÓN:", error);
    }
  };
  loadUpdateBanner();
}, [isAuthenticated, isGymAdmin]);

useEffect(() => {
  if (!isAuthenticated || !isGymAdmin || !currentUserGymId) return;
  const loadPolls = async () => {
    try {
      setLoadingPolls(true);
      const snap = await getDocs(
        query(collection(db, "gym_polls"), where("gymId", "==", currentUserGymId))
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGymPolls(list);
    } catch (err) {
      console.error("Error cargando encuestas:", err);
    } finally {
      setLoadingPolls(false);
    }
  };
  loadPolls();
}, [isAuthenticated, isGymAdmin, currentUserGymId]);

const resetTemplateForm = () => {
  setEditingTemplateId(null);
  setEditingTemplateName("");
  setTempExercises([]);
  setIsTemplateMode(false);
  setEditingRoutineUserId(null);
};

const handleStartNewTemplate = () => {
  setEditingTemplateId(null);
  setIsTemplateMode(true);
  setEditingRoutineUserId("TEMPLATE_MODE");
  setTempExercises([]);
  setEditingTemplateName("");
};

const handleEditTemplate = (template) => {
  setEditingTemplateId(template.id);
  setTempExercises(template.exercises || []);
  setEditingTemplateName(template.name || "");
  // Los ejercicios se muestran en la tabla del Express Modal; el usuario
  // puede usar "Añadir / editar ejercicios" para abrir el modal si necesita cambios.
};


const handleDeleteTemplate = async (templateId, templateNameToDelete) => {
  const confirmed = window.confirm(
    `¿Eliminar la rutina express "${templateNameToDelete}"?`
  );

  if (!confirmed) {
    return;
  }

  try {
    await deleteDoc(doc(db, "gym_routine_templates", templateId));

    setGymRoutineTemplates((prev) =>
      prev.filter((template) => template.id !== templateId)
    );

    if (editingTemplateId === templateId) {
      resetTemplateForm();
    }

    alert("🗑️ Rutina express eliminada correctamente.");
  } catch (error) {
    console.error("❌ ERROR ELIMINANDO RUTINA EXPRESS:", error);
    alert("No se pudo eliminar la rutina express.");
  }
};
const handleSaveTemplateFromModal = async () => {
  const name = editingTemplateName.trim();

  if (!name) {
    alert("Debes escribir el nombre de la rutina express.");
    return;
  }

  if (tempExercises.length === 0) {
    alert("Debes agregar al menos un ejercicio.");
    return;
  }

  try {
    if (editingTemplateId) {
      const payload = {
        name,
        exercises: tempExercises,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, "gym_routine_templates", editingTemplateId), payload);
      setGymRoutineTemplates((prev) =>
        prev.map((t) => (t.id === editingTemplateId ? { ...t, ...payload } : t))
      );
    } else {
      const newTemplate = {
        gymId: currentUserGymId,
        name,
        exercises: tempExercises,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "gym_routine_templates"), newTemplate);
      setGymRoutineTemplates((prev) => [{ id: ref.id, ...newTemplate }, ...prev]);
      setEditingTemplateId(ref.id);
    }
    // Cierra el modal de ejercicios y vuelve al Express Modal
    // sin limpiar tempExercises ni editingTemplateName, para que la tabla los muestre.
    setEditingRoutineUserId(null);
    setIsTemplateMode(false);
    setShowExpressModal(true);
    alert("✅ Rutina express guardada en Firestore.");
  } catch (error) {
    console.error("❌ ERROR GUARDANDO RUTINA EXPRESS:", error);
    alert("Error al guardar la rutina express.");
  }
};

const handleFinalSaveExpressTemplate = async () => {
  const name = editingTemplateName.trim();

  if (!name) {
    alert("Debes escribir el nombre de la rutina express.");
    return;
  }

  if (tempExercises.length === 0) {
    alert("Debes agregar al menos un ejercicio a la rutina express.");
    return;
  }

  try {
    if (editingTemplateId) {
      const payload = {
        name,
        exercises: tempExercises,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, "gym_routine_templates", editingTemplateId), payload);
      setGymRoutineTemplates((prev) =>
        prev.map((t) => (t.id === editingTemplateId ? { ...t, ...payload } : t))
      );
      alert("✅ Rutina express actualizada correctamente.");
    } else {
      const newTemplate = {
        gymId: currentUserGymId,
        name,
        exercises: tempExercises,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "gym_routine_templates"), newTemplate);
      setGymRoutineTemplates((prev) => [{ id: ref.id, ...newTemplate }, ...prev]);
      alert("✅ Rutina express guardada correctamente.");
    }
    resetTemplateForm();
    setShowExpressModal(false);
  } catch (error) {
    console.error(error);
    alert("No se pudo guardar la rutina express.");
  }
};

const handleSaveIndividualRoutine = async () => {
    try {
      const userRef = doc(db, "user_profiles", editingRoutineUserId);
      const normalizedExercises = tempExercises.map((ex) => ({
        name: ex.name || "",
        muscleGroup: ex.muscleGroup || "",
        station: ex.station || "",
        dayIndex: typeof ex.dayIndex === "number" ? ex.dayIndex : 0,
        sets: (ex.sets || []).map((s) => ({
          weight: typeof s.weight === "number" ? s.weight : 0,
          reps: typeof s.reps === "number" ? s.reps : 0,
        })),
      }));
      await updateDoc(userRef, {
        individualExercises: normalizedExercises,
        assignedRoutineId: "INDIVIDUAL"
      });

      const targetUser = gymUsers.find((u) => u.id === editingRoutineUserId);
      const targetGymId = targetUser?.gymId || currentUserGymId;

      if (editingRoutineUserId && targetGymId) {
        const routineRef = doc(
          db,
          "user_profiles",
          editingRoutineUserId,
          "gym_routines",
          targetGymId
        );
        await setDoc(routineRef, {
          gymId: targetGymId,
          individualExercises: normalizedExercises,
          updatedAt: Date.now(),
        }, { merge: true });
        console.log("✅ GYM ROUTINE SAVED IN SUBCOLLECTION:", editingRoutineUserId, targetGymId);
      }

      alert("✅ Rutina guardada correctamente.");
      setEditingRoutineUserId(null);
      window.location.reload();
    } catch (error) {
      console.error("Error al guardar rutina:", error);
      alert("Error al guardar: " + error.message);
    }
  };

  // 🔥 FASE 6.6: BORRAR RUTINA COMPLETA DEL USUARIO
  const handleClearDeletedExercises = async (userId) => {
    try {
      const userRef = doc(db, "user_profiles", userId);
      await updateDoc(userRef, { deletedExercisesByUser: [] });
      setGymUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, deletedExercisesByUser: [] } : u))
      );
    } catch (error) {
      console.error("Error limpiando registros de ejercicios borrados:", error);
      alert("No se pudo limpiar el registro. Intenta de nuevo.");
    }
  };

  const handleRemoveSpecificExercise = async (userId, exerciseIndex) => {
    if (window.confirm("¿Eliminar este ejercicio de la rutina del usuario?")) {
      try {
        const userRef = doc(db, "user_profiles", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentExercises = userSnap.data().individualExercises || [];
          const updatedExercises = currentExercises.filter((_, index) => index !== exerciseIndex);

          await updateDoc(userRef, {
            individualExercises: updatedExercises
          });
          window.location.reload();
        }
      } catch (error) {
        console.error("Error al eliminar ejercicio:", error);
      }
    }
  };

  const handleLoadTemplateToUser = async (userId, template) => {
    const confirmed = window.confirm(
      `¿Cargar la rutina express "${template.name}" al usuario? Esto reemplazará su rutina actual.`
    );
    if (!confirmed) return;

    try {
      const userRef = doc(db, "user_profiles", userId);
      await updateDoc(userRef, {
        individualExercises: template.exercises,
        assignedRoutineId: template.id,
      });

      const targetUser = gymUsers.find((u) => u.id === userId);
      const targetGymId = targetUser?.gymId || currentUserGymId;

      if (userId && targetGymId) {
        const routineRef = doc(
          db,
          "user_profiles",
          userId,
          "gym_routines",
          targetGymId
        );
        await setDoc(routineRef, {
          gymId: targetGymId,
          individualExercises: template.exercises,
          updatedAt: Date.now(),
        }, { merge: true });
        console.log("✅ GYM ROUTINE TEMPLATE SAVED IN SUBCOLLECTION:", userId, targetGymId);
      }

      setGymUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, individualExercises: template.exercises, assignedRoutineId: template.id }
            : u
        )
      );
      setShowSelectTemplateModal(false);
      setSelectTemplateTargetUserId(null);
      alert("✅ Rutina Express cargada correctamente.");
    } catch (error) {
      console.error("Error al cargar rutina express:", error);
      alert("Error al cargar la rutina express.");
    }
  };

  const loadGymNotices = async () => {
    if (!currentUserGymId) return;
    try {
      setLoadingNotices(true);
      const snap = await getDocs(
        query(collection(db, "gym_notices"), where("gymId", "==", currentUserGymId))
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aD = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const bD = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return bD - aD;
        });
      setGymNotices(list);
    } catch (err) {
      console.error("Error cargando avisos:", err);
    } finally {
      setLoadingNotices(false);
    }
  };

  const handlePublishNotice = async () => {
    const text = noticeText.trim();
    if (!text) {
      alert("Debes escribir un aviso.");
      return;
    }
    try {
      setNoticeSaving(true);
      const newNotice = {
        gymId: currentUserGymId,
        text,
        createdAt: new Date(),
      };
      const docRef = await addDoc(collection(db, "gym_notices"), newNotice);
      setGymNotices((prev) => [{ id: docRef.id, ...newNotice }, ...prev]);
      setNoticeText("");
      setShowNoticeForm(false);
    } catch (err) {
      console.error("Error publicando aviso:", err);
      alert("No se pudo publicar el aviso.");
    } finally {
      setNoticeSaving(false);
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm("¿Eliminar este aviso?")) return;
    try {
      await deleteDoc(doc(db, "gym_notices", noticeId));
      setGymNotices((prev) => prev.filter((n) => n.id !== noticeId));
    } catch (err) {
      console.error("Error eliminando aviso:", err);
      alert("No se pudo eliminar el aviso.");
    }
  };

  const handleSendPushNotification = async () => {
    const title = notifTitle.trim();
    const body = notifBody.trim();

    if (!title) {
      setNotifMessage("❌ Debes escribir un título.");
      return;
    }
    if (!body) {
      setNotifMessage("❌ Debes escribir un mensaje.");
      return;
    }

    try {
      setNotifSending(true);
      setNotifMessage("");

      const functions = getFunctions();
      const sendGymNotification = httpsCallable(functions, "sendGymNotification");
      const result = await sendGymNotification({
        gymId: currentUserGymId,
        title,
        body,
      });

      const data = result.data;
      setNotifMessage(`✅ Notificación enviada a ${data.sent} usuario(s).`);
      setNotifTitle("");
      setNotifBody("");
    } catch (error) {
      console.error("Error enviando notificación:", error);
      setNotifMessage("❌ No se pudo enviar la notificación.");
    } finally {
      setNotifSending(false);
    }
  };

const handlePublishStory = async () => {
  if (!storyFile) {
    alert("Debes seleccionar una foto.");
    return;
  }

  const MAX_SIZE_MB = 10;
  if (storyFile.size > MAX_SIZE_MB * 1024 * 1024) {
    alert("La foto es demasiado grande. Usa una imagen menor a 10MB.");
    return;
  }

  try {
    setStoryUploading(true);
    let compressed;
    try {
      compressed = await compressImage(storyFile);
    } catch (compressErr) {
      console.error("Error comprimiendo imagen:", compressErr);
      alert("No se pudo procesar la foto. Intenta con otra imagen.");
      setStoryUploading(false);
      return;
    }

    const timestamp = Date.now();
    const fileRef = storageRef(storage, `gym_stories/${currentUserGymId}/${timestamp}`);

    try {
      await uploadBytes(fileRef, compressed, { contentType: "image/jpeg" });
    } catch (uploadErr) {
      console.error("Error subiendo imagen:", uploadErr);
      alert("No se pudo subir la foto. Verifica tu conexión e intenta de nuevo.");
      setStoryUploading(false);
      return;
    }

    const imageUrl = await getDownloadURL(fileRef);
    const createdAt = new Date();
    const newStory = {
      gymId: currentUserGymId,
      imageUrl,
      message: storyMessage.trim(),
      createdAt,
      likes: {},
    };
    const docRef = await addDoc(collection(db, "gym_stories"), newStory);
    setGymStories((prev) => [{ id: docRef.id, ...newStory }, ...prev]);
    setShowStoryModal(false);
    setStoryFile(null);
    setStoryMessage("");
    setStoryPreviewUrl(null);
  } catch (err) {
    console.error("Error publicando historia:", err);
    alert("No se pudo publicar la historia. Intenta de nuevo.");
  } finally {
    setStoryUploading(false);
  }
};

const handleDeleteStory = async (story) => {
  if (!window.confirm("¿Eliminar esta historia?")) return;
  try {
    await deleteDoc(doc(db, "gym_stories", story.id));
    setGymStories((prev) => prev.filter((s) => s.id !== story.id));
    const path = storagePathFromUrl(story.imageUrl);
    if (path) {
      try {
        await deleteObject(storageRef(storage, path));
      } catch (storageErr) {
        console.error("Error eliminando imagen de Storage:", storageErr);
      }
    }
  } catch (err) {
    console.error("Error eliminando historia:", err);
    alert("No se pudo eliminar la historia.");
  }
};

const PLAN_DURATIONS = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

const PLAN_LABELS = {
  monthly: "Mensual",
  bimonthly: "Bimensual",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

const handleRenewMembership = async () => {
  if (!renewTargetUser) return;
  try {
    setRenewLoading(true);
    const startDate = renewStartDate ? new Date(renewStartDate + "T00:00:00") : new Date();
    const months = PLAN_DURATIONS[renewPlan] || 1;
    const endDate = renewEndDate ? new Date(renewEndDate + "T00:00:00") : new Date(startDate);
    if (!renewEndDate) endDate.setMonth(endDate.getMonth() + months);
    const userRef = doc(db, "user_profiles", renewTargetUser.id);
    await updateDoc(userRef, {
      membershipStartDate: startDate,
      membershipPlan: renewPlan,
      membershipEndDate: endDate,
      membershipStatus: "active",
    });
    setGymUsers((prev) =>
      prev.map((u) =>
        u.id === renewTargetUser.id
          ? { ...u, membershipStartDate: startDate, membershipPlan: renewPlan, membershipEndDate: endDate, membershipStatus: "active" }
          : u
      )
    );
    setShowRenewModal(false);
    setRenewTargetUser(null);
    alert("✅ Membresía renovada correctamente.");
  } catch (error) {
    console.error("Error renovando membresía:", error);
    alert("No se pudo renovar la membresía.");
  } finally {
    setRenewLoading(false);
  }
};

const handleGenerateReport = () => {
  if (!reportStartDate || !reportEndDate) {
    alert("Debes seleccionar una fecha de inicio y una fecha de fin.");
    return;
  }

  const start = new Date(reportStartDate + "T00:00:00");
  const end = new Date(reportEndDate + "T23:59:59");

  const diffMonths =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (diffMonths > 3) {
    alert("El rango máximo permitido es de 3 meses.");
    return;
  }

  const today = new Date();

  const rows = gymUsers
    .filter((u) => {
      if (!u.membershipStartDate) return false;
      const paid = u.membershipStartDate?.toDate
        ? u.membershipStartDate.toDate()
        : new Date(u.membershipStartDate);
      return paid >= start && paid <= end;
    })
    .map((u) => {
      const endDate = u.membershipEndDate?.toDate
        ? u.membershipEndDate.toDate()
        : u.membershipEndDate ? new Date(u.membershipEndDate) : null;
      const startDate = u.membershipStartDate?.toDate
        ? u.membershipStartDate.toDate()
        : new Date(u.membershipStartDate);
      const diffDays = endDate
        ? Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
        : null;
      const estado =
        diffDays === null ? "Sin fecha"
        : diffDays < 0 ? "Vencida"
        : diffDays === 0 ? "Vence hoy"
        : `Faltan ${diffDays} días`;
      return {
        Nombre: u.name || u.nickname || u.idNumber || "Sin nombre",
        "Fecha de pago": startDate.toLocaleDateString("es-CO"),
        Plan: PLAN_LABELS[u.membershipPlan] || "Sin plan",
        "Vence el": endDate ? endDate.toLocaleDateString("es-CO") : "No registrado",
        Estado: estado,
      };
    });

  if (rows.length === 0) {
    alert("No hay usuarios con membresía registrada en ese rango de fechas.");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Membresías");
  XLSX.writeFile(wb, `reporte_membresias_${reportStartDate}_${reportEndDate}.xlsx`);
};


  const handleDownloadFullReport = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = gymUsers.map((u) => {
      const endDate = u.membershipEndDate?.toDate
        ? u.membershipEndDate.toDate()
        : u.membershipEndDate ? new Date(u.membershipEndDate) : null;
      const startDate = u.membershipStartDate?.toDate
        ? u.membershipStartDate.toDate()
        : u.membershipStartDate ? new Date(u.membershipStartDate) : null;
      const isExpired = endDate && endDate < today;
      const estadoMembresia =
        u.membershipStatus === "active" && !isExpired ? "Activa" : "Vencida";
      return {
        Cédula: u.idNumber || "",
        Nombre: u.name || "",
        "Nombre Formal": u.nickname || "",
        Plan: PLAN_LABELS[u.membershipPlan] || "Sin plan",
        "Fecha Inicio": startDate ? startDate.toLocaleDateString("es-CO") : "No registrado",
        "Fecha Fin": endDate ? endDate.toLocaleDateString("es-CO") : "No registrado",
        Estado: estadoMembresia,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Membresías");
    XLSX.writeFile(wb, `informe_membresias_${currentUserGymId}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

const handleDownloadMachineReport = async () => {
  if (!machineReportStartDate || !machineReportEndDate) {
    alert("Debes seleccionar una fecha de inicio y una fecha de fin.");
    return;
  }

  const start = new Date(machineReportStartDate + "T00:00:00");
  const end = new Date(machineReportEndDate + "T23:59:59");

  if (end < start) {
    alert("La fecha de fin no puede ser anterior a la fecha de inicio.");
    return;
  }

  const diffMonths =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  if (diffMonths > 3) {
    alert("El rango máximo permitido es de 3 meses. Por favor ajusta las fechas.");
    return;
  }

  try {
    setMachineReportLoading(true);

    const snap = await getDocs(
      query(
        collection(db, "user_training_history"),
        where("gymId", "==", currentUserGymId),
        where("timestamp", ">=", start.getTime()),
        where("timestamp", "<=", end.getTime())
      )
    );

    if (snap.empty) {
      alert("No hay entrenamientos registrados en ese rango de fechas.");
      setMachineReportLoading(false);
      return;
    }

    const usageMap = {};

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const exercises = data.exercises || [];
      exercises.forEach((ex) => {
        const muscleGroup = ex.muscleGroup || "Sin grupo";
        const station = ex.station || "Sin estación";
        const key = `${muscleGroup}|||${station}`;
        usageMap[key] = (usageMap[key] || 0) + 1;
      });
    });

    const fechaInicio = start.toLocaleDateString("es-CO");
    const fechaFin = end.toLocaleDateString("es-CO");
    const fechaGeneracion = new Date().toLocaleDateString("es-CO");

    const rows = Object.entries(usageMap)
      .map(([key, count]) => {
        const [muscleGroup, station] = key.split("|||");
        return {
          "Grupo Muscular": muscleGroup,
          "Estación / Máquina": station,
          "Veces Usada": count,
          "Período Desde": fechaInicio,
          "Período Hasta": fechaFin,
          "Fecha de Generación": fechaGeneracion,
        };
      })
      .sort((a, b) =>
        a["Grupo Muscular"].localeCompare(b["Grupo Muscular"]) ||
        b["Veces Usada"] - a["Veces Usada"]
      );

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Uso de Máquinas");
    XLSX.writeFile(
      wb,
      `informe_maquinas_${machineReportStartDate}_${machineReportEndDate}.xlsx`
    );

  } catch (error) {
    console.error("Error generando informe de máquinas:", error);
    alert("No se pudo generar el informe. Intenta de nuevo.");
  } finally {
    setMachineReportLoading(false);
  }
};

const handleUpdateUserPhone = async (userId) => {
  try {
    const phone = editPhoneValue.trim();
    await updateDoc(doc(db, "user_profiles", userId), { phone });
    setGymUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, phone } : u))
    );
    setEditingPhoneUserId(null);
    setEditPhoneValue("");
  } catch (error) {
    console.error("❌ ERROR ACTUALIZANDO TELÉFONO:", error);
    alert("No se pudo actualizar el teléfono.");
  }
};

const handleSendWhatsappInvite = (user) => {
  const phone = (user.phone || "").replace(/\D/g, "");
  if (!phone) {
    alert("Este usuario no tiene un teléfono registrado. Agrega el teléfono primero.");
    return;
  }
  const fullPhone = phone.startsWith("57") ? phone : `57${phone}`;
  const gymId = user.gymId || currentUserGymId || "";
  const downloadLink = `https://gymiq-saas.web.app/download?gym=${gymId}`;
  const message = `Hola! 👋 Te escribimos de ${gymData?.name || "tu gimnasio"} para invitarte a descargar la app GymIQ. Estamos publicándola en Google Play, así que por ahora se descarga desde este link seguro: ${downloadLink}\n\nEs posible que tu celular muestre una advertencia de "fuente desconocida": es normal en este proceso y no representa ningún riesgo para tus datos. Si tienes dudas, puedes confirmarlo directamente con nosotros en el gimnasio.\n\n¡Gracias!`;
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodedMessage}`;
  window.open(whatsappUrl, "_blank");
};

const handleCreateGymUser = async () => {
  const idNumber = newUserIdNumber.trim();
  const name = newUserName.trim();
  const phone = newUserPhone.trim();

  const missingFields = [];
  if (!idNumber) missingFields.push("Cédula");
  if (!name) missingFields.push("Nombre");
  if (!phone) missingFields.push("Teléfono");
  if (!newUserPlan) missingFields.push("Plan de membresía");
  if (!newUserStartDate) missingFields.push("Fecha de inicio");
  if (!newUserEndDate) missingFields.push("Fecha de fin");

  if (missingFields.length > 0) {
    setNewUserMessage(`❌ Faltan los siguientes campos: ${missingFields.join(", ")}.`);
    return;
  }

  try {
    setNewUserLoading(true);
    setNewUserMessage("");

    const startDate = new Date(newUserStartDate + "T00:00:00");
    const endDate = new Date(newUserEndDate + "T00:00:00");

    const newProfile = {
      idNumber,
      name,
      phone,
      nickname: "",
      gymId: currentUserGymId,
      gymName: gymData?.name || "",
      gymPrimaryColorHex: gymData?.primaryColor || "#D32F2F",
      gymLogoUrl: gymData?.logoUrl || "",
      bodyWeight: "",
      height: "",
      goal: "",
      individualExercises: [],
      assignedRoutineId: "",
      assignedRoutineName: "",
      membershipStartDate: startDate,
      membershipEndDate: endDate,
      membershipPlan: newUserPlan,
      membershipStatus: "active",
      updatedAt: Date.now(),
    };

    await setDoc(doc(db, "user_profiles", idNumber), newProfile);

    setGymUsers((prev) => [...prev, { id: idNumber, ...newProfile }]);

    setNewUserMessage("✅ Usuario registrado correctamente.");
    setNewUserIdNumber("");
    setNewUserName("");
    setNewUserPhone("");
    setNewUserPlan("monthly");
    setNewUserStartDate("");
    setNewUserEndDate("");

    setTimeout(() => {
      setShowNewUserForm(false);
      setNewUserMessage("");
    }, 1500);

  } catch (error) {
    console.error("Error registrando usuario:", error);
    setNewUserMessage("❌ No se pudo registrar el usuario.");
  } finally {
    setNewUserLoading(false);
  }
};

    const handleLogin = async () => {
    const trimmedEmail = loginEmail.trim();
    const trimmedPassword = loginPassword.trim();

    if (!trimmedEmail) {
      setErrorMessage("Debes escribir el correo del super administrador.");
      return;
    }

    if (!trimmedPassword) {
      setErrorMessage("Debes escribir la contraseña.");
      return;
    }

    try {
      setLoginLoading(true);
      setErrorMessage("");

      await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);

      console.log("✅ LOGIN OK:", trimmedEmail);

      setLoginPassword("");
    } catch (error) {
      console.error("❌ ERROR DE LOGIN:", error);
      setErrorMessage("No se pudo iniciar sesión. Verifica correo y contraseña.");
    } finally {
      setLoginLoading(false);
    }
  };
    const handleLogout = async () => {
  try {
    await signOut(auth);
    console.log("🚪 LOGOUT OK");
    setIsAuthenticated(false);
    setIsSuperAdmin(false);
    setIsGymAdmin(false);
    setCurrentUserEmail("");
    setCurrentUserUid("");
    setCurrentUserRole("");
    setCurrentUserGymId("");
    setGymData(null);
    setGymUsers([]);
    setGymUsersCount(0);
    setActiveTab("usuarios");
  } catch (error) {
    console.error("❌ ERROR AL CERRAR SESIÓN:", error);
    setErrorMessage("No se pudo cerrar la sesión.");
  }
};
const handleSavePoll = async () => {
  const question = pollQuestion.trim();
  const validOptions = pollOptions.map(o => o.trim()).filter(o => o.length > 0);
  if (!question) { alert("Debes escribir la pregunta."); return; }
  if (validOptions.length < 2) { alert("Debes agregar al menos 2 opciones."); return; }
  try {
    const docRef = await addDoc(collection(db, "gym_polls"), {
      gymId: currentUserGymId,
      question,
      options: validOptions,
      votes: {},
      userVotes: {},
      createdAt: new Date(),
    });
    alert("✅ Encuesta publicada correctamente.");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setGymPolls((prev) => [{ id: docRef.id, gymId: currentUserGymId, question, options: validOptions, votes: {}, createdAt: new Date() }, ...prev]);
    setShowPollModal(false);
  } catch (error) {
    console.error("❌ ERROR GUARDANDO ENCUESTA:", error);
    alert("Error al guardar la encuesta.");
  }
};

const handleDeletePoll = async (pollId) => {
  if (!window.confirm("¿Eliminar esta encuesta?")) return;
  try {
    await deleteDoc(doc(db, "gym_polls", pollId));
    setGymPolls((prev) => prev.filter((p) => p.id !== pollId));
  } catch (err) {
    console.error("Error eliminando encuesta:", err);
    alert("No se pudo eliminar la encuesta.");
  }
};

    if (isAccessLoading) {
    return (
      <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
        <h1>GymIQ Super Admin Panel</h1>
        <p>Validando acceso...</p>
      </div>
    );
  }

    if (!isAuthenticated) {
    return (
      <div
        style={{
          padding: "20px",
          fontFamily: "Arial, sans-serif",
          maxWidth: "480px",
          margin: "40px auto",
        }}
      >
        <h1 style={{ textAlign: "center", marginBottom: "10px" }}>
          Panel de Gimnasio
        </h1>

        <p style={{ textAlign: "center", marginBottom: "24px", color: "#444" }}>
          Inicia sesión con tu cuenta
        </p>

        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: "bold",
              }}
            >
              Correo electrónico
            </label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="Ingrese su email"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: "bold",
              }}
            >
              Contraseña
            </label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Escribe tu contraseña"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {errorMessage && (
            <p style={{ color: "red", marginBottom: "12px", fontWeight: "bold" }}>
              {errorMessage}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loginLoading}
            style={{
              width: "100%",
              padding: "12px 16px",
              backgroundColor: loginLoading ? "#90A4AE" : "#1976D2",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: loginLoading ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            {loginLoading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin && !isGymAdmin) {
  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        maxWidth: "520px",
        margin: "40px auto",
        textAlign: "center",
      }}
    >
      <h1>GymIQ Super Admin Panel</h1>

      <p style={{ marginBottom: "8px" }}>
        Usuario autenticado: <strong>{currentUserEmail || "Sin email"}</strong>
      </p>

      <p style={{ color: "red", fontWeight: "bold", marginBottom: "20px" }}>
        Acceso denegado. Esta cuenta no tiene permisos de super administrador.
      </p>

      <button
        onClick={handleLogout}
        style={{
          padding: "10px 16px",
          backgroundColor: "#424242",
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Cerrar sesión y volver al login
      </button>
    </div>
  );
}
if (isGymAdmin) {
  const filteredUsers = gymUsers.filter((user) => {
    const term = searchTerm.toLowerCase();

    return (
      (user.idNumber || "").toLowerCase().includes(term) ||
      (user.name || "").toLowerCase().includes(term) ||
      (user.nickname || "").toLowerCase().includes(term)
    );
  });

  const traducirPlan = (plan) => {
    const planes = {
      monthly: "Mensual",
      bimonthly: "Bimensual",
      quarterly: "Trimestral",
      semiannual: "Semestral",
      annual: "Anual",
    };
    return planes[plan] || plan || "Sin plan";
  };

  const handleExportarAsistencia = async () => {
    try {
      const attendanceSnap = await getDocs(
        query(
          collection(db, "gym_attendance"),
          where("gymId", "==", currentUserGymId)
        )
      );

      const asistenciasPorCedula = {};
      attendanceSnap.docs.forEach((d) => {
        const data = d.data();
        const ced = data.idNumber || "";
        if (!asistenciasPorCedula[ced]) asistenciasPorCedula[ced] = [];
        asistenciasPorCedula[ced].push(data);
      });

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const filas = gymUsers.map((user) => {
        const cedula = user.idNumber || "";
        const nombre = user.name || "";
        const plan = traducirPlan(user.membershipPlan);

        let fechaInicio = null;
        let fechaFin = null;
        if (user.membershipStartDate?.toDate) {
          fechaInicio = user.membershipStartDate.toDate();
        } else if (user.membershipStartDate) {
          fechaInicio = new Date(user.membershipStartDate);
        }
        if (user.membershipEndDate?.toDate) {
          fechaFin = user.membershipEndDate.toDate();
        } else if (user.membershipEndDate) {
          fechaFin = new Date(user.membershipEndDate);
        }

        const fechaInicioStr = fechaInicio ? fechaInicio.toLocaleDateString("es-CO") : "N/A";
        const fechaFinStr = fechaFin ? fechaFin.toLocaleDateString("es-CO") : "N/A";

        let diasRestantes = "N/A";
        if (fechaFin) {
          const diff = Math.round((fechaFin - hoy) / (1000 * 60 * 60 * 24));
          diasRestantes = diff >= 0 ? diff : 0;
        }

        let diasTranscurridos = 0;
        if (fechaInicio) {
          diasTranscurridos = Math.round((hoy - fechaInicio) / (1000 * 60 * 60 * 24));
          if (diasTranscurridos < 0) diasTranscurridos = 0;
        }

        const asistencias = asistenciasPorCedula[cedula] || [];
        const fechasUnicas = new Set(
          asistencias.map((a) => {
            const ts = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
            return ts.toLocaleDateString("es-CO");
          })
        );
        const diasAsistidos = fechasUnicas.size;

        let porcentaje = "0%";
        if (diasTranscurridos > 0) {
          const pct = Math.min((diasAsistidos / diasTranscurridos) * 100, 100);
          porcentaje = pct.toFixed(1) + "%";
        }

        return {
          Cédula: cedula,
          Nombre: nombre,
          Membresía: plan,
          "Fecha inicio": fechaInicioStr,
          "Fecha fin": fechaFinStr,
          "Días restantes": diasRestantes,
          "Días asistidos": diasAsistidos,
          "% Asistencia": porcentaje,
        };
      });

      const ws = XLSX.utils.json_to_sheet(filas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Asistencia");

      ws["!cols"] = [
        { wch: 14 },
        { wch: 24 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
      ];

      const fecha = hoy.toLocaleDateString("es-CO").replace(/\//g, "-");
      XLSX.writeFile(wb, `Asistencia_${gymData?.name || "gym"}_${fecha}.xlsx`);
    } catch (err) {
      console.error("Error exportando asistencia:", err);
      alert("No se pudo generar el informe. Intenta de nuevo.");
    }
  };

  const NotificacionesIngreso = () => (
    <div style={{
      position: "fixed", top: "24px", left: "24px",
      zIndex: 9999, display: "flex", flexDirection: "column", gap: "10px",
      alignItems: "flex-end",
    }}>
      {notificacionesIngreso.map((n) => (
        <div key={n.id} style={{
          background: "linear-gradient(135deg, #1B5E20, #2E7D32)",
          color: "#fff", borderRadius: "16px",
          padding: "16px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", gap: "12px",
          fontSize: "15px", fontWeight: "700", maxWidth: "320px",
          animation: "slideIn 0.3s ease",
        }}>
          <span style={{ fontSize: "28px" }}>🏋️</span>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", opacity: 0.8, marginBottom: "2px" }}>
              INGRESO REGISTRADO
            </div>
            <div style={{ fontSize: "16px" }}>{n.nombre}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const BannerActualizacion = () => {
    if (!updateBanner || !showUpdateBanner) return null;
    return (
      <div style={{
        position: "fixed", top: "24px", right: "24px",
        zIndex: 9999, maxWidth: "320px",
        background: "linear-gradient(135deg, #1a1a1a, #000000)", borderRadius: "16px",
        padding: "16px 20px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        display: "flex", alignItems: "flex-start", gap: "12px",
      }}>
        <img src={gymiqLogo} alt="GymIQ" style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "11px", fontWeight: "700", opacity: 0.6, marginBottom: "4px", color: "#fff" }}>
            ACTUALIZACIÓN GYMIQ
          </div>
          <div style={{ fontSize: "14px", color: "#fff" }}>{updateBanner.message}</div>
        </div>
        <button
          onClick={() => setShowUpdateBanner(false)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#fff", padding: 0, lineHeight: 1 }}
        >
          ✕
        </button>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <NotificacionesIngreso />
      <BannerActualizacion />
      <div style={{
  display: "flex",
  alignItems: "center",
  width: "100%",
  marginBottom: "16px",
  gap: "0"
}}>
  {gymData?.logoUrl && (
    <img
      src={gymData.logoUrl}
      alt="Logo del gimnasio"
      style={{
        width: "200px",
        height: "200px",
        objectFit: "contain",
        borderRadius: "12px",
        flexShrink: 0
      }}
    />
  )}
  <div style={{
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }}>
    <h1 style={{
      margin: 0,
      fontSize: "64px",
      fontWeight: "bold",
      textAlign: "center",
      lineHeight: 1.1
    }}>
      {gymData?.name
        ? gymData.name
            .toLowerCase()
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
        : "Panel del Gimnasio"}
    </h1>
  </div>
</div>

      <p>
        Usuario: <strong>{currentUserEmail}</strong>
      </p>

      <button
        onClick={handleLogout}
        style={{
          padding: "10px 16px",
          backgroundColor: "#424242",
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "bold",
          marginBottom: "20px",
        }}
      >
        Cerrar sesión
      </button>

      {loading && <p>Cargando información del gimnasio...</p>}

      {!loading && errorMessage && (
        <p style={{ color: "red" }}>{errorMessage}</p>
      )}

      {!loading && gymData && (
        <div
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            padding: "20px",
            backgroundColor: "#ffffff",
            margin: "0 20px",
            textAlign: "left",
            boxSizing: "border-box",
            width: "fit-content",
            minWidth: "600px",
            maxWidth: "calc(100vw - 60px)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>{gymData.name || "Sin nombre"}</h2>

          <p>
            <strong>Estado:</strong>{" "}
            <span
              style={{
                color: gymData.active ? "green" : "red",
                fontWeight: "bold",
              }}
            >
              {gymData.active ? "Activo" : "Inactivo"}
            </span>
          </p>

          <p>
            <strong>Usuarios:</strong> {gymUsersCount}
          </p>

<div style={{ display: "flex", gap: "0", marginBottom: "24px", borderBottom: "2px solid #e0e0e0" }}>
  {[
    { key: "usuarios", label: "👥 Usuarios" },
    { key: "historias", label: "📸 Historias" },
    { key: "membresias", label: "💳 Membresías" },
    { key: "rutinas", label: "🏋️ Rutinas Express" },
    { key: "informes", label: "📊 Informes" },
  ].map((tab) => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key)}
      style={{
        padding: "12px 20px",
        backgroundColor: activeTab === tab.key ? "#1976D2" : "#f5f5f5",
        color: activeTab === tab.key ? "#ffffff" : "#333",
        border: "none",
        borderBottom: activeTab === tab.key ? "2px solid #1976D2" : "2px solid transparent",
        cursor: "pointer",
        fontWeight: activeTab === tab.key ? "bold" : "normal",
        fontSize: "14px",
      }}
    >
      {tab.label}
    </button>
  ))}
</div>

{activeTab === "usuarios" && (
  <div>
          <h3>Usuarios del gimnasio</h3>

<div style={{ marginBottom: "20px" }}>
  <button
    onClick={() => {
      setShowNewUserForm(!showNewUserForm);
      setNewUserMessage("");
    }}
    style={{
      padding: "12px 16px",
      backgroundColor: "#2E7D32",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontWeight: "bold",
      marginBottom: "12px",
    }}
  >
    {showNewUserForm ? "Cerrar formulario" : "➕ Registrar nuevo usuario"}
  </button>

  {showNewUserForm && (
    <div style={{ padding: "16px", backgroundColor: "#E8F5E9", border: "1px solid #2E7D32", borderRadius: "10px" }}>
      <h4 style={{ margin: "0 0 16px 0", color: "#1B5E20" }}>Datos del nuevo usuario</h4>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "13px" }}>
          Cédula (obligatoria)
        </label>
        <input
          type="text"
          value={newUserIdNumber}
          onChange={(e) => setNewUserIdNumber(e.target.value)}
          placeholder="Ej: 80722011"
          style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "13px" }}>
          Nombre (opcional)
        </label>
        <input
          type="text"
          value={newUserName}
          onChange={(e) => setNewUserName(e.target.value)}
          placeholder="Ej: Juan Pérez"
          style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "13px" }}>
          Teléfono (WhatsApp)
        </label>
        <input
          type="tel"
          value={newUserPhone}
          onChange={(e) => setNewUserPhone(e.target.value)}
          placeholder="Ej: 3001234567"
          style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "13px" }}>
          Plan de membresía
        </label>
        <select
          value={newUserPlan}
          onChange={(e) => {
            const plan = e.target.value;
            setNewUserPlan(plan);
            if (newUserStartDate) {
              const startDate = new Date(newUserStartDate + "T00:00:00");
              const endDate = new Date(startDate);
              const months = {
                monthly: 1,
                bimonthly: 2,
                quarterly: 3,
                semiannual: 6,
                annual: 12,
              }[plan] || 1;
              endDate.setMonth(endDate.getMonth() + months);
              endDate.setDate(endDate.getDate() - 1);
              setNewUserEndDate(endDate.toISOString().split("T")[0]);
            }
          }}
          style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }}
        >
          <option value="monthly">Mensual</option>
          <option value="bimonthly">Bimensual</option>
          <option value="quarterly">Trimestral</option>
          <option value="semiannual">Semestral</option>
          <option value="annual">Anual</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "13px" }}>
            Fecha de inicio
          </label>
          <input
            type="date"
            value={newUserStartDate}
            onChange={(e) => {
              const start = e.target.value;
              setNewUserStartDate(start);
              if (start && newUserPlan) {
                const startDate = new Date(start + "T00:00:00");
                const endDate = new Date(startDate);
                const months = {
                  monthly: 1,
                  bimonthly: 2,
                  quarterly: 3,
                  semiannual: 6,
                  annual: 12,
                }[newUserPlan] || 1;
                endDate.setMonth(endDate.getMonth() + months);
                endDate.setDate(endDate.getDate() - 1);
                setNewUserEndDate(endDate.toISOString().split("T")[0]);
              }
            }}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "13px" }}>
            Fecha de fin (se calcula automáticamente)
          </label>
          <input
            type="date"
            value={newUserEndDate}
            onChange={(e) => setNewUserEndDate(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box", backgroundColor: "#f5f5f5" }}
          />
        </div>
      </div>

      {newUserMessage && (
        <p style={{ marginBottom: "12px", fontWeight: "bold", color: newUserMessage.startsWith("✅") ? "#2E7D32" : "#C62828" }}>
          {newUserMessage}
        </p>
      )}

      <button
        onClick={handleCreateGymUser}
        disabled={newUserLoading}
        style={{
          width: "100%",
          padding: "12px",
          backgroundColor: newUserLoading ? "#90A4AE" : "#2E7D32",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: newUserLoading ? "not-allowed" : "pointer",
          fontWeight: "bold",
        }}
      >
        {newUserLoading ? "Registrando..." : "Confirmar registro"}
      </button>
    </div>
  )}
</div>

          <input
            type="text"
            placeholder="Buscar por cédula, nombre o nombre formal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              boxSizing: "border-box",
            }}
          />

          {filteredUsers.length === 0 && (
            <p>No hay usuarios que coincidan con la búsqueda.</p>
          )}

          {filteredUsers.length > 0 && (
            <div style={{ display: "grid", gap: "12px" }}>
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    padding: "14px",
                    backgroundColor: "#fafafa",
                  }}
                >
                  <p><strong>Cédula:</strong> {user.idNumber || "N/A"}</p>
                  <p>
                    <strong>Nombre:</strong> {user.name || "N/A"}
                    {user.rankWarning && (
                      <span
                        title="Este usuario está perdiendo su rango"
                        style={{ color: "red", marginLeft: "6px", cursor: "default" }}
                      >
                        🔥
                      </span>
                    )}
                  </p>
                  <p><strong>Nombre formal:</strong> {user.nickname || "N/A"}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <strong>Teléfono:</strong>
                    {editingPhoneUserId === user.id ? (
                      <>
                        <input
                          type="tel"
                          value={editPhoneValue}
                          onChange={(e) => setEditPhoneValue(e.target.value)}
                          placeholder="Ej: 3001234567"
                          style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "13px", width: "140px" }}
                        />
                        <button
                          onClick={() => handleUpdateUserPhone(user.id)}
                          style={{ padding: "4px 10px", backgroundColor: "#2E7D32", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
                        >
                          💾 Guardar
                        </button>
                        <button
                          onClick={() => { setEditingPhoneUserId(null); setEditPhoneValue(""); }}
                          style={{ padding: "4px 10px", backgroundColor: "#e0e0e0", color: "#333", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <span>{user.phone || "N/A"}</span>
                        <button
                          onClick={() => { setEditingPhoneUserId(user.id); setEditPhoneValue(user.phone || ""); }}
                          style={{ padding: "3px 8px", backgroundColor: "#1976D2", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}
                        >
                          ✏️ Editar
                        </button>
                      </>
                    )}
                  </div>
                  {user.phone && (
                    <button
                      onClick={() => handleSendWhatsappInvite(user)}
                      style={{
                        padding: "8px 14px",
                        backgroundColor: "#25D366",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "13px",
                        marginTop: "6px",
                        marginBottom: "10px",
                      }}
                    >
                      📲 Enviar app por WhatsApp
                    </button>
                  )}
                  <p><strong>Peso corporal:</strong> {user.bodyWeight || "N/A"}</p>
                  <p><strong>Altura:</strong> {user.height || "N/A"}</p>
                  <p><strong>Objetivo:</strong> {user.goal || "N/A"}</p>

{/* 💳 MEMBRESÍA */}
{(() => {
  const endDate = user.membershipEndDate?.toDate
    ? user.membershipEndDate.toDate()
    : user.membershipEndDate
    ? new Date(user.membershipEndDate)
    : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isExpired = endDate && endDate < today;
  const status = user.membershipStatus === "active" && !isExpired ? "Activa" : "Vencida";
  const statusColor = status === "Activa" ? "green" : "red";

  return (
    <div style={{ marginTop: "10px", padding: "12px", backgroundColor: "#F3F4F6", borderRadius: "8px", border: "1px solid #ddd" }}>
      <p style={{ margin: "0 0 4px 0" }}><strong>💳 Membresía:</strong> <span style={{ color: statusColor, fontWeight: "bold" }}>{status}</span></p>
      <p style={{ margin: "0 0 4px 0" }}><strong>Plan:</strong> {PLAN_LABELS[user.membershipPlan] || "Sin plan"}</p>
      <p style={{ margin: "0 0 8px 0" }}><strong>Vence:</strong> {endDate ? endDate.toLocaleDateString("es-CO") : "No registrado"}</p>
      <button
        onClick={() => {
          setRenewTargetUser(user);
          setRenewPlan(user.membershipPlan || "monthly");
          setShowRenewModal(true);
        }}
        style={{
          padding: "8px 14px",
          backgroundColor: "#1976D2",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "13px",
        }}
      >
        🔄 Renovar membresía
      </button>
    </div>
  );
})()}

                  <div
                    style={{
                      marginTop: "15px",
                      padding: "15px",
                      backgroundColor: "#f4f8ff",
                      borderRadius: "8px",
                      border: "1px solid #1976D2",
                    }}
                  >
                    <h4 style={{ margin: "0 0 10px 0", color: "#1976D2" }}>
                      🏋️ Rutina individual
                    </h4>

                                        <div style={{ marginBottom: "10px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          overflowX: "auto",
                          paddingBottom: "6px",
                        }}
                      >
                        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                          const exercisesForDay = (user.individualExercises || [])
                            .map((ex, originalIndex) => ({
                              ...ex,
                              originalIndex,
                            }))
                            .filter((ex) => (ex.dayIndex ?? 0) === day);

                          return (
                            <div
                              key={day}
                              style={{
                                minWidth: "300px",
                                flex: "0 0 300px",
                                backgroundColor: "#ffffff",
                                border: "1px solid #bbdefb",
                                borderRadius: "8px",
                                padding: "10px",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: "bold",
                                  color: "#1976D2",
                                  marginBottom: "10px",
                                  textAlign: "center",
                                  borderBottom: "1px solid #e3f2fd",
                                  paddingBottom: "6px",
                                }}
                              >
                                Día {day + 1}
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1.5fr 0.5fr 1fr 1fr",
                                  gap: "8px",
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                  color: "#333",
                                  marginBottom: "8px",
                                  padding: "0 4px",
                                }}
                              >
                                <div>Ejercicio</div>
                                <div>Sets</div>
                                <div>Peso</div>
                                <div>Reps</div>
                              </div>

                              {exercisesForDay.length > 0 ? (
                                <div style={{ display: "grid", gap: "8px" }}>
                                  {exercisesForDay.map((ex) => (
                                    <div
                                      key={ex.originalIndex}
                                      style={{
                                        backgroundColor: "#e3f2fd",
                                        borderRadius: "6px",
                                        padding: "8px",
                                        border: "1px solid #90caf9",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: "1.5fr 0.5fr 1fr 1fr auto",
                                          gap: "8px",
                                          alignItems: "start",
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontWeight: "bold",
                                            color: "#222",
                                            wordBreak: "break-word",
                                          }}
                                        >
                                          {ex.name || "Ejercicio sin nombre"}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: "12px",
                                            color: "#444",
                                            fontWeight: "bold",
                                          }}
                                        >
                                          {ex.sets ? ex.sets.length : 0}
                                        </div>

                                        <div
                                          style={{
                                            fontSize: "12px",
                                            color: "#444",
                                            wordBreak: "break-word",
                                          }}
                                        >
                                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
  {ex.sets && ex.sets.length > 0 ? (
    ex.sets.map((set, i) => (
      <div key={i}>{set.weight ?? 0}</div>
    ))
  ) : (
    <div>-</div>
  )}
</div>
                                        </div>

                                        <div
                                          style={{
                                            fontSize: "12px",
                                            color: "#444",
                                            wordBreak: "break-word",
                                          }}
                                        >
                                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
  {ex.sets && ex.sets.length > 0 ? (
    ex.sets.map((set, i) => (
      <div key={i}>{set.reps ?? 0}</div>
    ))
  ) : (
    <div>-</div>
  )}
</div>
                                        </div>

                                        <button
                                          onClick={() =>
                                            handleRemoveSpecificExercise(
                                              user.id,
                                              ex.originalIndex
                                            )
                                          }
                                          style={{
                                            color: "red",
                                            border: "none",
                                            background: "none",
                                            cursor: "pointer",
                                            fontWeight: "bold",
                                            fontSize: "14px",
                                          }}
                                          title="Eliminar ejercicio"
                                        >
                                          ✖
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#777",
                                    fontStyle: "italic",
                                    padding: "8px 4px",
                                  }}
                                >
                                  Sin ejercicios
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 🗑️ EJERCICIOS BORRADOS POR EL USUARIO */}
                    {(user.deletedExercisesByUser || []).length > 0 && (
                      <div style={{
                        marginTop: "12px",
                        padding: "12px",
                        backgroundColor: "#FFF3E0",
                        border: "1px solid #FF9800",
                        borderRadius: "8px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <p style={{ margin: 0, fontWeight: "bold", color: "#E65100", fontSize: "13px" }}>
                            🗑️ Ejercicios borrados por el usuario desde la app:
                          </p>
                          <button
                            onClick={() => handleClearDeletedExercises(user.id)}
                            style={{
                              padding: "5px 10px",
                              backgroundColor: "#FF9800",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontWeight: "bold",
                              fontSize: "11px",
                              flexShrink: 0,
                              marginLeft: "8px",
                            }}
                          >
                            🧹 Limpiar registros
                          </button>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {(user.deletedExercisesByUser || []).map((exName) => (
                            <span
                              key={exName}
                              style={{
                                backgroundColor: "#FFE0B2",
                                border: "1px solid #FF9800",
                                borderRadius: "12px",
                                padding: "4px 10px",
                                fontSize: "12px",
                                color: "#BF360C",
                                fontWeight: "bold",
                              }}
                            >
                              {exName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setEditingRoutineUserId(user.id);
                        setTempExercises(user.individualExercises || []);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      ➕ AÑADIR / EDITAR EJERCICIOS
                    </button>

                    <button
                      onClick={() => {
                        setSelectTemplateTargetUserId(user.id);
                        setShowSelectTemplateModal(true);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "#6A1B9A",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        marginTop: "8px",
                      }}
                    >
                      ⚡ Cargar Rutina Express
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
  </div>
)}

{activeTab === "historias" && (
  <div>
<div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "#FFF8E1", border: "1px solid #FBC02D", borderRadius: "10px" }}>
  <h3 style={{ margin: "0 0 12px 0", color: "#F57F17" }}>📢 Avisos del Gimnasio</h3>

  <button
    onClick={() => setShowNoticeForm(!showNoticeForm)}
    style={{
      padding: "10px 16px",
      backgroundColor: "#F57F17",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontWeight: "bold",
      marginBottom: "12px",
    }}
  >
    {showNoticeForm ? "Cancelar" : "➕ Publicar aviso"}
  </button>

  {showNoticeForm && (
    <div style={{ marginBottom: "12px" }}>
      <textarea
        value={noticeText}
        onChange={(e) => { if (e.target.value.length <= 300) setNoticeText(e.target.value); }}
        placeholder="Escribe un aviso para tus usuarios... (máx. 300 caracteres)"
        maxLength={300}
        rows={3}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "6px",
          border: "1px solid #FBC02D",
          boxSizing: "border-box",
          fontSize: "14px",
          resize: "vertical",
        }}
      />
      <p style={{ margin: "4px 0 8px 0", fontSize: "11px", color: "#888", textAlign: "right" }}>
        {noticeText.length}/300
      </p>
      <button
        onClick={handlePublishNotice}
        disabled={noticeSaving || !noticeText.trim()}
        style={{
          padding: "10px 16px",
          backgroundColor: noticeSaving || !noticeText.trim() ? "#90A4AE" : "#F57F17",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: noticeSaving || !noticeText.trim() ? "not-allowed" : "pointer",
          fontWeight: "bold",
        }}
      >
        {noticeSaving ? "Publicando..." : "Publicar"}
      </button>
    </div>
  )}

  {loadingNotices && <p style={{ color: "#777", fontSize: "13px" }}>Cargando avisos...</p>}

  {!loadingNotices && gymNotices.length === 0 && (
    <p style={{ color: "#888", fontSize: "13px", margin: 0 }}>No hay avisos publicados.</p>
  )}

  {!loadingNotices && gymNotices.length > 0 && (
    <div style={{ display: "grid", gap: "8px" }}>
      {gymNotices.map((notice) => (
        <div
          key={notice.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
            padding: "10px 12px",
            backgroundColor: "#fff",
            border: "1px solid #FBC02D",
            borderRadius: "8px",
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#333" }}>{notice.text}</p>
            <p style={{ margin: 0, fontSize: "11px", color: "#888" }}>
              {timeAgo(notice.createdAt)}
            </p>
          </div>
          <button
            onClick={() => handleDeleteNotice(notice.id)}
            style={{
              backgroundColor: "#D32F2F",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "12px",
              flexShrink: 0,
            }}
          >
            🗑️
          </button>
        </div>
      ))}
    </div>
  )}
</div>

{false && (
  <>
    {/* 🔔 NOTIFICACIONES PUSH */}
    <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "#E3F2FD", border: "1px solid #1976D2", borderRadius: "10px" }}>
      <h3 style={{ margin: "0 0 12px 0", color: "#0D47A1" }}>🔔 Enviar Notificación Push</h3>
  <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#555" }}>
    Envía una notificación directamente al celular de todos los usuarios del gimnasio.
  </p>

  <div style={{ marginBottom: "10px" }}>
    <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "13px" }}>
      Título
    </label>
    <input
      type="text"
      value={notifTitle}
      onChange={(e) => { if (e.target.value.length <= 50) setNotifTitle(e.target.value); }}
      placeholder="Ej: ¡Novedad en el gimnasio!"
      maxLength={50}
      style={{
        width: "100%",
        padding: "10px",
        borderRadius: "6px",
        border: "1px solid #ccc",
        boxSizing: "border-box",
        fontSize: "14px",
      }}
    />
    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#888", textAlign: "right" }}>
      {notifTitle.length}/50
    </p>
  </div>

  <div style={{ marginBottom: "12px" }}>
    <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "13px" }}>
      Mensaje
    </label>
    <textarea
      value={notifBody}
      onChange={(e) => { if (e.target.value.length <= 200) setNotifBody(e.target.value); }}
      placeholder="Escribe el mensaje para tus usuarios..."
      maxLength={200}
      rows={3}
      style={{
        width: "100%",
        padding: "10px",
        borderRadius: "6px",
        border: "1px solid #ccc",
        boxSizing: "border-box",
        fontSize: "14px",
        resize: "vertical",
      }}
    />
    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#888", textAlign: "right" }}>
      {notifBody.length}/200
    </p>
  </div>

  {notifMessage && (
    <p style={{
      margin: "0 0 10px 0",
      fontWeight: "bold",
      color: notifMessage.startsWith("✅") ? "#2E7D32" : "#C62828",
      fontSize: "13px",
    }}>
      {notifMessage}
    </p>
  )}

  <button
    onClick={handleSendPushNotification}
    disabled={notifSending}
    style={{
      padding: "10px 16px",
      backgroundColor: notifSending ? "#90A4AE" : "#1976D2",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: notifSending ? "not-allowed" : "pointer",
      fontWeight: "bold",
    }}
  >
    {notifSending ? "Enviando..." : "📲 Enviar notificación"}
      </button>
    </div>
  </>
)}

<h3 style={{ marginBottom: "10px" }}>📸 Historias del Gimnasio</h3>

<button
  onClick={() => setShowStoryModal(true)}
  style={{
    padding: "12px 16px",
    backgroundColor: "#E64A19",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    marginBottom: "15px",
  }}
>
  📸 Publicar Historia
</button>

{loadingStories && (
  <p style={{ color: "#777", fontSize: "13px" }}>Cargando historias...</p>
)}

{!loadingStories && gymStories.length === 0 && (
  <p style={{ color: "#777", fontSize: "13px", marginBottom: "20px" }}>
    No hay historias activas. Las historias duran 24 horas.
  </p>
)}

{!loadingStories && gymStories.length > 0 && (
  <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
    {gymStories.map((story) => (
      <div
        key={story.id}
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          padding: "10px 12px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          backgroundColor: "#fafafa",
        }}
      >
        <img
          src={story.imageUrl}
          alt="Historia"
          style={{
            width: "60px",
            height: "60px",
            objectFit: "cover",
            borderRadius: "6px",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {story.message && (
            <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#333" }}>
              {story.message}
            </p>
          )}
          <p style={{ margin: 0, fontSize: "11px", color: "#888" }}>
            {timeAgo(story.createdAt)}
          </p>
          {story.likes && Object.keys(story.likes).length > 0 && (
            <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
              {Object.entries(
                Object.values(story.likes).reduce((acc, emoji) => {
                  acc[emoji] = (acc[emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => (
                <span
                  key={emoji}
                  style={{
                    fontSize: "12px",
                    backgroundColor: "#f0f0f0",
                    borderRadius: "12px",
                    padding: "2px 8px",
                  }}
                >
                  {emoji} {count}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => handleDeleteStory(story)}
          style={{
            backgroundColor: "#D32F2F",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "6px 10px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "12px",
            flexShrink: 0,
          }}
        >
          🗑️
        </button>
      </div>
    ))}
  </div>
)}

<div style={{ marginTop: "24px" }}>
  <h3 style={{ marginBottom: "10px" }}>📊 Encuestas</h3>
  <button
    onClick={() => setShowPollModal(true)}
    style={{ padding:"12px 16px", backgroundColor:"#1565C0", color:"#fff", border:"none", borderRadius:"6px", cursor:"pointer", fontWeight:"bold", marginBottom:"15px" }}
  >
    ➕ Crear Encuesta
  </button>

  {loadingPolls && <p style={{ color:"#777", fontSize:"13px" }}>Cargando encuestas...</p>}

  {!loadingPolls && gymPolls.length === 0 && (
    <p style={{ color:"#777", fontSize:"13px" }}>No hay encuestas publicadas.</p>
  )}

  {!loadingPolls && gymPolls.length > 0 && (
    <div style={{ display:"grid", gap:"12px" }}>
      {gymPolls.map((poll) => {
        const totalVotes = Object.values(poll.votes || {}).reduce((a, b) => a + b, 0);
        return (
          <div key={poll.id} style={{ padding:"16px", border:"1px solid #1565C0", borderRadius:"10px", backgroundColor:"#f4f8ff" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"12px" }}>
              <p style={{ margin:0, fontWeight:"bold", fontSize:"15px", color:"#1565C0" }}>{poll.question}</p>
              <button
                onClick={() => handleDeletePoll(poll.id)}
                style={{ backgroundColor:"#D32F2F", color:"#fff", border:"none", borderRadius:"4px", padding:"6px 10px", cursor:"pointer", fontWeight:"bold", fontSize:"12px", flexShrink:0, marginLeft:"12px" }}
              >
                🗑️ Eliminar
              </button>
            </div>
            <p style={{ margin:"0 0 10px 0", fontSize:"12px", color:"#555" }}>Total de votos: {totalVotes}</p>
            <div style={{ display:"grid", gap:"8px" }}>
              {(poll.options || []).map((option) => {
                const count = (poll.votes || {})[option] || 0;
                const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                return (
                  <div key={option}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:"13px", marginBottom:"4px" }}>
                      <span>{option}</span>
                      <span style={{ fontWeight:"bold" }}>{count} voto{count !== 1 ? "s" : ""} ({percentage}%)</span>
                    </div>
                    <div style={{ backgroundColor:"#e0e0e0", borderRadius:"4px", height:"8px", overflow:"hidden" }}>
                      <div style={{ width:`${percentage}%`, backgroundColor:"#1565C0", height:"100%", borderRadius:"4px", transition:"width 0.3s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  )}
</div>
  </div>
)}

{activeTab === "membresias" && (
  <div>
{/* 🔔 PANEL DE ALERTAS DE MEMBRESÍA */}
{(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in5Days = new Date(today);
  in5Days.setDate(in5Days.getDate() + 5);

  const expiresToday = gymUsers.filter((u) => {
    if (!u.membershipEndDate) return false;
    const end = u.membershipEndDate?.toDate ? u.membershipEndDate.toDate() : new Date(u.membershipEndDate);
    end.setHours(0, 0, 0, 0);
    return end.getTime() === today.getTime();
  });

  const expiresSoon = gymUsers.filter((u) => {
    if (!u.membershipEndDate) return false;
    const end = u.membershipEndDate?.toDate ? u.membershipEndDate.toDate() : new Date(u.membershipEndDate);
    end.setHours(0, 0, 0, 0);
    return end > today && end <= in5Days;
  });

  if (expiresToday.length === 0 && expiresSoon.length === 0) return null;

  return (
    <div style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#FFF3E0", border: "1px solid #FF9800", borderRadius: "10px" }}>
      <h4 style={{ margin: "0 0 12px 0", color: "#E65100" }}>🔔 Alertas de membresía</h4>
      {expiresToday.length > 0 && (
        <div style={{ marginBottom: "10px" }}>
          <p style={{ fontWeight: "bold", color: "#B71C1C", margin: "0 0 6px 0" }}>Vencen hoy ({expiresToday.length}):</p>
          {expiresToday.map((u) => (
            <p key={u.id} style={{ margin: "2px 0", fontSize: "13px" }}>• {u.name || u.nickname || u.idNumber}</p>
          ))}
        </div>
      )}
      {expiresSoon.length > 0 && (
        <div>
          <p style={{ fontWeight: "bold", color: "#E65100", margin: "0 0 6px 0" }}>Vencen en los próximos 5 días ({expiresSoon.length}):</p>
          {expiresSoon.map((u) => (
            <p key={u.id} style={{ margin: "2px 0", fontSize: "13px" }}>• {u.name || u.nickname || u.idNumber}</p>
          ))}
        </div>
      )}
    </div>
  );
})()}

{/* 📊 REPORTE DE MEMBRESÍAS */}
<div style={{ marginBottom: "20px" }}>
  <button
    onClick={() => setShowReportSection(!showReportSection)}
    style={{
      padding: "12px 16px",
      backgroundColor: "#00796B",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontWeight: "bold",
      marginBottom: "10px",
    }}
  >
    📊 {showReportSection ? "Cerrar reporte" : "Generar reporte de membresías"}
  </button>

  {showReportSection && (
    <div style={{ padding: "16px", backgroundColor: "#E0F2F1", border: "1px solid #00796B", borderRadius: "10px" }}>
      <p style={{ margin: "0 0 12px 0", fontWeight: "bold", color: "#004D40" }}>
        Selecciona el rango de fechas de pago
      </p>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
        <div>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "13px" }}>Desde</label>
          <input
            type="date"
            value={reportStartDate}
            onChange={(e) => setReportStartDate(e.target.value)}
            style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px", fontSize: "13px" }}>Hasta</label>
          <input
            type="date"
            value={reportEndDate}
            onChange={(e) => setReportEndDate(e.target.value)}
            style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px" }}
          />
        </div>
      </div>
      <button
        onClick={handleGenerateReport}
        style={{
          padding: "10px 16px",
          backgroundColor: "#00796B",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        ⬇️ Descargar informe en Excel
      </button>
    </div>
  )}
</div>
{(() => {
  const filteredMembershipUsers = gymUsers.filter((u) => {
    const term = membershipSearchTerm.toLowerCase();
    return (
      (u.idNumber || "").toLowerCase().includes(term) ||
      (u.name || "").toLowerCase().includes(term)
    );
  });
  return (
<>
<h3 style={{ marginBottom: "10px" }}>Listado total de membresías</h3>
<input
  type="text"
  placeholder="Buscar por cédula o nombre..."
  value={membershipSearchTerm}
  onChange={(e) => setMembershipSearchTerm(e.target.value)}
  style={{
    width: "100%",
    padding: "10px",
    marginBottom: "15px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    boxSizing: "border-box",
  }}
/>
{filteredMembershipUsers.length === 0 && <p style={{ color: "#777" }}>No se encontraron usuarios con ese criterio de búsqueda.</p>}
{filteredMembershipUsers.length > 0 && (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <thead>
        <tr style={{ backgroundColor: "#1976D2", color: "#fff" }}>
          <th style={{ padding: "10px 8px", textAlign: "left" }}>Cédula</th>
          <th style={{ padding: "10px 8px", textAlign: "left" }}>Nombre</th>
          <th style={{ padding: "10px 8px", textAlign: "left" }}>Nombre Formal</th>
          <th style={{ padding: "10px 8px", textAlign: "center" }}>Plan</th>
          <th style={{ padding: "10px 8px", textAlign: "center" }}>Fecha Inicio</th>
          <th style={{ padding: "10px 8px", textAlign: "center" }}>Fecha Fin</th>
          <th style={{ padding: "10px 8px", textAlign: "center" }}>Estado</th>
        </tr>
      </thead>
      <tbody>
        {filteredMembershipUsers.map((u, idx) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const endDate = u.membershipEndDate?.toDate
            ? u.membershipEndDate.toDate()
            : u.membershipEndDate ? new Date(u.membershipEndDate) : null;
          const startDate = u.membershipStartDate?.toDate
            ? u.membershipStartDate.toDate()
            : u.membershipStartDate ? new Date(u.membershipStartDate) : null;
          const isExpired = endDate && endDate < today;
          const estadoMembresia = u.membershipStatus === "active" && !isExpired ? "Activa" : "Vencida";
          return (
            <tr key={u.id} style={{ backgroundColor: idx % 2 === 0 ? "#f9f9f9" : "#fff", borderBottom: "1px solid #e0e0e0" }}>
              <td style={{ padding: "8px" }}>{u.idNumber || "N/A"}</td>
              <td style={{ padding: "8px" }}>{u.name || "N/A"}</td>
              <td style={{ padding: "8px" }}>{u.nickname || "N/A"}</td>
              <td style={{ padding: "8px", textAlign: "center" }}>{PLAN_LABELS[u.membershipPlan] || "Sin plan"}</td>
              <td style={{ padding: "8px", textAlign: "center" }}>
                {startDate ? startDate.toLocaleDateString("es-CO") : "No registrado"}
              </td>
              <td style={{ padding: "8px", textAlign: "center" }}>
                {endDate ? endDate.toLocaleDateString("es-CO") : "No registrado"}
              </td>
              <td style={{ padding: "8px", textAlign: "center" }}>
                <span style={{ fontWeight: "bold", color: estadoMembresia === "Activa" ? "green" : "red" }}>
                  {estadoMembresia}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
)}
</>
  );
})()}
  </div>
)}

{activeTab === "informes" && (
  <div>
    <button
      onClick={handleExportarAsistencia}
      style={{
        padding: "12px 20px",
        backgroundColor: "#2E7D32",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "15px",
        marginBottom: "16px",
      }}
    >
      📊 Exportar informe de asistencia (.xlsx)
    </button>
    <div style={{ marginBottom: "24px", marginTop: "24px", padding: "16px", backgroundColor: "#E8EAF6", border: "1px solid #3F51B5", borderRadius: "10px" }}>
      <h4 style={{ margin: "0 0 12px 0", color: "#1A237E" }}>🏋️ Informe de Uso de Máquinas</h4>
      <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#555" }}>
        Muestra cuántas veces fue usada cada estación durante el rango seleccionado. Máximo 3 meses.
      </p>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
        <div>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px", fontSize: "13px" }}>
            Fecha inicio
          </label>
          <input
            type="date"
            value={machineReportStartDate}
            onChange={(e) => setMachineReportStartDate(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "14px",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px", fontSize: "13px" }}>
            Fecha fin
          </label>
          <input
            type="date"
            value={machineReportEndDate}
            onChange={(e) => setMachineReportEndDate(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "14px",
            }}
          />
        </div>
      </div>
      <button
        onClick={handleDownloadMachineReport}
        disabled={machineReportLoading}
        style={{
          padding: "10px 16px",
          backgroundColor: machineReportLoading ? "#90A4AE" : "#3F51B5",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: machineReportLoading ? "not-allowed" : "pointer",
          fontWeight: "bold",
        }}
      >
        {machineReportLoading ? "Generando..." : "⬇️ Descargar informe de máquinas"}
      </button>
    </div>
  </div>
)}

{activeTab === "rutinas" && (
  <div>
<h3 style={{ marginBottom: "10px" }}>🏋️ Rutinas Express del Gimnasio</h3>

<button
  onClick={() => setShowExpressModal(true)}
  style={{
    padding: "12px 16px",
    backgroundColor: "#6A1B9A",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    marginBottom: "15px",
  }}
>
  ➕ Gestionar Rutinas Express
</button>
  </div>
)}
        </div>
      )}

      {editingRoutineUserId && (
        <div
          style={{
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
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "700px",
              maxHeight: "85vh",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
  {isTemplateMode
    ? editingTemplateId
      ? "Editar Rutina Express"
      : "Crear Rutina Express"
    : "Configurar Rutina Individual"}
</h3>
{isTemplateMode && (
  <div style={{ marginBottom: "15px" }}>
    <label style={{ fontWeight: "bold" }}>
      Nombre de la rutina express
    </label>
    <input
      type="text"
      value={editingTemplateName}
      onChange={(e) => setEditingTemplateName(e.target.value)}
      placeholder="Ej: Pecho avanzado"
      style={{
        width: "100%",
        padding: "8px",
        marginTop: "5px",
        borderRadius: "6px",
        border: "1px solid #ccc",
      }}
    />
  </div>
)}

            <button
              onClick={() =>
                setTempExercises([
  ...tempExercises,
  { name: "", dayIndex: 0, muscleGroup: "", station: "", sets: [{ weight: 0, reps: 0 }] },
])
              }
              style={{
                marginBottom: "16px",
                padding: "10px 14px",
                backgroundColor: "#1976D2",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              ➕ Añadir Ejercicio
            </button>

            {tempExercises.length === 0 && (
              <p style={{ color: "#666" }}>
                Aún no has agregado ejercicios a esta rutina.
              </p>
            )}

            {tempExercises.map((ex, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid #ccc",
                  padding: "12px",
                  marginBottom: "12px",
                  borderRadius: "8px",
                  backgroundColor: "#fafafa",
                }}
              >
                {/* Grupo muscular */}
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>
                    Grupo muscular
                  </label>
                  <select
                    value={ex.muscleGroup || ""}
                    onChange={(e) => {
                      const newExs = [...tempExercises];
                      newExs[i].muscleGroup = e.target.value;
                      newExs[i].station = "";
                      newExs[i].name = "";
                      setTempExercises(newExs);
                      setSelectedMuscleGroup(e.target.value);
                      setSelectedStation("");
                    }}
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
                  >
                    <option value="">-- Selecciona grupo muscular --</option>
                    {muscleCatalog.map((group) => (
                      <option key={group.id} value={group.name}>{group.name}</option>
                    ))}
                  </select>
                </div>

                {/* Estación */}
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>
                    Estación
                  </label>
                  <select
                    value={ex.station || ""}
                    disabled={!ex.muscleGroup}
                    onChange={(e) => {
                      const newExs = [...tempExercises];
                      newExs[i].station = e.target.value;
                      setSelectedStation(e.target.value);
                      setTempExercises(newExs);
                    }}
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box", backgroundColor: !ex.muscleGroup ? "#f5f5f5" : "#fff" }}
                  >
                    <option value="">-- Selecciona estación --</option>
                    {ex.muscleGroup && (muscleCatalog.find((m) => m.name === ex.muscleGroup)?.stations || []).map((station) => (
                      <option key={station} value={station}>{station}</option>
                    ))}
                  </select>
                </div>

                {/* Nombre formal del ejercicio — solo visible si hay estación seleccionada */}
                {ex.station && (
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>
                      Nombre formal del ejercicio
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Press de Banca Plano"
                      value={ex.name}
                      onChange={(e) => {
                        const newExs = [...tempExercises];
                        newExs[i].name = e.target.value;
                        setTempExercises(newExs);
                      }}
                      style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
                    />
                  </div>
                )}

                <div style={{ marginBottom: "10px" }}>
  <label
    style={{
      display: "block",
      fontWeight: "bold",
      marginBottom: "6px",
    }}
  >
    Día de entrenamiento
  </label>

  <select
    value={ex.dayIndex ?? 0}
    onChange={(e) => {
      const newExs = [...tempExercises];
      newExs[i].dayIndex = parseInt(e.target.value, 10);
      setTempExercises(newExs);
    }}
    style={{
      width: "100%",
      padding: "8px",
      borderRadius: "4px",
      border: "1px solid #ccc",
      boxSizing: "border-box",
    }}
  >
    <option value={0}>Día 1</option>
    <option value={1}>Día 2</option>
    <option value={2}>Día 3</option>
    <option value={3}>Día 4</option>
    <option value={4}>Día 5</option>
    <option value={5}>Día 6</option>
    <option value={6}>Día 7</option>
  </select>
</div>

                <div style={{ marginBottom: "10px", fontWeight: "bold" }}>
                  Series
                </div>

                {ex.sets.map((set, setIndex) => (
                  <div
                    key={setIndex}
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginBottom: "8px",
                    }}
                  >
                    <input
                      type="number"
                      placeholder="Peso"
                      value={set.weight || ""}
                      onChange={(e) => {
                        const newExs = [...tempExercises];
                        newExs[i].sets[setIndex].weight =
                          parseFloat(e.target.value) || 0;
                        setTempExercises(newExs);
                      }}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />

                    <input
                      type="number"
                      placeholder="Reps"
                      value={set.reps || ""}
                      onChange={(e) => {
                        const newExs = [...tempExercises];
                        newExs[i].sets[setIndex].reps =
                          parseInt(e.target.value) || 0;
                        setTempExercises(newExs);
                      }}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />

                    <button
                      onClick={() => {
                        const newExs = [...tempExercises];
                        newExs[i].sets = newExs[i].sets.filter(
                          (_, idx) => idx !== setIndex
                        );
                        if (newExs[i].sets.length === 0) {
                          newExs[i].sets = [{ weight: 0, reps: 0 }];
                        }
                        setTempExercises(newExs);
                      }}
                      style={{
                        backgroundColor: "#D32F2F",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        padding: "8px 10px",
                        cursor: "pointer",
                      }}
                    >
                      ✖
                    </button>
                  </div>
                ))}

                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    onClick={() => {
                      const newExs = [...tempExercises];
                      newExs[i].sets.push({ weight: 0, reps: 0 });
                      setTempExercises(newExs);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#4CAF50",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    + Serie
                  </button>

                  <button
                    onClick={() => {
                      const newExs = tempExercises.filter((_, idx) => idx !== i);
                      setTempExercises(newExs);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#D32F2F",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Eliminar ejercicio
                  </button>
                </div>
              </div>
            ))}

            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
  if (isTemplateMode) {
    handleSaveTemplateFromModal();
  } else {
    handleSaveIndividualRoutine();
  }
}}
                style={{
                  backgroundColor: "#2E7D32",
                  color: "white",
                  padding: "10px",
                  flex: 1,
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {isTemplateMode ? "💾 Guardar Rutina Express" : "💾 Guardar en Usuario"}
              </button>

              <button
                onClick={() => {
                  if (isTemplateMode) {
                    resetTemplateForm();
                    setShowExpressModal(true);
                  } else {
                    setEditingRoutineUserId(null);
                    setTempExercises([]);
                  }
                }}
                style={{
                  backgroundColor: "#ccc",
                  padding: "10px",
                  flex: 1,
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showExpressModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.75)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            zIndex: 1000,
            padding: "20px",
            boxSizing: "border-box",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "960px",
              boxSizing: "border-box",
              margin: "auto",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#6A1B9A" }}>🏋️ Rutinas Express del Gimnasio</h3>

            {/* Nombre de la rutina */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>
                Nombre de la rutina express
              </label>
              <input
                type="text"
                value={editingTemplateName}
                onChange={(e) => setEditingTemplateName(e.target.value)}
                placeholder="Ej: Pecho avanzado, Pierna básico…"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                  fontSize: "15px",
                }}
              />
            </div>

            {/* Tabla de 7 días */}
            <div
              style={{
                marginBottom: "16px",
                padding: "14px",
                backgroundColor: "#f4f8ff",
                borderRadius: "8px",
                border: "1px solid #6A1B9A",
              }}
            >
              <h4 style={{ margin: "0 0 12px 0", color: "#6A1B9A" }}>
                Vista semanal de la rutina
              </h4>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  overflowX: "auto",
                  paddingBottom: "6px",
                }}
              >
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const exercisesForDay = tempExercises
                    .map((ex, originalIndex) => ({ ...ex, originalIndex }))
                    .filter((ex) => (ex.dayIndex ?? 0) === day);

                  return (
                    <div
                      key={day}
                      style={{
                        minWidth: "260px",
                        flex: "0 0 260px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #ce93d8",
                        borderRadius: "8px",
                        padding: "10px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "bold",
                          color: "#6A1B9A",
                          marginBottom: "10px",
                          textAlign: "center",
                          borderBottom: "1px solid #e1bee7",
                          paddingBottom: "6px",
                        }}
                      >
                        Día {day + 1}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.5fr 1fr 1fr auto",
                          gap: "6px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          color: "#555",
                          marginBottom: "6px",
                          padding: "0 2px",
                        }}
                      >
                        <div>Ejercicio</div>
                        <div>Peso</div>
                        <div>Reps</div>
                        <div></div>
                      </div>

                      {exercisesForDay.length > 0 ? (
                        <div style={{ display: "grid", gap: "6px" }}>
                          {exercisesForDay.map((ex) => (
                            <div
                              key={ex.originalIndex}
                              style={{
                                backgroundColor: "#f3e5f5",
                                borderRadius: "6px",
                                padding: "8px",
                                border: "1px solid #ce93d8",
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1.5fr 1fr 1fr auto",
                                  gap: "6px",
                                  alignItems: "start",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: "bold",
                                    color: "#222",
                                    fontSize: "12px",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {ex.name || "Sin nombre"}
                                </div>

                                <div style={{ fontSize: "11px", color: "#444" }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                    {ex.sets && ex.sets.length > 0 ? (
                                      ex.sets.map((set, si) => (
                                        <div key={si}>{set.weight ?? 0}</div>
                                      ))
                                    ) : (
                                      <div>-</div>
                                    )}
                                  </div>
                                </div>

                                <div style={{ fontSize: "11px", color: "#444" }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                    {ex.sets && ex.sets.length > 0 ? (
                                      ex.sets.map((set, si) => (
                                        <div key={si}>{set.reps ?? 0}</div>
                                      ))
                                    ) : (
                                      <div>-</div>
                                    )}
                                  </div>
                                </div>

                                <button
                                  onClick={() =>
                                    setTempExercises((prev) =>
                                      prev.filter((_, idx) => idx !== ex.originalIndex)
                                    )
                                  }
                                  style={{
                                    color: "#D32F2F",
                                    border: "none",
                                    background: "none",
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                    fontSize: "13px",
                                    padding: 0,
                                  }}
                                  title="Eliminar ejercicio"
                                >
                                  ✖
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#999",
                            fontStyle: "italic",
                            padding: "8px 4px",
                          }}
                        >
                          Sin ejercicios
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Botón añadir ejercicio */}
            <button
              onClick={() => {
                setShowExpressModal(false);
                setIsTemplateMode(true);
                setEditingRoutineUserId("TEMPLATE_MODE");
              }}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#1976D2",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                marginBottom: "10px",
              }}
            >
              ➕ Añadir / editar ejercicios
            </button>

            {/* Guardar rutina express */}
            <button
              onClick={handleFinalSaveExpressTemplate}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                marginBottom: "10px",
              }}
            >
              💾 Guardar Rutina Express
            </button>

            {/* Rutinas guardadas */}
            <details style={{ marginBottom: "10px" }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: "bold",
                  color: "#6A1B9A",
                  padding: "8px 0",
                  userSelect: "none",
                }}
              >
                📋 Mis rutinas guardadas ({gymRoutineTemplates.length})
              </summary>

              <div style={{ marginTop: "10px" }}>
                {loadingTemplates && <p style={{ color: "#777" }}>Cargando...</p>}

                {!loadingTemplates && gymRoutineTemplates.length === 0 && (
                  <p style={{ color: "#777", fontSize: "13px" }}>Aún no has guardado rutinas express.</p>
                )}

                {!loadingTemplates && gymRoutineTemplates.length > 0 && (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {gymRoutineTemplates.map((template) => (
                      <div
                        key={template.id}
                        style={{
                          padding: "10px 12px",
                          border: "1px solid #ccc",
                          borderRadius: "8px",
                          backgroundColor: "#fafafa",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "14px" }}>{template.name}</strong>
                          <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                            {(template.exercises || []).length} ejercicio(s)
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <button
                            onClick={() => handleEditTemplate(template)}
                            style={{
                              padding: "5px 10px",
                              backgroundColor: "#1976D2",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontWeight: "bold",
                              fontSize: "12px",
                            }}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id, template.name)}
                            style={{
                              padding: "5px 10px",
                              backgroundColor: "#D32F2F",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontWeight: "bold",
                              fontSize: "12px",
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    resetTemplateForm();
                  }}
                  style={{
                    marginTop: "10px",
                    padding: "8px 12px",
                    backgroundColor: "#f3e5f5",
                    color: "#6A1B9A",
                    border: "1px solid #ce93d8",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "13px",
                  }}
                >
                  ➕ Nueva rutina (limpiar tabla)
                </button>
              </div>
            </details>

            {/* Cancelar */}
            <button
              onClick={() => {
                resetTemplateForm();
                setShowExpressModal(false);
              }}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#e0e0e0",
                color: "#333",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showSelectTemplateModal && (
        <div
          style={{
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
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "500px",
              maxHeight: "80vh",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            <h3 style={{ marginTop: 0 }}>⚡ Seleccionar Rutina Express</h3>
            <p style={{ color: "#555", marginBottom: "16px" }}>
              La rutina seleccionada reemplazará la rutina actual del usuario.
            </p>

            {gymRoutineTemplates.length === 0 && (
              <p style={{ color: "#777" }}>
                No hay rutinas express disponibles. Crea una primero desde "Gestionar Rutinas Express".
              </p>
            )}

            {gymRoutineTemplates.length > 0 && (
              <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
                {gymRoutineTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleLoadTemplateToUser(selectTemplateTargetUserId, template)}
                    style={{
                      padding: "14px",
                      backgroundColor: "#f4f8ff",
                      border: "2px solid #1976D2",
                      borderRadius: "8px",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: "bold",
                      color: "#1976D2",
                    }}
                  >
                    {template.name}
                    <span
                      style={{
                        display: "block",
                        fontSize: "12px",
                        color: "#666",
                        fontWeight: "normal",
                        marginTop: "4px",
                      }}
                    >
                      {(template.exercises || []).length} ejercicio(s)
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                setShowSelectTemplateModal(false);
                setSelectTemplateTargetUserId(null);
              }}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#e0e0e0",
                color: "#333",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

{showRenewModal && renewTargetUser && (
  <div
    style={{
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
    }}
  >
    <div
      style={{
        backgroundColor: "white",
        padding: "24px",
        borderRadius: "12px",
        width: "100%",
        maxWidth: "400px",
        boxSizing: "border-box",
      }}
    >
      <h3 style={{ marginTop: 0 }}>🔄 Renovar membresía</h3>
      <p style={{ color: "#555", marginBottom: "16px" }}>
        <strong>{renewTargetUser.name || renewTargetUser.nickname || renewTargetUser.idNumber}</strong>
      </p>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>
          Plan de membresía
        </label>
        <select
          value={renewPlan}
          onChange={(e) => setRenewPlan(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            boxSizing: "border-box",
            fontSize: "14px",
          }}
        >
          <option value="monthly">Mensual — 1 mes</option>
          <option value="bimonthly">Bimensual — 2 meses</option>
          <option value="quarterly">Trimestral — 3 meses</option>
          <option value="semiannual">Semestral — 6 meses</option>
          <option value="annual">Anual — 12 meses</option>
        </select>

<div style={{ marginTop: "14px" }}>
  <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>
    Fecha de inicio
  </label>
  <input
    type="date"
    value={renewStartDate}
    onChange={(e) => setRenewStartDate(e.target.value)}
    style={{
      width: "100%",
      padding: "10px",
      borderRadius: "6px",
      border: "1px solid #ccc",
      boxSizing: "border-box",
      fontSize: "14px",
    }}
  />
</div>

<div style={{ marginTop: "14px", marginBottom: "4px" }}>
  <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>
    Fecha de fin (opcional — se calcula automáticamente si no la ingresas)
  </label>
  <input
    type="date"
    value={renewEndDate}
    onChange={(e) => setRenewEndDate(e.target.value)}
    style={{
      width: "100%",
      padding: "10px",
      borderRadius: "6px",
      border: "1px solid #ccc",
      boxSizing: "border-box",
      fontSize: "14px",
    }}
  />
</div>
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={handleRenewMembership}
          disabled={renewLoading}
          style={{
            flex: 1,
            padding: "12px",
            backgroundColor: renewLoading ? "#90A4AE" : "#1976D2",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: renewLoading ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {renewLoading ? "Guardando..." : "Confirmar renovación"}
        </button>
        <button
          onClick={() => {
            setShowRenewModal(false);
            setRenewTargetUser(null);
            setRenewStartDate("");
            setRenewEndDate("");
          }}
          disabled={renewLoading}
          style={{
            flex: 1,
            padding: "12px",
            backgroundColor: "#e0e0e0",
            color: "#333",
            border: "none",
            borderRadius: "6px",
            cursor: renewLoading ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}

      {showStoryModal && (
        <div
          style={{
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
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "420px",
              boxSizing: "border-box",
            }}
          >
            <h3 style={{ marginTop: 0 }}>📸 Publicar Historia</h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>
                Foto
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setStoryFile(file);
                  setStoryPreviewUrl(URL.createObjectURL(file));
                }}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            {storyPreviewUrl && (
              <img
                src={storyPreviewUrl}
                alt="Vista previa"
                style={{
                  width: "100%",
                  maxHeight: "200px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              />
            )}

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>
                Mensaje (opcional)
              </label>
              <input
                type="text"
                value={storyMessage}
                onChange={(e) => {
                  if (e.target.value.length <= 100) setStoryMessage(e.target.value);
                }}
                placeholder="Escribe un mensaje corto..."
                maxLength={100}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                }}
              />
              <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#888", textAlign: "right" }}>
                {storyMessage.length}/100
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handlePublishStory}
                disabled={storyUploading || !storyFile}
                style={{
                  flex: 1,
                  padding: "12px",
                  backgroundColor: storyUploading || !storyFile ? "#90A4AE" : "#E64A19",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: storyUploading || !storyFile ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                {storyUploading ? "Publicando..." : "Publicar"}
              </button>
              <button
                onClick={() => {
                  setShowStoryModal(false);
                  setStoryFile(null);
                  setStoryMessage("");
                  setStoryPreviewUrl(null);
                }}
                disabled={storyUploading}
                style={{
                  flex: 1,
                  padding: "12px",
                  backgroundColor: "#e0e0e0",
                  color: "#333",
                  border: "none",
                  borderRadius: "6px",
                  cursor: storyUploading ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

{showPollModal && (
  <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", backgroundColor:"rgba(0,0,0,0.75)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:1000, padding:"20px", boxSizing:"border-box" }}>
    <div style={{ backgroundColor:"white", padding:"24px", borderRadius:"12px", width:"100%", maxWidth:"500px", boxSizing:"border-box" }}>
      <h3 style={{ marginTop:0 }}>📊 Nueva Encuesta</h3>
      <div style={{ marginBottom:"14px" }}>
        <label style={{ display:"block", fontWeight:"bold", marginBottom:"6px" }}>Pregunta</label>
        <input type="text" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Ej: ¿Cuál es tu clase favorita?" style={{ width:"100%", padding:"10px", borderRadius:"6px", border:"1px solid #ccc", boxSizing:"border-box" }} />
      </div>
      <div style={{ marginBottom:"14px" }}>
        <label style={{ display:"block", fontWeight:"bold", marginBottom:"6px" }}>Opciones (mínimo 2, máximo 4)</label>
        {pollOptions.map((opt, i) => (
          <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"8px" }}>
            <input type="text" value={opt} onChange={(e) => { const updated = [...pollOptions]; updated[i] = e.target.value; setPollOptions(updated); }} placeholder={`Opción ${i + 1}`} style={{ flex:1, padding:"8px", borderRadius:"6px", border:"1px solid #ccc" }} />
            {pollOptions.length > 2 && (
              <button onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))} style={{ backgroundColor:"#D32F2F", color:"#fff", border:"none", borderRadius:"4px", padding:"8px 10px", cursor:"pointer" }}>✖</button>
            )}
          </div>
        ))}
        {pollOptions.length < 4 && (
          <button onClick={() => setPollOptions([...pollOptions, ""])} style={{ padding:"8px 12px", backgroundColor:"#1976D2", color:"#fff", border:"none", borderRadius:"6px", cursor:"pointer", fontWeight:"bold" }}>+ Opción</button>
        )}
      </div>
      <div style={{ display:"flex", gap:"10px", marginTop:"16px" }}>
        <button onClick={handleSavePoll} style={{ flex:1, padding:"10px", backgroundColor:"#2E7D32", color:"#fff", border:"none", borderRadius:"6px", cursor:"pointer", fontWeight:"bold" }}>✅ Publicar</button>
        <button onClick={() => { setShowPollModal(false); setPollQuestion(""); setPollOptions(["",""]); }} style={{ flex:1, padding:"10px", backgroundColor:"#ccc", border:"none", borderRadius:"6px", cursor:"pointer", fontWeight:"bold" }}>Cancelar</button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

  // Si por algún motivo un super_admin llega hasta aquí (fuera de /admin),
  // no renderizamos nada roto: lo mandamos a la ruta correcta.
  return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
      <p>Esta cuenta es de super administrador.</p>
      <a href="/admin" style={{ color: "#1976D2", fontWeight: "bold" }}>
        Ir al panel de Super Admin
      </a>
    </div>
  );
}

export default App;
