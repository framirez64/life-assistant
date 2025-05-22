import React from "react";
import { Box, Heading, Text } from "@chakra-ui/react";

export const PlanResult = ({ bestSuggestion }) => (
  <Box mb={6} p={4} borderRadius="md">
    <Heading size="sm" mb={2}>
      Current Objective
    </Heading>
    <Text>{bestSuggestion}</Text>
  </Box>
);
