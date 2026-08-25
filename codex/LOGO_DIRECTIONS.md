# SIREN logo directions

All three marks use the same `64 × 64` view box, `currentColor`, one optional
`--brand-accent` token, rounded geometry, and no gradients. The comparison renders
the exact paths at 24, 32 and 64 px on light and dark grounds.

1. **Signal Path.** A readable process route resolves into a compact beacon signal;
   it carries both workflow and SIREN meanings without literal clip-art.
2. **Beacon Grid.** A compact tower projects a structured field, joining the signal
   metaphor to audit rows and documented systems.
3. **Process Lens.** Three documented inputs enter a framing lens and become one
   legible path, emphasizing clarity over the signal metaphor.

## Recommendation

Ship **Signal Path**. At 24 px it keeps the strongest single silhouette—the curved
route still reads as a route or an “S”, its two endpoints remain distinct, and the
three short rays supply the signal idea. Beacon Grid becomes close to a megaphone
at the smallest size; Process Lens is clear but says less about SIREN.

The integrated lockup uses a 34 px mark (30 px in the compact header), a 9 px gap,
and a one-pixel optical lift. The mark uses the theme text colour with the theme
primary colour on endpoints and signal rays. `T-INDUSTRIES | SIREN` and the quiet
version string remain unchanged, so the new mark adds product meaning without
turning the header into a new wordmark system.

## Evidence

- Standalone SVGs: `output/logo/direction-1-signal-path.svg`,
  `direction-2-beacon-grid.svg`, `direction-3-process-lens.svg`.
- Required matrix: `output/logo/logo-comparison.png`.
- Integrated real-app renders: `output/logo/in-app-dark.png` and
  `output/logo/in-app-paper.png`.

The comparison and both application screenshots were rendered with Playwright and
visually inspected. The only comparison-page console error was its intentionally
absent favicon; the SIREN page itself booted cleanly.
