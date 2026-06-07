"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useState } from "react";

export function NavAuthButtons() {
  const [signInHovered, setSignInHovered] = useState(false);
  const [signUpHovered, setSignUpHovered] = useState(false);

  return (
    <>
      <SignInButton mode="modal">
        <button
          onMouseEnter={() => setSignInHovered(true)}
          onMouseLeave={() => setSignInHovered(false)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "6px 12px", borderRadius: 99, fontSize: 13, fontWeight: 600,
            color: signInHovered ? "var(--wc-text-1)" : "var(--wc-text-2)",
            transition: "color 0.15s",
          }}
        >
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button
          onMouseEnter={() => setSignUpHovered(true)}
          onMouseLeave={() => setSignUpHovered(false)}
          style={{
            background: "var(--wc-green)", border: "none", cursor: "pointer",
            padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700,
            color: "#000", opacity: signUpHovered ? 0.88 : 1,
            transition: "opacity 0.15s",
          }}
        >
          Sign up
        </button>
      </SignUpButton>
    </>
  );
}
