const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();

function extractStoragePath(url) {
  if (!url) return null;
  try {
    const match = url.match(/\/o\/(.+?)(?:\?|$)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

async function deleteStorageFileByUrl(url) {
  const path = extractStoragePath(url);
  if (!path) return;
  try {
    await bucket.file(path).delete();
  } catch (err) {
    console.warn("No se pudo borrar archivo de Storage:", path, err.message);
  }
}

async function deleteQueryBatched(queryRef) {
  const snap = await queryRef.get();
  if (snap.empty) return 0;
  const docs = snap.docs;
  let deleted = 0;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + 450);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

// En firebase-functions v6 (2nd Gen), onCall recibe un único objeto CallableRequest.
// request.auth  = contexto de autenticación del caller
// request.data  = payload enviado por el cliente
function requireSuperAdmin(request) {
  if (!request.auth || request.auth.token.role !== "super_admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo un super administrador puede ejecutar esta acción."
    );
  }
}

// ============================================================
// deleteGymCascade
// ============================================================
exports.deleteGymCascade = functions.https.onCall(async (request) => {
  requireSuperAdmin(request);

  const { gymId } = request.data;
  if (!gymId) {
    throw new functions.https.HttpsError("invalid-argument", "Falta gymId.");
  }

  const summary = {
    deletedUsers: 0,
    deletedProfiles: 0,
    deletedTrainingHistory: 0,
    deletedAttendance: 0,
    deletedTemplates: 0,
    deletedNotices: 0,
    deletedPolls: 0,
    deletedStories: 0,
  };

  // 1) Usuarios (Auth + Firestore)
  const usersSnap = await db.collection("users").where("gymId", "==", gymId).get();
  for (const userDoc of usersSnap.docs) {
    try {
      await admin.auth().deleteUser(userDoc.id);
    } catch (err) {
      console.warn("No se pudo borrar de Auth (puede que ya no exista):", userDoc.id, err.message);
    }
  }
  summary.deletedUsers = await deleteQueryBatched(
    db.collection("users").where("gymId", "==", gymId)
  );

  // 2) user_profiles + subcolección gym_routines
  const profilesSnap = await db.collection("user_profiles").where("gymId", "==", gymId).get();
  for (const profileDoc of profilesSnap.docs) {
    const routinesSnap = await db
      .collection("user_profiles")
      .doc(profileDoc.id)
      .collection("gym_routines")
      .get();
    if (!routinesSnap.empty) {
      const batch = db.batch();
      routinesSnap.docs.forEach((r) => batch.delete(r.ref));
      await batch.commit();
    }
  }
  summary.deletedProfiles = await deleteQueryBatched(
    db.collection("user_profiles").where("gymId", "==", gymId)
  );

  // 3) user_training_history
  summary.deletedTrainingHistory = await deleteQueryBatched(
    db.collection("user_training_history").where("gymId", "==", gymId)
  );

  // 4) gym_attendance
  summary.deletedAttendance = await deleteQueryBatched(
    db.collection("gym_attendance").where("gymId", "==", gymId)
  );

  // 5) gym_routine_templates
  summary.deletedTemplates = await deleteQueryBatched(
    db.collection("gym_routine_templates").where("gymId", "==", gymId)
  );

  // 6) gym_notices
  summary.deletedNotices = await deleteQueryBatched(
    db.collection("gym_notices").where("gymId", "==", gymId)
  );

  // 7) gym_polls
  summary.deletedPolls = await deleteQueryBatched(
    db.collection("gym_polls").where("gymId", "==", gymId)
  );

  // 8) gym_stories (+ subcolección likes + imagen en Storage)
  const storiesSnap = await db.collection("gym_stories").where("gymId", "==", gymId).get();
  for (const storyDoc of storiesSnap.docs) {
    const likesSnap = await db
      .collection("gym_stories")
      .doc(storyDoc.id)
      .collection("likes")
      .get();
    if (!likesSnap.empty) {
      const batch = db.batch();
      likesSnap.docs.forEach((l) => batch.delete(l.ref));
      await batch.commit();
    }
    await deleteStorageFileByUrl(storyDoc.data().imageUrl);
  }
  summary.deletedStories = await deleteQueryBatched(
    db.collection("gym_stories").where("gymId", "==", gymId)
  );

  // 9) Imágenes propias del gimnasio + carpeta tapiz completa
  const gymRef = db.collection("gyms").doc(gymId);
  const gymSnap = await gymRef.get();
  if (gymSnap.exists) {
    const gymData = gymSnap.data();
    await deleteStorageFileByUrl(gymData.logoUrl);
    await deleteStorageFileByUrl(gymData.gymNameImageUrl);
    await deleteStorageFileByUrl(gymData.tapizImageUrl);
  }
  try {
    await bucket.deleteFiles({ prefix: `gym_tapiz/${gymId}/` });
  } catch (err) {
    console.warn("No se pudo limpiar carpeta gym_tapiz:", err.message);
  }

  // 10) Documento del gimnasio
  await gymRef.delete();

  return { success: true, ...summary };
});

// ============================================================
// deletePersonCascade
// ============================================================
exports.deletePersonCascade = functions.https.onCall(async (request) => {
  requireSuperAdmin(request);

  const { profileId, gymId } = request.data;
  if (!profileId || !gymId) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan profileId o gymId.");
  }

  const profileRef = db.collection("user_profiles").doc(profileId);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) {
    throw new functions.https.HttpsError("not-found", "No se encontró el perfil indicado.");
  }
  const profileData = profileSnap.data();
  const idNumber = profileData.idNumber;
  const uid = profileData.uid;

  // Subcolección gym_routines del perfil
  const routinesSnap = await profileRef.collection("gym_routines").get();
  if (!routinesSnap.empty) {
    const batch = db.batch();
    routinesSnap.docs.forEach((r) => batch.delete(r.ref));
    await batch.commit();
  }

  // user_training_history vinculado por gymId + userId (corregido: el campo real es "userId", no "idNumber")
  let deletedTrainingHistory = 0;
  if (idNumber) {
    deletedTrainingHistory = await deleteQueryBatched(
      db
        .collection("user_training_history")
        .where("gymId", "==", gymId)
        .where("userId", "==", idNumber)
    );
  }

  // gym_attendance vinculado por gymId + idNumber
  let deletedAttendance = 0;
  if (idNumber) {
    deletedAttendance = await deleteQueryBatched(
      db.collection("gym_attendance").where("gymId", "==", gymId).where("idNumber", "==", idNumber)
    );
  }

  // 🔥 NUEVO: Borrar cuenta de Firebase Authentication y documento en "users"
  let deletedAuthUser = false;
  let deletedUserDoc = false;

  if (uid) {
    try {
      await admin.auth().deleteUser(uid);
      deletedAuthUser = true;
    } catch (err) {
      console.warn("No se pudo borrar de Auth (puede que ya no exista):", uid, err.message);
    }

    try {
      await db.collection("users").doc(uid).delete();
      deletedUserDoc = true;
    } catch (err) {
      console.warn("No se pudo borrar documento en users:", uid, err.message);
    }
  } else {
    console.warn("El perfil no tiene campo 'uid' guardado — no se pudo borrar la cuenta de Auth ni el documento en 'users'. Esto ocurre con perfiles creados antes de la corrección.");
  }

  // Documento principal del perfil
  await profileRef.delete();

  return {
    success: true,
    deletedTrainingHistory,
    deletedAttendance,
    deletedAuthUser,
    deletedUserDoc,
  };
});

