import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Text,
  Image,
  Stack,
} from "@chakra-ui/react";
import { getGenerativeModel } from "@firebase/vertexai";
import { vertexAI, Schema } from "../../firebaseResources/config";

// JSON schema expects a "color" field as a hex code for a thematic background
const jsonSchema = Schema.object({
  properties: {
    recipes: Schema.array({
      items: Schema.object({
        properties: {
          name: Schema.string(),
          description: Schema.string(),
          color: Schema.string(), // hex code, e.g. "#FF6347"
        },
        required: ["name", "description", "color"],
      }),
    }),
  },
  required: ["recipes"],
});

// Initialize the model in JSON mode
const model = getGenerativeModel(vertexAI, {
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: jsonSchema,
  },
});

// Helpers: hex <-> HSL conversion
const hexToHsl = (hex) => {
  const c = hex.replace(/^#/, "");
  const num = parseInt(c, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
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

// Compute analogous text color: shift hue by +30°, adjust lightness
const getAnalogousTextColor = (hex) => {
  const { h, s, l } = hexToHsl(hex);
  const newHue = (h + 30) % 360;
  // keep saturation, tweak lightness for readability
  const newL = l < 50 ? Math.min(l + 40, 90) : Math.max(l - 40, 10);
  return hslToHex({ h: newHue, s, l: newL });
};

export const Assistant = () => {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);

  const runThing = async () => {
    setLoading(true);
    let raw = "";
    const prompt = `
  Generate a JSON object with a top-level "recipes" array.
  Each item should have:
    • "name": the recipe’s name
    • "description": a brief tasty description
    • "color": a single hex code matching the food theme (e.g. #FF6347)
  Choose vibrant, thematic colors. Return valid JSON per schema.
      `.trim();

    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      raw += chunk.text();
    }
    try {
      const { recipes = [] } = JSON.parse(raw);
      setRecipes(recipes);
    } catch (err) {
      console.error("JSON parse error:", err, raw);
    }
    setLoading(false);
  };

  return (
    <Box p={4}>
      <Heading mb={4} size="lg">
        Healthy & Tasty Recipes
      </Heading>
      <Button onClick={runThing} isLoading={loading} mb={6}>
        Load Recipes
      </Button>
      <Stack spacing={4}>
        {recipes.map((recipe, idx) => {
          const textColor = getAnalogousTextColor(recipe.color);
          return (
            <Card
              key={idx}
              bg={recipe.color}
              color={textColor}
              borderRadius="lg"
              overflow="hidden"
              boxShadow="md"
            >
              <CardHeader>
                <Heading size="md">{recipe.name}</Heading>
              </CardHeader>
              <CardBody>
                <Text>{recipe.description}</Text>
              </CardBody>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
};
