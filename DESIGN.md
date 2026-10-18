---
name: PitchDrill
description: A study hall for selling. Watch a two-minute round, then play one.
colors:
  ground: "#F7F7F5"
  panel: "#FFFFFF"
  line: "#E6E8EB"
  line-soft: "#EEF0F2"
  field: "#D5D9DE"
  chip: "#EEF0EE"
  ink: "#1C1F24"
  muted: "#5B6270"
  green: "#2F6E50"
  green-deep: "#1F5A3F"
  green-tint: "#E7F1EC"
  sand: "#F1EDE4"
  sand-ink: "#5E4511"
  seller: "#DCE4EE"
  seller-ink: "#34506F"
  buyer: "#EFE6D2"
  buyer-ink: "#6B4E12"
  live: "#B42318"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 4vw, 2.125rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  numeral:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 1.25
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.2
    fontFeature: "\"tnum\""
  item:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  body-small:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
  button:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  panel: "16px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  row: "18px"
  gutter: "20px"
  panel: "22px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.panel}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-primary-hover:
    backgroundColor: "{colors.green-deep}"
  button-outlined:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "40px"
  button-row-selected:
    backgroundColor: "{colors.green}"
    textColor: "{colors.panel}"
  day-tab:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  day-tab-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.panel}"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  tint-card:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.green-deep}"
    rounded: "{rounded.lg}"
    padding: "16px"
  role-choice:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  input-text:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  nav-link:
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  nav-link-hover:
    backgroundColor: "{colors.chip}"
    textColor: "{colors.ink}"
  step-number:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.green-deep}"
    size: "30px"
  verdict-sold:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.green-deep}"
  verdict-not-sold:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.sand-ink}"
---

# Design System: PitchDrill

## Overview

**Creative North Star: "The Study Hall"**

PitchDrill is a quiet place to learn selling, built like an online chess archive: a light grey ground, white panels drawn with hairlines, near-black ink, and one deep green that means "act" and "Sold". Watching and playing get equal weight, so the home sits as two panels side by side (Watch at 7 parts, Play at 5) above a slot list and a numbered explainer. Nothing performs. The tension of the round lives in the rounds themselves, not in the chrome around them.

Density is medium and calm: generous panel padding, list rows split by soft hairlines, a single sans (Manrope) at heavy weights for anything you need to find fast (times, headings, the next start) and regular weight for reading. Numbers are tabular everywhere so clocks and times never jitter. Motion is limited to short state transitions (160ms) and a 1px press; reduced motion turns it off.

This system replaces the shopping-channel broadcast identity, which the product rejected as sales-y. Saturated studio fields, condensed capitals, straps and price bursts are not part of this world.

**Key Characteristics:**
- Light grey ground, white hairline panels, 16px panel corners.
- One green for actions, selection and "Sold"; everything else is ink, muted grey or a pale tint.
- Manrope only, heavy for scanning, regular for reading, tabular numerals throughout.
- Flat: depth is the ground-to-panel step and 1px lines, never shadows.
- Status is never carried by color alone (LIVE is red text plus a dot; selection changes label text too).

## Colors

A near-neutral cool-grey hall with one deep green voice and a few pale tints reserved for roles and verdicts.

### Primary
- **Study Green** (green): primary buttons, the selected slot's Book button, the "60" mark, links, focus ring, caret and `accent-color`. Also the "Sold" verdict's color family.
- **Deep Study Green** (green-deep): text on the green tint (your slot, starts-in countdown, booked confirmation, step numbers, selected row status) and the primary button's pressed/hover depth.
- **Green Wash** (green-tint): the selected slot row, the "Your slot" and "You're booked" cards, step-number discs, text selection, and the Sold verdict chip.

### Secondary
- **Sand** (sand) with **Sand Ink** (sand-ink): the "Not sold" verdict chip. A warm, neutral counterweight to green so neither verdict reads as failure. Specified by the approved mockup; not yet rendered in the build.
- **Seller Slate** (seller) with **Seller Ink** (seller-ink): the seller half of a round thumbnail (initials on slate-blue). Mockup-specified, not yet rendered.
- **Buyer Sand** (buyer) with **Buyer Ink** (buyer-ink): the buyer half of a round thumbnail. Mockup-specified, not yet rendered.

