import { useEffect, useState } from "react";
import {
  Box,
  VStack,
  Stack,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Button,
  Text,
} from "@chakra-ui/react";
import { useDecentralizedIdentity } from "./hooks/useDecentralizedIdentity";
import { createUser, getUser } from "./firebaseResources/store";
import { ColorModeSwitcher } from "./components/ColorModeSwitcher";

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
      const user = await getUser(nostrPubKey);
      console.log("user", user);

      if (user) {
        setIsSignedIn(true);
      } else {
        // Create new user with either secret key or blank name
        createUser(nostrPubKey, authField.includes("nsec") ? "" : authField);
      }
    };

    if (nostrPubKey) {
      retrieveUser();
    }
  }, [nostrPubKey, authField]);

  return (
    <Box as="main" p={4} maxW="md" mx="auto">
      <Stack direction="row" justify="end" mb={4}>
        <ColorModeSwitcher />
      </Stack>

      <VStack spacing={6} align="stretch">
        <Heading as="h2" size="lg" textAlign="center">
          Life Assistant
        </Heading>

        <FormControl>
          <FormLabel>Enter a username or secret key</FormLabel>
          <Input
            value={authField}
            onChange={(e) => setAuthField(e.target.value)}
            placeholder="Username or Secret Key"
          />
        </FormControl>

        <Stack direction={{ base: "column", sm: "row" }} spacing={4}>
          <Button
            colorScheme="teal"
            onClick={() => generateNostrKeys(authField)}
          >
            Create Account
          </Button>
          <Button variant="outline" onClick={() => auth(authField)}>
            Sign in with secret key
          </Button>
        </Stack>

        {nostrPubKey && (
          <Text fontSize="md">Welcome, {nostrPubKey.substring(0, 8)}</Text>
        )}

        {errorMessage && (
          <Text color="red.500" fontSize="sm">
            {errorMessage}
          </Text>
        )}
      </VStack>
    </Box>
  );
}

export default App;
