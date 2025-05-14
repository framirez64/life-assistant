import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Heading,
  Text,
  Stack,
  Card,
  CardHeader,
  CardBody,
  Spinner,
} from "@chakra-ui/react";
import { getGenerativeModel } from "@firebase/vertexai";
import { vertexAI, Schema, database } from "../../firebaseResources/config";
import { getUser } from "../../firebaseResources/store";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

// JSON schema for daily strategic helper
const responseSchema = Schema.object({
  properties: {
    recipes: Schema.array({
      items: Schema.object({
        properties: {
          name: Schema.string(),
          description: Schema.string(),
          ingredients: Schema.string(),
          nutritionalAnalysis: Schema.string(),
        },
        required: ["name", "description", "ingredients", "nutritionalAnalysis"],
      }),
    }),
    bestSuggestion: Schema.string(),
  },
  required: ["recipes", "bestSuggestion"],
});

const model = getGenerativeModel(vertexAI, {
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema,
  },
});

// Color helpers (hex <-> HSL)
const hexToHsl = (hex) => {
  const c = hex.replace(/^#/, "");
  const num = parseInt(c, 16);
  let r = (num >> 16) & 255,
    g = (num >> 8) & 255,
    b = num & 255;
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
};

const hslToHex = ({ h, s, l }) => {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 60) % 6;
  const f = (n) => {
    const val = l - l * s * Math.max(Math.min(k(n), 4 - k(n), 1), -1);
    return Math.round(val * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
};

const getAnalogousTextColor = (hex) => {
  const { h, s, l } = hexToHsl(hex);
  const newHue = (h + 30) % 360;
  const newL = l < 50 ? Math.min(l + 40, 90) : Math.max(l - 40, 10);
  return hslToHex({ h: newHue, s, l: newL });
};

export const Assistant = () => {
  const [userDoc, setUserDoc] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingMemories, setLoadingMemories] = useState(true);
  const [memories, setMemories] = useState([]);
  const [loadingAction, setLoadingAction] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [bestSuggestion, setBestSuggestion] = useState("");

  useEffect(() => {
    (async () => {
      const npub = localStorage.getItem("local_npub");
      const user = await getUser(npub);
      setUserDoc(user);
      setLoadingUser(false);
    })();
  }, []);

  useEffect(() => {
    if (!userDoc) return;
    (async () => {
      setLoadingMemories(true);
      console.log("userdoc", userDoc);
      const memRef = collection(
        database,
        "users",
        localStorage.getItem("local_npub"),
        "memories"
      );
      const q = query(memRef, orderBy("dayNumber"));
      const memSnap = await getDocs(q);
      setMemories(memSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoadingMemories(false);
    })();
  }, [userDoc]);

  const runAction = async () => {
    if (!userDoc) return;
    setLoadingAction(true);
    setRecipes([]);
    setBestSuggestion("");

    const dayNumber = memories.length + 1;
    const memoryContext = memories
      .map((m) => `Day ${m.dayNumber}: ${m.suggestion}`)
      .join("\n");
    const prompt = `
Day ${dayNumber}
Previous progress:
${memoryContext}

User Goals: "${userDoc.goals}";
Responsibilities: "${userDoc.responsibilities}";
Diet: "${userDoc.diet}";
Education: "${userDoc.education}".

Return a JSON with two keys: "bestSuggestion" (a concise strategic move for Day ${dayNumber}) and "recipes" (an array of 5 meal ideas with name, description, ingredients, and nutritionalAnalysis including vitamin, macro and health gains, and how this helps health).`;
    let raw = "";

    try {
      const stream = await model.generateContentStream(prompt);
      for await (const chunk of stream.stream) {
        raw += chunk.text();
      }
      const { bestSuggestion: bs, recipes: rs } = JSON.parse(raw);
      setBestSuggestion(bs);
      setRecipes(rs);

      let recipeNames = rs.map((r) => r.name);

      // save memory to Firestore
      const memRef = collection(
        database,
        "users",
        localStorage.getItem("local_npub"),
        "memories"
      );
      await addDoc(memRef, {
        dayNumber,
        suggestion: bs,
        recipes: recipeNames,
        timestamp: serverTimestamp(),
      });
      setMemories((prev) => [
        ...prev,
        { dayNumber, suggestion: bs, recipes: rs },
      ]);
    } catch (err) {
      console.error("JSON parse error:", err);
    }

    setLoadingAction(false);
  };

  if (loadingUser || loadingMemories) {
    return (
      <Box p={4} textAlign="center">
        <Spinner />
      </Box>
    );
  }

  return (
    <Box p={4} maxW="600px" mx="auto">
      <Heading mb={4}>Personal Assistant</Heading>
      <Text mb={4}>Day {memories.length + 1}</Text>
      <Button onClick={runAction} isLoading={loadingAction} mb={6}>
        Generate Next Action
      </Button>

      {bestSuggestion && (
        <Box mb={6} p={4} borderRadius="md">
          <Heading size="sm" mb={2}>
            Current Objective
          </Heading>
          <Text>{bestSuggestion}</Text>
        </Box>
      )}

      {recipes.length > 0 && (
        <Box>
          <Heading size="sm" mb={2}>
            Meal Ideas
          </Heading>
          <Stack spacing={4}>
            {recipes.map((r, i) => (
              <Card key={i} borderRadius="lg" boxShadow="md">
                <CardHeader>
                  <Heading size="md">{r.name}</Heading>
                </CardHeader>
                <CardBody>
                  <Text>{r.description}</Text>
                  <br />
                  <Text fontSize="sm">{r.ingredients}</Text>
                  <br />
                  <Text fontSize="sm" border="1px solid teal" padding="6">
                    {r.nutritionalAnalysis}
                  </Text>
                </CardBody>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
};
