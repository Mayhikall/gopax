# Gopax UI review

Redesign: 17 September 2026. Anti-slop applied during implementation, as selected by the owner.
Scope: landing, app shell, Home, Impact, Trips, upload, trip details, Profile, and preview states.
Design direction and the reasons for visual decisions are in [DESIGN.md](DESIGN.md).

## Verification

- PASS: `npm run lint` and `npm run typecheck`.
- PASS: production build. MetaMask's existing optional `@react-native-async-storage/async-storage` warning remains; it does not fail compilation.
- PASS: browser layout checks for seven screens at 320, 390, 768, 1024, and 1440 CSS pixels. No document-level horizontal overflow.
- PASS: eleven alternate states on Home and trip details at 390px: empty, pending, unavailable assessment, no reward, no comparison, negative comparison, zero savings, tiny values, long routes, loading, and service error.
- PASS: computed text/background contrast across those screens and states. Lowest measured enabled text pair: 4.83:1; muted text on the main canvas: 5.17:1. Disabled controls are excluded from WCAG text contrast requirements.
- PASS: input/control border `#828a7b` on `#fffef9` measures 3.54:1, meeting the 3:1 non-text threshold.
- PASS: desktop and phone screenshots inspected for content hierarchy, wrapping, spacing, and navigation placement.
- PASS: reduced-motion preference disables page, ticket, and chart entrance animations.
- PASS: profile save remains reachable with a 390 × 400 viewport representing reduced space above an on-screen keyboard.
- PASS: final production-browser replay completed all 58 screen/state/viewport checks and the interaction record below with zero console errors or unhandled page errors. Preview was enabled explicitly for this local build only.

## Browser interaction record

- PASS: Connect wallet opens the wallet chooser; Escape dismisses it.
- PASS: View sample journeys opens the Home preview.
- PASS: Home, Impact, Add trip, Trips, and Profile navigate to their respective screens from mobile navigation.
- PASS: the same five destinations work from desktop navigation.
- PASS: View your impact opens Impact; its Add a trip action opens the upload screen.
- PASS: Record a journey in the sidebar opens upload.
- PASS: Choose file opens the picker and shows the selected image.
- PASS: Remove selected file clears the image and disables submission.
- PASS: Take photo opens the capture-enabled picker; a selected image can open the sample result.
- PASS: Preview sample result opens the sample trip detail; the preview claim button remains visibly disabled.
- PASS: Back to trips opens history; selecting a journey opens its detail.
- PASS: Transport = Train leaves one sample row; combining it with Claimed produces the relevant empty state.
- PASS: Clear filters restores all three sample journeys.
- PASS: the available-rewards strip opens Trips with Available selected and one matching sample journey.
- PASS: a whitespace-only profile name shows validation; a valid name shows the preview-only success message.
- PASS: Copy wallet address writes the sample address to the clipboard and announces success.
- PASS: Profile's Exit preview returns to the landing page.
- PASS: Preview state = Service error displays an alert; Try again restores sample journeys.
- PASS: Home's Add a trip opens upload; an invalid file displays an error; Check your trips opens history.
- PASS: View all opens history; the user chip opens Profile; the preview banner's exit link returns to landing.
- PASS: the empty-account action opens upload; the brand link returns to landing.
- PASS: keyboard Tab reaches Skip to content; Enter activates it; subsequent keyboard focus has a visible outline.

The browser picker verifies the camera control's interaction, not physical camera capture. Browser reflow and a reduced-height viewport do not replace a physical-device accessibility audit.
Live sign-in signatures, backend upload/assessment, RPC balance, and blockchain claim/recovery require a configured backend and wallet. No transaction was sent, and those integrations are not claimed as end-to-end verified by this UI review.

## Anti-slop delivery gate

### Hard gate

- R-02 PASS: no em dash remains in application source copy; unavailable numeric values use N/A rather than an invented zero.
- R-03 PASS: the responsive screen matrix has no horizontal overflow; long routes wrap instead of being truncated.
- R-17 PASS: the landing ticket reads existing fixture data and is labeled Sample data and Sample ticket; account figures retain their backend or preview sources.
- R-18 PASS: no testimonials, team identities, or generated portraits were introduced.
- R-23 PASS: the owner authorized layout redesign; the existing logo and initial avatar remain, and sample content is explicitly labeled.
- R-24 PASS: existing route destinations were retained and exercised through desktop and mobile navigation.
- R-25 PASS: computed text contrast has a minimum of 4.83:1 for tested enabled text; control border contrast is 3.54:1.
- R-26 PASS: navigation, filters, file selection/removal, profile validation, clipboard, and modal dismissal have recorded browser interactions; demo claim remains explicitly unavailable.
- R-27 PASS: empty, loading, error, and unavailable comparison states are present and exercised.
- R-28 PASS: no speculative FAQ was added.
- R-32 PASS: native links/buttons/selects, a tested skip link, and visible focus indicators remain; hidden file inputs leave keyboard access to the visible picker buttons.
- R-33 PASS: UI changes were written directly in TSX/CSS using source patches, not runtime source-rewriting scripts.
- R-34 PASS: one intentional light paper theme is shipped; there is no nonfunctional theme toggle.
- R-35 PASS: lint, TypeScript, build, browser screenshots, interaction checks, and contrast calculations were run; live-integration limits are recorded above.
- R-36 PASS: no new security, performance, compliance, customer, or reward-guarantee claims were added.
- R-37 PASS: the design read was declared before editing, and delegated design direction is recorded in DESIGN.md.
- R-38 PASS: the sample ticket reuses labeled fixtures; no invented routes, statistics, navigation destinations, or people were presented as live data.

