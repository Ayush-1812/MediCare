# Phase 3 — Multilingual Support, Verified and Limited

**Branch:** `voice-agent` · **Verified:** 2026-10-15 · **Model:** `gemini-3.8-live`

Everything claimed here was executed. The limitations section is as important as the support matrix: the requirement is never to imply a language works when it does not, and that cuts both ways — the voice layer and the written layer have different coverage, and this document says where.

---

## 1. What MediCare already had

The brief asks to reuse the languages the app already supports. Inspected first:

| Finding | Detail |
|---|---|
| The only language concept in the app | `Doctor.languages` — a **free-text** column, offered with the placeholder `e.g. English, Hindi`, written by `addDoctor` / `completeDoctorOnboarding` / `updateDoctorProfile`, and searched as plain text in `DoctorsDirectory` |
| No i18n framework | Zero i18n libraries. The only `locale` references in `src/` are 12 `toLocaleDateString` / `toLocaleTimeString` calls |
| Actual data (read-only query against the configured database) | **13 doctors. 10 have no languages recorded at all.** The populated values are `English` ×3, `HIndi` ×2, `Hindi` ×1 |

Two consequences, both acted on:

1. **English and Hindi are MediCare's real languages** — which is exactly the brief's stated minimum. Everything beyond that is an extension, documented below.
2. **`HIndi` is misspelled in live data, and 77% of doctors have nothing recorded.** The `search_doctors` tool therefore matches languages case-insensitively (so `HIndi` still matches "hindi"), and the system prompt instructs the assistant that an empty field means *"not listed"* — never to assume a doctor speaks the patient's language. Claiming otherwise would send someone to a consultation they cannot hold.

---

## 2. Spoken language support — verified

`npm run verify:voice:languages` opens a real Live session per language, asks a question written in that language, and requires: setup accepted, ≥0.5 s of real audio, a transcript returned, and **the transcript in the script that language is actually written in**. That last check is what catches "accepted the language code and answered in English", which is the silent failure that would make the picker a lie.

**12/12 passed**, including the code-switching probe.

| Language | Code | Script | Audio | Verified reply |
|---|---|---|---|---|
| English (India) | `en-IN` | Latin | 3.9 s | "I can help you schedule appointments…" |
| **Hindi** | `hi-IN` | Devanagari | 3.3 s | "मैं आपकी डॉक्टर से अपॉइंटमेंट बुक करने में मदद कर सकता हूँ।" |
| Bengali | `bn-IN` | Bengali | 4.5 s | "আমি আপনাকে ডাক্তার দেখাতে বা অ্যাপয়েন্টমেন্ট বুক করতে সাহায্য করতে পারি।" |
| Tamil | `ta-IN` | Tamil | 3.4 s | "நான் உங்களுக்கு மருத்துவ சந்திப்பை பதிவு செய்ய உதவ முடியும்." |
| Telugu | `te-IN` | Telugu | 3.8 s | "నేను మీకు డాక్టర్ అపాయింట్‌మెంట్ బుక్ చేయడంలో సహాయం చేయగలను." |
| Marathi | `mr-IN` | Devanagari | 3.7 s | "मी तुम्हाला डॉक्टरांची भेट निश्चित करण्यात मदत करू शकतो." |
| Gujarati | `gu-IN` | Gujarati | 3.9 s | "હું તમને ડૉક્ટર સાથે એપોઇન્ટમેન્ટ બુક કરવામાં મદદ કરી શકું છું." |
| Kannada | `kn-IN` | Kannada | 3.7 s | "ನಾನು ನಿಮಗೆ ವೈದ್ಯರ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಕಾಯ್ದರಿಸಲು ಸಹಾಯ ಮಾಡಬಹುದು." |
| Malayalam | `ml-IN` | Malayalam | 3.2 s | "ഡോക്ടറെ കാണാൻ അപ്പോയിന്റ്മെന്റ് എടുക്കാൻ ഞാൻ നിങ്ങളെ സഹായിക്കാം." |
| Punjabi | `pa-IN` | Gurmukhi | 3.3 s | "ਮੈਂ ਤੁਹਾਡੀ ਡਾਕਟਰ ਨਾਲ ਮੁਲਾਕਾਤ ਤਹਿ ਕਰਨ ਵਿੱਚ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ।" |
| English (US) | `en-US` | Latin | 3.7 s | "I can help you schedule appointments…" |

### Hindi–English code-switching

The decisive case for this app, and the reason Phase 2 chose native speech-to-speech over an STT pipeline. Latin-script Hinglish in, Hinglish out:

> **User:** "Mujhe kal shaam Dr Mehta ke saath appointment chahiye, kya slot available hai?"
> **Aether:** "Main abhi Dr. Mehta ki kal shaam ki availability check karta hoon."

No language switch was requested or announced — it simply matched the register.

---

## 3. Interface localization

`npm run check:voice:i18n` — **50 strings × 11 languages, all at 100%.**

Labels, state lines, button text, error messages and tool activity lines are all localized. A panel that speaks Tamil while its buttons read English tells the user their language is a gimmick rather than a supported language, so both layers move together.

