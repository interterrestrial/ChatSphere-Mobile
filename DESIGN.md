---
name: ChatSphere
description: Cool paper, dark ink, and cobalt for direct conversations
colors:
  paper: "#f4f5f8"
  surface: "#ffffff"
  raised: "#edf0f5"
  ink: "#161d31"
  secondary: "#46516a"
  muted: "#626d82"
  rule: "#dbe0ea"
  cobalt: "#2947c6"
  cobalt-soft: "#eaf0ff"
  cobalt-ink: "#203caa"
  error: "#a33240"
  rule-hover: "#b9c4da"
  selected-rule: "#d9e2fc"
  suggestion-rule: "#d7e1ff"
  preview-paper: "#edf1fc"
  preview-rule: "#cbd6ee"
  brand-detail: "#c7d4ff"
  avatar-default: "#e9edf4"
  avatar-default-ink: "#435476"
  avatar-indigo: "#e4eaff"
  avatar-indigo-ink: "#3249a2"
  avatar-sand: "#eee8df"
  avatar-sand-ink: "#6b5332"
  avatar-spruce: "#e2ede8"
  avatar-spruce-ink: "#355a4b"
  avatar-clay: "#f2e6e6"
  avatar-clay-ink: "#774654"
typography:
  body:
    fontFamily: "Aptos, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
  time: { fontSize: "11px", lineHeight: "16px" }
  caption: { fontSize: "12px", lineHeight: "16px" }
  secondary: { fontSize: "13px", lineHeight: "20px" }
  control: { fontSize: "14px", lineHeight: "20px" }
  input: { fontSize: "16px", lineHeight: "20px" }
  mobile-heading: { fontSize: "17px", lineHeight: "24px" }
  thread-heading: { fontSize: "19px", lineHeight: "24px" }
  dialog-heading: { fontSize: "22px" }
  empty-heading: { fontSize: "24px" }
  inbox-heading: { fontSize: "32px", lineHeight: "40px" }
  sign-in-heading: { fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 600 }
  preview-heading: { fontSize: "clamp(36px, 4.8vw, 64px)", fontWeight: 500 }
rounded:
  mark-detail: "2px"
  compact: "4px"
  indicator: "50%"
  control: "8px"
  message: "12px"
  panel: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
---

## Overview

ChatSphere is a direct-message inbox. It should feel calm, precise, and conversational. The conversation is the focal point. The sign-in screen previews a short thread and a reply suggestion.

## Colors

Use cool paper for the reading area, white for controls and incoming messages, and a light rule between sections. Cobalt marks sending, selected actions, and outgoing messages. Keep timestamps and usernames quieter than the message text.

## Typography

Use system sans type, sentence case, and tabular figures for times. Names and controls use medium or semibold weight. Let message text and line spacing carry the thread.

## Layout

A conversation index pairs with a broad reading area on desktop. At 680px and below, the inbox and thread occupy separate screens. Keep the composer visible while the transcript scrolls. Use a 4px spacing rhythm.

## Components

Reply suggestions sit next to the draft. Choosing a suggestion puts it in the composer for editing. Summaries open beneath the thread header. Use visible keyboard focus and text labels for controls. Keep transitions brief and honor reduced motion.

Design review used [Unslop by Damir Sokolovsky](https://heydamir.design/unslop) and Impeccable.