// ============================================================
// sendGymNotification
// ============================================================
exports.sendGymNotification = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const callerRole = request.auth.token.role;
  const callerGymId = request.auth.token.gymId;

  const { gymId, title, body } = request.data;

  if (!gymId || !title || !body) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan gymId, title o body.");
  }

  const isSuperAdmin = callerRole === "super_admin";
  const isOwnGymAdmin = callerRole === "gym_admin" && callerGymId === gymId;

  if (!isSuperAdmin && !isOwnGymAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No tienes permiso para enviar notificaciones a este gimnasio."
    );
  }

  // 1) Buscar todos los usuarios del gimnasio que tengan token FCM registrado
  const usersSnap = await db
    .collection("users")
    .where("gymId", "==", gymId)
    .get();

  const tokens = [];
  const tokenToUserId = {};
  usersSnap.docs.forEach((doc) => {
    const token = doc.data().fcmToken;
    if (token) {
      tokens.push(token);
      tokenToUserId[token] = doc.id;
    }
  });

  if (tokens.length === 0) {
    return {
      success: true,
      sent: 0,
      message: "No hay usuarios con token FCM registrado en este gimnasio.",
    };
  }

  // 2) Enviar notificación en lotes de 500 (límite de FCM multicast)
  let sentCount = 0;
  const invalidTokens = [];

  for (let i = 0; i < tokens.length; i += 500) {
    const batchTokens = tokens.slice(i, i + 500);
    const message = {
      notification: { title, body },
      tokens: batchTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    sentCount += response.successCount;

    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const errorCode = res.error?.code;
        if (
          errorCode === "messaging/invalid-registration-token" ||
          errorCode === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(batchTokens[idx]);
        }
      }
    });
  }

  // 3) Limpiar tokens inválidos o expirados de Firestore
  if (invalidTokens.length > 0) {
    const batch = db.batch();
    invalidTokens.forEach((token) => {
      const userId = tokenToUserId[token];
      if (userId) {
        batch.update(db.collection("users").doc(userId), {
          fcmToken: admin.firestore.FieldValue.delete(),
        });
      }
    });
    await batch.commit();
  }

  return {
    success: true,
    sent: sentCount,
    invalidTokensRemoved: invalidTokens.length,
  };
});

// ============================================================
// seedDefaultLayoutTemplate
// ============================================================
exports.seedDefaultLayoutTemplate = require("./seedLayoutTemplates").seedDefaultLayoutTemplate;
