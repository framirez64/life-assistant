import { useEffect } from "react";
import { database } from "../firebaseResources/config";
import { doc, setDoc } from "firebase/firestore";

function App() {
  useEffect(() => {
    const writeTestUser = async () => {
      try {
        // Create (or overwrite) document "test" in collection "user"
        await setDoc(doc(database, "user", "test"), { name: "dog" });
        console.log("✅ test user written");
      } catch (err) {
        console.error("❌ error writing test user:", err);
      }
    };
    writeTestUser();
  }, []);

  return <>Life Assistant</>;
}

export default App;
