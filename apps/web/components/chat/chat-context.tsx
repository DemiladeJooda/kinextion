"use client";

import { createContext, useContext } from "react";

export type GuideId = "altheo" | "kairo";

export type OpenChat = (guide?: GuideId) => void;

export const ChatContext = createContext<OpenChat>(() => {});

/** Opens the guide conversation from anywhere on the site. */
export function useOpenChat(): OpenChat {
  return useContext(ChatContext);
}
