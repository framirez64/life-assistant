import { useEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { Box, Stack } from "@chakra-ui/react";
import { createUser, getUser } from "./firebaseResources/store";
import { ColorModeSwitcher } from "./components/ColorModeSwitcher";
import { Onboarding } from "./components/Onboarding/Onboarding";
import { Landing } from "./components/Landing/Landing";
import { Assistant } from "./components/Assistant/Assistant";
import { useDecentralizedIdentity } from "./hooks/useDecentralizedIdentity";

function App() {
  const { nostrPubKey } = useDecentralizedIdentity(
    localStorage.getItem("local_npub"),
    localStorage.getItem("local_nsec")
  );
  const navigate = useNavigate();
  const [userDocument, setUserDocument] = useState({});

  useEffect(() => {
    const retrieveUser = async (npub) => {
      let user = await getUser(npub);
      if (user) {
        if (user.step === "onboarding") {
          navigate("/onboarding/" + user.onboardingStep);
        } else {
          navigate("/assistant");
        }
      }
    };
    console.log("running mount");
    let npub = localStorage.getItem("local_npub");
    if (npub) {
      retrieveUser(npub);
    } else {
      navigate("/login");
    }
  }, [navigate]);

  return (
    <>
      <Stack direction="row" justify="end" mb={4}>
        <ColorModeSwitcher />
        <Box
          variant="ghost"
          display="flex"
          alignItems={"center"}
          onClick={() => {
            localStorage.removeItem("local_npub");
            localStorage.removeItem("local_nsec");

            navigate("/");
          }}
        >
          Sign Out
        </Box>
      </Stack>
      <Routes>
        <Route path="/login" element={<Landing />}></Route>
        <Route path="/onboarding/:step" element={<Onboarding />}></Route>
        <Route path="/assistant" element={<Assistant />}></Route>
      </Routes>
    </>
  );
}

export default App;