### Tertiary
- **Signal Red** (live): the LIVE marker (text plus a dot) and form errors (it is the MUI `error` color). Never a fill, never decoration.

### Neutral
- **Hall Grey** (ground): page background, scrollbar track.
- **Panel White** (panel): panels, header, inputs, unselected controls; also the text color on green and ink fills.
- **Ink** (ink): body text, headings, the selected day tab fill, hover outline on controls.
- **Muted Slate** (muted): secondary copy, helper text, nav links at rest, slot status text.
- **Hairline** (line): panel borders, header bottom border, dividers.
- **Soft Hairline** (line-soft): dividers between rows inside a panel.
- **Field Line** (field): input borders, outlined control borders, the dashed empty-state border, scrollbar thumb.
- **Chip Grey** (chip): hover fill behind header nav links.

### Named Rules
**The One Green Rule.** Green is the only saturated color at rest. It marks what you can do (book, copy, select) and the Sold verdict, and nothing else.

**The Not-Color-Alone Rule.** Every status carries text or shape as well as color: LIVE is red text with a dot, the selected slot's button reads "Selected", the chosen role gets a 2px ring.

## Typography

**Display Font:** Manrope (with system-ui, sans-serif), loaded through next/font as `--font-manrope`
**Body Font:** Manrope

**Character:** One geometric-humanist sans doing everything. Weight does the hierarchy: 800 for headings and times, 700 for labels and buttons, 400 for reading. Tabular numerals are set on `body`, so every time and countdown aligns.

### Hierarchy
- **Display** (800, clamp(1.625rem, 4vw, 2.125rem), 1.15, -0.02em): the one page headline, balanced wrap.
- **Numeral** (800, 36px phone / 44px desktop, 1.1, -0.02em): the next-round time in the Watch empty state. The biggest type on the page is a time, not a slogan.
- **Headline** (800, 1.375rem, 1.25): panel and section headings (Watch, Play, Upcoming slots, How a round runs).
- **Title** (800, 26px, 1.2): the chosen slot in the Play panel; 20px for "You're booked"; 18px for times in slot rows.
- **Item** (700 to 800, 15px): step titles, role names, nav links (600).
- **Body** (400, 1.0625rem, 1.55): lead copy (15px on phone, 17px desktop). Keep to about 38 to 65ch.
- **Body Small** (400, 0.875rem, 1.5): helper and footnote copy, always in muted.
- **Label** (700, 14px, sentence case): form legends and labels, day tabs, row buttons. 13px for sub-labels such as "Your slot" and role descriptions.
- **Button** (700, 0.9375rem, no text transform); the main booking button is 800 at 16px.

### Named Rules
**The Sentence Case Rule.** No uppercase, no tracking-out, no condensed faces. Labels and buttons read like sentences.

**The Time Is the Hero Rule.** When something should be big, make it a time or countdown in tabular Manrope 800.

## Layout

A centered column, max 1200px, with 16px side padding on phone and 24px from `sm` up. Vertical rhythm between major blocks is 32px on phone and 40px on desktop; within a panel, 18px between groups.

Two-panel rows are flex-wrap rows with a 20px gap: the wide panel flexes `7 1 520px`, the narrow `5 1 340px`, so they sit 7:5 on desktop and stack naturally (wide first) when the row cannot hold both. No breakpoint-driven grid; the flex bases decide. The same 7:5 pairing repeats for Upcoming slots beside How a round runs.

Panels pad 16px on phone, 22px from `sm`. List rows pad 12px to 16px vertically and 18px horizontally. The sticky header is a 1200px row inside a full-width white bar; in-page anchors use `scroll-margin-top: 80px` to clear it.

## Elevation & Depth

Flat. There are no shadows anywhere: buttons use `disableElevation` and ripples are off. Depth is two steps only, Hall Grey ground and white panels, separated by 1px hairlines. Inset `box-shadow` is used solely as a layout-stable border (1px at rest, 2px selected) on custom controls; it never casts.

### Named Rules
**The Hairline Rule.** Separate with a 1px line or a ground-to-panel step. If something needs to feel raised, it is the wrong component.

## Shapes

Soft, consistent rounding that steps down as things nest: panels 16px, cards inside panels 12px, controls and inputs 10px, small row buttons and nav links 8px, day tabs fully pilled, step numbers circular. Borders are 1px solid hairlines; the one exception is the empty state, a 2px dashed Field Line border marking a space that will fill.

