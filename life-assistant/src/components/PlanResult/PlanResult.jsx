import React from "react";
import { Box, Heading, Text, VStack } from "@chakra-ui/react";

export const PlanResult = ({ bestSuggestion, memories }) => (
  <Box mb={6} p={4} borderRadius="md" borderWidth="1px">
    <Heading size="sm" mb={2}>
      Current Objective
    </Heading>
    <Text mb={4}>{bestSuggestion}</Text>
    <Heading size="sm" mb={2}>
      Memories
    </Heading>
    <VStack align="start" spacing={3}>
      {memories.map((m) => (
        <Box key={m.id}>
          <Text fontWeight="bold">Day {m.dayNumber}</Text>
          <Text>{m.suggestion}</Text>
        </Box>
      ))}
    </VStack>
  </Box>
);