Errors are localized **by code, not by text**: the gateway sends a machine-readable code and the client resolves the wording from the catalog, so a failure message appears in the language the patient is speaking rather than in the gateway's English.

---

## 4. Conversation behaviour — verified

`npm run verify:voice:behaviour` tests the shipped prompt (it imports `buildSystemInstruction` directly rather than a copy). **7/7 scenarios passed.** Selected observed output:

| Requirement | Observed |
|---|---|
| Match the user's language | Hindi question → fully Devanagari reply |
| **Preserve exact entities** | In that Devanagari reply: *"आपका अगला अपॉइंटमेंट **Dr Mehta** के साथ…"* — the name stayed in Latin script, untranslated and untransliterated |
| Preserve doses exactly | *"Pantoprazole 40 mg hai jo aapko once daily leni hai"* |
| Resolve "kal shaam" | Offered the three real evening slots and asked which — did **not** book |
| Clarify ambiguity | "Kal ka appointment confirm karo" → *"appointment kal nahi, balki Sunday, the eighteenth of October ko…"* — corrected the premise, then asked |
| Confirm with full date + timezone | *"Dr Mehta on Friday, the sixteenth of October, at five thirty in the afternoon, India Standard Time, with a fee of six hundred rupees. Shall I book it?"* |
| Never imply an unsupported language works | French → *"I cannot speak French properly. I can assist you in English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, or Punjabi."* |

**A real gap this found and closed:** the timezone appeared in confirmations only intermittently. The rule is now an explicit four-part checklist (weekday, date, exact time, named timezone) with an explanation of why the timezone is stated even when it feels redundant. Three consecutive runs afterwards all included "India Standard Time".

---

## 5. Limitations

Stated plainly. Each is a real constraint, not a disclaimer.

| # | Limitation | Impact | Why it stands |
|---|---|---|---|
| 1 | **Translations are model-authored and have not been reviewed by native speakers.** Recorded in the header of `i18n.generated.ts` | Wording may be stiff or subtly wrong in the eight languages beyond English and Hindi | Strings invented by someone who does not read Kannada are worse than useless because they look finished. A correction from a speaker of the language is authoritative and edits the value in place |
| 2 | **Script detection cannot separate languages that share a script.** Hindi and Marathi are both Devanagari | Auto-detection cannot tell them apart | So it never switches silently. It *offers* a switch, and only when the script does not match the current selection at all. The model's own spoken-language following is unaffected and does the real work |
| 3 | **Spoken-language detection belongs to the provider, not to us** | We cannot tune or guarantee it | The prompt instructs the assistant to follow the patient, and §4 confirms it does. But there is no local override if it mishears a language |
| 4 | **Language switch replays text, not audio** | The new session knows what was *said* but not how it sounded | `speechConfig.languageCode` is fixed at session setup, so a switch needs a new session. Resumption handles belong to the old config, so a capped text history is replayed with `turnComplete: false` instead. Task context survives; prosody does not |
| 5 | **`Doctor.languages` is unreliable** — free text, 10 of 13 blank, one value misspelled `HIndi` | The assistant usually cannot say which languages a doctor speaks | Search matches case-insensitively; the prompt requires saying "not listed" rather than guessing. Fixing this properly means making the field structured, which is a change to the doctor onboarding form and outside this feature |
| 6 | **A name may be transcribed in either script** | The transcript pane may show "डॉ मेहता" where the audio said "Dr Mehta" | This is a transcription artefact, not a translation failure — the spoken audio preserves the name. Worth knowing before reading the transcript as evidence of a bug |
| 7 | **Occasional empty generation** — observed once in six runs of one scenario | A turn produces no audio and no transcript | Transient provider behaviour. The gateway degrades safely: no audio means no transition to "speaking", so the session stays listening and the patient can simply ask again. Not masked, not retried automatically |
| 8 | **`en-US` is offered but is effectively `en-IN`** | Redundant picker entry | Kept because it is a distinct verified `languageCode`; it mainly affects accent, not capability |
| 9 | **Only these 11 codes are offered.** The provider advertises ~70 languages | A speaker of an unlisted language cannot select it | Listing unverified languages is precisely the prohibited failure. The assistant declines unlisted languages honestly (§4) and names what it can do. Adding one is a verification run, not a code change |

---

## 6. Adding a language

1. Add the entry to `SUPPORTED_LANGUAGES` in `src/lib/voice/config.ts`, with its native name, English name and script.
2. Add it to `TARGETS` in `scripts/generate-voice-i18n.js` and run `npm run gen:voice:i18n`.
3. Run `npm run check:voice:i18n` — it must reach 90%.
4. Run `npm run verify:voice:languages <code>` — **it must pass before the language ships.** If it does not, remove the entry.

If the script does not already have a Unicode range in `SCRIPT_PATTERNS`, add it, and check whether it uses the danda `।` as punctuation — that character lives in the Devanagari block and has already caused one misclassification in this project.

## 7. Reproducing

```bash
npm run verify:voice:languages    # per-language, against the live provider
npm run verify:voice:behaviour    # conversation rules, using the shipped prompt
npm run check:voice:i18n          # interface coverage, no network needed
npm run gen:voice:i18n            # regenerate catalogs after changing a source string
```
