import React, { useEffect, useState } from "react";
import { Box, Button } from "@chakra-ui/react";
import { useNavigate, useParams } from "react-router-dom";
import { updateUser } from "../../firebaseResources/store";

export const Onboarding = () => {
  const navigate = useNavigate();
  return (
    <Box>
      Onboarding Page
      <Button
        onClick={() => {
          updateUser(localStorage.getItem("local_npub"), { step: "assistant" });
          navigate("/assistant");
        }}
      >
        Finish Onboarding
      </Button>
    </Box>
  );
};
