import { useEffect, useState } from "react";
import { useDecentralizedIdentity } from "./hooks/useDecentralizedIdentity";
import { createUser, getUser } from "./firebaseResources/store";

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authField, setAuthField] = useState("");

  const { nostrPubKey, generateNostrKeys, auth, errorMessage } =
    useDecentralizedIdentity(
      localStorage.getItem("local_npub"),
      localStorage.getItem("local_nsec")
    );

  useEffect(() => {
    const retrieveUser = async () => {
      let user = await getUser(nostrPubKey);
      console.log("user", user);

      if (user) {
        setIsSignedIn(true);
      } else {
        if (authField.includes("nsec")) {
          createUser(nostrPubKey, "");
        } else if (authField.length > 0) {
          createUser(nostrPubKey, authField);
        } else {
          createUser(nostrPubKey, "");
        }
      }
    };

    if (nostrPubKey) {
      retrieveUser();
    }
  }, [nostrPubKey]);

  return (
    <main>
      <h2>Life Assistant</h2>

      <label>Enter a username or secret key</label>
      <input
        type="text"
        onChange={(event) => setAuthField(event.target.value)}
      />

      <div>
        <button onClick={() => generateNostrKeys(authField)}>
          Create Account
        </button>
        <button onClick={() => auth(authField)}>Sign in with secret key</button>
      </div>

      <div>{nostrPubKey ? `Welcome, ${nostrPubKey.substr(0, 8)}` : null}</div>
      <div>{errorMessage}</div>
    </main>
  );
}
``;
export default App;
