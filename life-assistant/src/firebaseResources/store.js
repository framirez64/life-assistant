// Import Firestore functions
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { database } from "./config";

export const createUser = async (npub, userName) => {
  const userDocRef = doc(database, "users", npub);
  await setDoc(
    userDocRef,
    {
      name: userName,
      npub: npub,
      step: "onboarding",
      onboardingStep: 1,
    },
    { merge: true }
  );
};

export const getUser = async (npub) => {
  const userDocRef = doc(database, "users", npub);
  const userDoc = await getDoc(userDocRef);

  if (userDoc.exists()) {
    return userDoc.data();
  } else {
    return null;
  }
};

export const updateUser = async (npub, payload) => {
  const userDocRef = doc(database, "users", npub);

  await updateDoc(userDocRef, {
    ...payload,
  });
};
