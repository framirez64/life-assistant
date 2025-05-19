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
      <Stack direction="row" spacing={4} mb={6}>
        <Button onClick={generatePlan} isLoading={loadingPlan}>
          Create Daily Plan
        </Button>
        <Button onClick={generateMeals} isLoading={loadingMeals}>
          Generate Meals
        </Button>
        <Button onClick={() => setShowSleepUI((v) => !v)}>
          {showSleepUI ? "Close Sleep Cycles" : "Sleep Cycles"}
        </Button>
      </Stack>

      {bestSuggestion && (
        <Box mb={6} p={4} borderRadius="md">
          <Heading size="sm" mb={2}>
            Current Objective
          </Heading>
          <Text>{bestSuggestion}</Text>
        </Box>
      )}
      {/* Sleep Cycle UI */}
      {showSleepUI && (
        <Box mb={6} p={4} borderWidth="1px" borderRadius="md">
          <Heading size="sm" mb={2}>
            Sleep Cycle Calculator
          </Heading>
          <Text mb={3} fontSize="md" lineHeight="tall">
            A sleep cycle is a roughly 90‑minute period during which your brain
            and body progress through different stages of sleep, including light
            sleep, deep sleep, and REM (dream) sleep. Completing full cycles
            helps you wake up feeling refreshed, reducing grogginess and
            improving cognitive performance.
          </Text>
          <Text fontSize="md" lineHeight="tall" mb={4}>
            By timing your bedtime and wake‑up moments to coincide with the end
            of a sleep cycle, you can optimize rest and alertness. Aim for 4–6
            cycles per night (6–9 hours total) for most adults to maintain
            healthy sleep hygiene.
          </Text>

          <Text fontSize="sm" fontWeight="bold" lineHeight="tall">
            Plan accordingly! It takes the average person 14 minutes to fall
            asleep and is included in the cycles below.Typically, people fall
            asleep between 10-20 minutes. Find what works best for you!
          </Text>
          <br />
          <Stack direction="row" spacing={2} align="center" mb={4}>
            <Select
              width="80px"
              value={sleepHour}
              onChange={(e) => setSleepHour(e.target.value)}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={String(h)}>
                  {h}
                </option>
              ))}
            </Select>
            <Select
              width="80px"
              value={sleepMinute}
              onChange={(e) => setSleepMinute(e.target.value)}
            >
              {Array.from({ length: 60 }, (_, i) => i)
                .map((m) => m.toString().padStart(2, "0"))
                .map((mm) => (
                  <option key={mm} value={mm}>
                    {mm}
                  </option>
                ))}
            </Select>
            <Select
              width="90px"
              value={sleepAmPm}
              onChange={(e) => setSleepAmPm(e.target.value)}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </Select>
            <Button onClick={handleSleepNow}>Sleep now</Button>
          </Stack>
          {cycles.length > 0 && (
            <Box mt={6}>
              {cycles.map((time, idx) => {
                // Calculate color shade: 300, 500, 700
                const shade = 100 + (idx % 3) * 100;
                const color = idx < 3 ? `purple.${shade}` : `green.${shade}`;
                return (
                  <Box
                    key={idx}
                    mb={4}
                    borderLeft="4px solid"
                    borderColor={color}
                    pl={3}
                  >
                    <Text fontSize="md" fontWeight="bold" color={color}>
                      Cycle {idx + 1}
                    </Text>
                    <Text fontSize="sm">{time}</Text>
                  </Box>
                );
              })}
            </Box>
          )}
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
                  <Text fontSize="sm" border="1px solid teal" p={6}>
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
