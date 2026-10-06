---
id: repo:localme/cross-cutting/culture
parent: repo:localme/cross-cutting
title: Culture Layer
level: repo
kind: cross-cutting
applies_to: [repo:localme]
domains:
  - culture
keywords:
  - fa-ir
  - en-us
  - jalali
  - shamsi
  - rtl
---

# Culture Layer

LocalMe ships with two first-class cultures: `fa-IR` and `en-US`.

## Core Mechanisms
- **Direction & Styling:** `fa-IR` enables right-to-left layout and specific typefaces (Iransans, Vazir).
- **Calendar:** The Shamsi (Jalali) calendar is natively computed via `lib/jalali.ts` (not re-skinned).
- **Translations:** Wording is entirely runtime-editable. Overrides are written to the `translations` table and survive deployments. Resolution goes from Override → Shipped Catalog → Key. Missing keys produce build errors.
- **Numbers & Dates:** All numerals and byte counts are formatted locally (e.g., Persian or Arabic-Indic digits) via `lib/i18n/format.ts`.

Both cultures are available everywhere in the platform, ensuring full operator and user accessibility.