## Components

### Buttons
Plain, confident and sentence-cased.
- **Shape:** gently rounded (10px).
- **Primary:** Study Green fill, white text, 11px 18px padding; the booking submit is larger (14px vertical, 16px/800 text) and names the action ("Book 4:15 PM as seller").
- **Hover / Focus / Active:** background shifts to Deep Study Green over 160ms (`cubic-bezier(0.16, 1, 0.3, 1)`); 2px green focus outline offset 2px; 1px press-down on active.
- **Outlined:** white with a Field Line border and ink text; border goes ink on hover.
- **Text:** green text, no fill; underlines on hover ("Book another seat").
- **Row button:** 8px corners, 40px min height, white with an inset 1px Field Line ring (ink on hover); selected becomes a green fill reading "Selected".

### Chips / Tabs
- **Day tabs:** pills, 14px/700, white with an inset 1px Field Line ring; selected is an ink fill with white text. Scroll horizontally on overflow. Exposed as a `tablist`.

### Cards / Containers
- **Panel:** white, 1px Hairline border, 16px corners, no shadow. Lists inside a panel clip to its corners and divide rows with Soft Hairline.
- **Tint card:** Green Wash fill, 12px corners, 16px padding, Deep Study Green labels; holds the chosen slot and the booking confirmation.
- **Empty state:** 2px dashed Field Line, 12px corners, centered: a muted 14px/700 status line, the next time in Numeral, and one muted sentence of what to do.

### Inputs / Fields
- **Style:** white, 1px Field Line border, 10px corners, 12px 14px padding, 16px text; label above in Label style, helper text below in muted, flush left.
- **Hover:** border goes Muted Slate. **Focus:** MUI green 2px border.
- **Error:** Signal Red border and helper text that says how to fix it.
- **Role choice:** two equal tiles in a pressed-button group, white, 10px corners, inset ring 1px Field Line at rest, 2px green when chosen (same box, so no layout shift), name at 15px/800 over a 13px muted line.

### Navigation
- **Header:** sticky white bar with a Hairline bottom. The mark is a 30px green rounded square (8px) holding "60" in white 800, beside "PitchDrill" at 19px/800.
- **Links:** 15px/600 Muted Slate, 8px corners; hover goes ink on Chip Grey. Hidden below `sm`, where the header keeps only the mark and the green "Book a seat" button.

### Numbered steps
A panel list; each row leads with a 30px Green Wash disc holding the step number in Deep Study Green 800, then a 15px/700 title over a muted body-small line.

### Live tile (specified by the approved mockup; not yet implemented)
Waits on `GET /rounds/live` (TASK-009) and the spectator view (TASK-018). A panel-style tile with a split thumbnail: seller half in Seller Slate with initials in Seller Ink, buyer half in Buyer Sand with initials in Buyer Ink. A LIVE marker in Signal Red text plus a dot. Takes the Watch panel's place of the empty state.

### Past-round row (specified by the approved mockup; not yet implemented)
Waits on `GET /replays` (TASK-012). A list row inside a panel with the same split thumbnail, a verdict chip (Sold: Green Wash with Deep Study Green text; Not sold: Sand with Sand Ink text) and a vote bar showing the Sold / Not sold split in the same two families. Exact sizes are to be recorded from the build when it lands.

## Do's and Don'ts

### Do:
- **Do** put content on white panels (1px Hairline, 16px corners) over the Hall Grey ground.
- **Do** use Study Green for actions, selection and Sold only; text on green is white.
- **Do** set times and countdowns in tabular Manrope 800, and let a time be the largest thing on a surface.
- **Do** pair every status color with text or a shape (LIVE text plus dot, "Selected", a 2px ring).
- **Do** keep custom-control borders as inset rings so selected and unselected states have the same box.
- **Do** keep motion to 160ms state transitions and honor reduced motion.

### Don't:
- **Don't** bring back the shopping-channel broadcast vocabulary: saturated studio fields, condensed uppercase type, lower-third straps, price bursts or on-air chrome.
- **Don't** add shadows or elevation to panels, cards or buttons.
- **Don't** use a second accent for actions; sand and the role tints are for verdicts and seats, not buttons.
- **Don't** use red as a fill or for emphasis; it is LIVE and errors only.
- **Don't** uppercase or letter-space labels.
