// src/theme.js
import { extendTheme } from "@chakra-ui/react";

const config = {
  initialColorMode: "light", // or "dark" or "system"
  useSystemColorMode: false, // if true, will follow OS setting
};

export const theme = extendTheme({ config });
