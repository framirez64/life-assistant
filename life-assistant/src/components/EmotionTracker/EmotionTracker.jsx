import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Textarea,
  Spinner,
} from "@chakra-ui/react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { database } from "../../firebaseResources/config";
import { getGenerativeModel } from "@firebase/vertexai";
import { vertexAI } from "../../firebaseResources/config";
import {
  formatEmotionItem,
  customInstructions,
  emotionSummarizer,
} from "./EmotionTracker.compute";
import { highEnergyFeelings, lowEnergyFeelings } from "./EmotionTracker.data";

// Initialize AI model
const aiModel = getGenerativeModel(vertexAI, {
  model: "gemini-2.0-flash",
  //   generationConfig: {
  //     responseMimeType: "application/json",
  //     responseSchema,
  //   },
});

/**
 * Inline EmotionTracker component (not a modal)
 * Props:
 * - visible: boolean to show/hide tracker
 */
export default function EmotionTracker({ visible }) {
  const npub = localStorage.getItem("local_npub");
  const [emotions, setEmotions] = useState([]);
  const [loadingEmotions, setLoadingEmotions] = useState(true);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [advice, setAdvice] = useState("");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [summary, setSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Load existing emotions
  useEffect(() => {
    if (!visible) return;
    (async () => {
      setLoadingEmotions(true);
      const ref = collection(database, "users", npub, "emotions");
      const q = query(ref, orderBy("timestamp"));
      const snap = await getDocs(q);

      setEmotions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      setLoadingEmotions(false);
    })();
  }, [npub, visible]);

  const selectEmotion = (e) => {
    setSelected(formatEmotionItem(e, Date.now(), "timestamp"));
    setAdvice("");
    setNote("");
  };

  const generateInsight = async () => {
    setLoadingAdvice(true);
    setAdvice("");
    const prompt = customInstructions({
      emotionNote: note,
      selectedEmotion: selected,
    });
    let raw = "";
    const stream = await aiModel.generateContentStream(prompt);
    for await (const chunk of stream.stream) {
      raw += chunk.text();
    }
    setAdvice(raw);
    setLoadingAdvice(false);
  };

  const saveEmotion = async () => {
    const withAi = formatEmotionItem(selected, advice, "ai");
    const withNote = formatEmotionItem(withAi, note, "note");
    const ref = collection(database, "users", npub, "emotions");
    await addDoc(ref, { ...withNote, timestamp: serverTimestamp() });
    // reload list
    const q = query(ref, orderBy("timestamp"));
    const snap = await getDocs(q);
    setEmotions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setSelected(null);
    setNote("");
    setAdvice("");
  };

  const generateSummary = async () => {
    setLoadingSummary(true);
    setSummary("");
    const prompt = emotionSummarizer(JSON.stringify(emotions));
    let raw = "";
    const stream = await aiModel.generateContentStream(prompt);
    for await (const chunk of stream.stream) {
      raw += chunk.text();
    }
    setSummary(raw);
    setLoadingSummary(false);
  };

  if (!visible) return null;

  console.log("emotions", emotions);
  return (
    <Box p={4} borderWidth="1px" borderRadius="md" mb={6}>
      <VStack align="stretch" spacing={4}>
        <Text fontSize="lg" fontWeight="bold">
          Emotion Tracker
        </Text>

        {/* Emotion selection */}
        {loadingEmotions ? (
          <Spinner />
        ) : (
          <Box wrap="wrap" spacing={2}>
            <Text fontWeight={"bold"}>High Energy</Text>

            {highEnergyFeelings.map((e) => (
              <Button
                m={2}
                width="150px"
                height="150px"
                key={e.label}
                bg={e.color}
                _hover={{ bg: e.colorHover }}
                onClick={() => selectEmotion(e)}
              >
                {e.emoji}
                <br /> {e.label}
              </Button>
            ))}
            <br />
            <br />
            <Text fontWeight={"bold"}> Low Energy</Text>

            {lowEnergyFeelings.map((e) => (
              <Button
                m={2}
                width="150px"
                height="150px"
                key={e.label}
                bg={e.color}
                _hover={{ bg: e.colorHover }}
                onClick={() => selectEmotion(e)}
              >
                {e.emoji} <br />
                {e.label}
              </Button>
            ))}
          </Box>
        )}

        {/* Add note and get insight */}
        {selected && (
          <VStack align="stretch" spacing={2}>
            <Text>
              <strong>Selected:</strong> {selected.emoji} {selected.label}
            </Text>
            <Textarea
              placeholder="Add a note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button onClick={generateInsight} isLoading={loadingAdvice}>
              💭 Generate Insight
            </Button>
            {advice ? <Box>{advice}</Box> : null}
            <Button
              colorScheme="blue"
              onClick={saveEmotion}
              isDisabled={!advice && !note}
            >
              Save Emotion
            </Button>
          </VStack>
        )}

        {/* Journey summary */}
        <VStack
          align="stretch"
          spacing={2}
          pt={4}
          borderTop="1px solid"
          borderColor="gray.200"
        >
          <HStack justify="space-between">
            <Text fontSize="md" fontWeight="semibold">
              Review Your Journey
            </Text>
            <Button size="sm" onClick={generateSummary}>
              🔍 Summarize
            </Button>
          </HStack>
          {loadingSummary ? <Spinner /> : summary ? <Box>{summary}</Box> : null}
        </VStack>

        {emotions
          .map((em) => (
            <Box key={em.id} p={3} borderWidth="1px" borderRadius="md">
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Text fontSize="xl">{em.emoji}</Text>
                  <Text fontSize="md" fontWeight="semibold">
                    {em.label}
                  </Text>
                </HStack>
                {em.timestamp?.toDate && (
                  <Text fontSize="sm" color="gray.500">
                    {em.timestamp.toDate().toLocaleString()}
                  </Text>
                )}
              </HStack>
              {em.note && (
                <Text mt={2} fontStyle="italic">
                  {em.note}
                </Text>
              )}
              {em.ai && (
                <Box mt={2} p={2} borderRadius="md">
                  {em.ai}
                </Box>
              )}
            </Box>
          ))
          .reverse()}
      </VStack>
    </Box>
  );
}
