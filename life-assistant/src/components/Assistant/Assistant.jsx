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
  Select,
  VStack,
  HStack,
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
import EmotionTracker from "../EmotionTracker/EmotionTracker";
import SleepCycleCalculator from "../SleepCycleCalculator/SleepCycleCalculator";
import { PlanResult } from "../PlanResult/PlanResult";
import MealIdeas from "../MealIdeas/MealIdeas";

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

export const Assistant = () => {
  const [userDoc, setUserDoc] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingMemories, setLoadingMemories] = useState(true);
  const [memories, setMemories] = useState([]);

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingMeals, setLoadingMeals] = useState(false);

  const [bestSuggestion, setBestSuggestion] = useState("");
  const [recipes, setRecipes] = useState([]);

  // Sleep UI state
  const [showSleepUI, setShowSleepUI] = useState(false);
  const [sleepHour, setSleepHour] = useState("10");
  const [sleepMinute, setSleepMinute] = useState("00");
  const [sleepAmPm, setSleepAmPm] = useState("PM");
  const [cycles, setCycles] = useState([]);

  const [showEmotionUI, setShowEmotionUI] = useState(false);

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
      const memRef = collection(
        database,
        "users",
        localStorage.getItem("local_npub"),
        "memories"
      );
      const q = query(memRef, orderBy("dayNumber"));
      const memSnap = await getDocs(q);
      setMemories(memSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingMemories(false);
    })();
  }, [userDoc]);

  // Calculate cycles based on a start Date
  const calculateCycles = (startDate) => {
    const newCycles = [];
    const onsetOffset = 14 * 60000; // 14 minutes to fall asleep
    for (let i = 1; i <= 6; i++) {
      const cycleDate = new Date(
        startDate.getTime() + onsetOffset + 90 * 60000 * i
      );
      newCycles.push(
        cycleDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      );
    }
    setCycles(newCycles);
  };

  // Auto-calculate when selects change
  useEffect(() => {
    const h = parseInt(sleepHour, 10) % 12;
    let hour24 = h + (sleepAmPm === "PM" ? 12 : 0);
    if (sleepHour === "12" && sleepAmPm === "AM") hour24 = 0;
    const now = new Date();
    let base = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour24,
      parseInt(sleepMinute, 10)
    );
    if (base < now) base.setDate(base.getDate() + 1);
    calculateCycles(base);
  }, [sleepHour, sleepMinute, sleepAmPm]);

  const handleSleepNow = () => {
    const now = new Date();
    const h12 = now.getHours() % 12 || 12;
    setSleepHour(String(h12));
    setSleepMinute(now.getMinutes().toString().padStart(2, "0"));
    setSleepAmPm(now.getHours() >= 12 ? "PM" : "AM");
    calculateCycles(now);
  };

  const generatePlan = async () => {
    setShowSleepUI(false);
    setShowEmotionUI(false);
    setRecipes([]);
    if (!userDoc) return;
    setLoadingPlan(true);
    setBestSuggestion("");
    try {
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

    Return JSON with a single key "bestSuggestion" (a concise strategic move for Day ${dayNumber}).`;
      let raw = "";
      const stream = await model.generateContentStream(prompt);
      for await (const chunk of stream.stream) {
        raw += chunk.text();
      }
      const { bestSuggestion: bs } = JSON.parse(raw);
      setBestSuggestion(bs);

      const memRef = collection(
        database,
        "users",
        localStorage.getItem("local_npub"),
        "memories"
      );
      await addDoc(memRef, {
        dayNumber,
        suggestion: bs,
        recipes: [],
        timestamp: serverTimestamp(),
      });
      setMemories((prev) => [
        ...prev,
        { dayNumber, suggestion: bs, recipes: [] },
      ]);
    } catch (err) {
      console.error("Plan error:", err);
    }
    setLoadingPlan(false);
  };

  const generateMeals = async () => {
    setShowSleepUI(false);
    setShowEmotionUI(false);
    setBestSuggestion("");
    if (!userDoc) return;
    setLoadingMeals(true);
    setRecipes([]);
    try {
      const prompt = `
    Generate a JSON with a single key "recipes": an array of 5 meal ideas. Each item should include:
    - name
    - description
    - ingredients
    - nutritionalAnalysis (vitamin, macro, health gains, and how it helps health).`;
      let raw = "";
      const stream = await model.generateContentStream(prompt);
      for await (const chunk of stream.stream) {
        raw += chunk.text();
      }
      const { recipes: rs } = JSON.parse(raw);
      setRecipes(rs);
    } catch (err) {
      console.error("Meals error:", err);
    }
    setLoadingMeals(false);
  };

  if (loadingUser || loadingMemories) {
    return (
      <Box p={4} textAlign="center">
        <Spinner />
      </Box>
    );
  }

  return (
    <Box p={4} maxW="600px" mx="auto" mt={24}>
      <Heading mb={4}>Personal Assistant (Day {memories.length + 1})</Heading>
      <HStack flexWrap="wrap" spacing={2} mb={6}>
        <Button
          onClick={generatePlan}
          isLoading={loadingPlan}
          p={{ base: 4, md: 8 }}
        >
          Create Daily Plan
        </Button>

        <Button
          onClick={generateMeals}
          isLoading={loadingMeals}
          p={{ base: 4, md: 8 }}
        >
          Generate Meals
        </Button>

        <Button
          onClick={() => {
            setShowSleepUI(true);
            setBestSuggestion("");
            setShowEmotionUI(false);
            setRecipes([]);
          }}
          p={{ base: 4, md: 8 }}
        >
          Sleep Cycles
        </Button>

        <Button
          onClick={() => {
            setShowEmotionUI(true);
            setBestSuggestion("");
            setShowSleepUI(false);
            setRecipes([]);
          }}
          p={{ base: 4, md: 8 }}
        >
          Emotion Tracker
        </Button>
      </HStack>

      {showEmotionUI ? <EmotionTracker visible={showEmotionUI} /> : null}
      {bestSuggestion && (
        <PlanResult bestSuggestion={bestSuggestion} memories={memories} />
      )}

      {/* Sleep Cycle UI */}
      {showSleepUI && (
        <SleepCycleCalculator
          sleepHour={sleepHour}
          sleepMinute={sleepMinute}
          sleepAmPm={sleepAmPm}
          setSleepHour={setSleepHour}
          setSleepMinute={setSleepMinute}
          setSleepAmPm={setSleepAmPm}
          handleSleepNow={handleSleepNow}
          cycles={cycles}
        />
      )}

      {recipes.length > 0 && <MealIdeas recipes={recipes} />}
    </Box>
  );
};