### Purpose gate

- R-01 PASS: solid paper and green ink retain the product's travel/environment identity; no background gradients or glow were introduced.
- R-04 PASS: transport, ticket, wallet, upload, and navigation icons identify their actual content; the decorative sidebar glyph was replaced by a ticket icon.
- R-06 PASS: locally hosted Manrope serves controls and numbers; Georgia gives journal headings their editorial voice; reasons are recorded in DESIGN.md.
- R-07 PASS: no background grid or dot pattern was added; dashed lines denote routes and ticket perforations.
- R-08 PASS: arrows denote journey direction or opening a record; upload, save, copy, and primary wallet actions do not get decorative arrows.
- R-09 PASS: badges communicate trip/reward states, while Sample data explicitly identifies fixtures; no promotional badge sits above the headline.
- R-10 PASS: only the sticky topbar retains backdrop blur; sidebar and bottom navigation use solid backgrounds.
- R-12 PASS: the landing sample ticket has a paper shadow; journey rows and metrics use dividers instead of floating shadows.
- R-13 PASS: no glows or pulsing status decorations were introduced; network labels do not imply a live connection with a green dot.
- R-14 PASS: the impact summary, subordinate metrics, continuous journey list, and grouped forms use different compositions for different content.
- R-19 PASS: page entrance establishes navigation, ticket entrance introduces the example, bars reveal proportions, and hover/press/copy feedback responds to interaction; reduced motion is supported.
- R-22 PASS: the existing route-and-leaf drawing is limited to the full impact summary; the landing's visual is a labeled ticket made from product data.

### Liveliness

- Dials PASS: ENERGY 2 / RHYTHM 2 / MOTION 2 are declared and documented.
- Consistency PASS: editorial landing, practical app screens, restrained motion, and shared paper/green colors follow those dials.
- Focal point PASS: landing headline, impact total, trip record, upload zone, or profile form leads each respective screen.
- Whitespace PASS: margins and dividers separate the summary, actions, and history; mobile uses a tighter spacing scale.
- Accent PASS: citron marks the next impact action and available rewards, rather than every surface.
- Identity PASS: route endpoints and ticket perforations connect the introductory sample to actual trip records.
- Design read PASS: the travel-journal direction was communicated before implementation.

### Craftsmanship and quality locks

- C-1 PASS: color, typography, layout, surface, icon, and animation purposes are written in DESIGN.md.
- C-2 PASS: changed actions have concrete destinations or behavior; unsupported live transactions are not simulated as successful.
- C-3 PASS: the landing explains actual ticket assessment, and the dashboard prioritizes recording trips and reviewing impact/rewards.
- C-4 PASS: responsive, state, focus, and reduced-motion checks are recorded above, with physical-device and live-service limits stated.
- C-5 PASS: sample figures are labeled; no customer or performance evidence was fabricated.
- R-05 PASS: the old three-feature landing row and repeated floating journey cards were replaced with an editorial explanation and a travel ledger.
- R-11 PASS: controls use 8px corners, panels generally 12px, statuses 4px, and avatars remain circular.
- R-15 PASS: calls to action name their destination or behavior: View sample journeys, Add a trip, View your impact, Choose file, Save changes.
- R-16 PASS: new copy describes tickets, estimates, and eligibility without generic marketing buzzwords.
- R-20 PASS: paper typography, ticket structure, and origin/destination composition make the interface specific to travel records.
- R-21 PASS: the fixed light paper theme supports receipt reading and outdoor mobile use; its reason is recorded.
- R-29 PASS: paper neutrals and green form the core palette, with citron as the accent; warning/error colors retain semantic meaning.
- R-30 PASS: the direction is a travel journal; no named product was used as a cloning template.
- R-31 PASS: major visual decisions each have a written reason in DESIGN.md.
