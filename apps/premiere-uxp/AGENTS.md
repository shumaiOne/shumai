# Premiere UXP Plugin Guidelines

## Component Library (Spectrum Web Components / SWC)

- **Always prefer SWC components if possible**: Use Spectrum Web Component React wrappers (`@swc-react/*`) and `@swc-uxp-wrappers/*` for UI elements (Button, ActionButton, Textfield, Card, Divider, ProgressCircle, StatusLight, Badge, Search, FieldLabel, HelpText, IllustratedMessage, ActionGroup, etc.) rather than hand-crafting custom HTML/CSS elements.
- **SWC Support**: `public/manifest.json` has `"featureFlags": { "enableSWCSupport": true }`.
- **Package Versions**: Keep SWC packages aligned at version `0.37.0` (matching Adobe UXP compatibility).
- **Bundler Aliases**: `build.ts` uses `swcAliasPlugin` with `aliases` from `@swc-uxp-wrappers/utils` to resolve internal SWC imports for Bun.

## Icons

- **Always use Spectrum Workflow Icons (`@spectrum-web-components/icons-workflow`)**: Never use external icon libraries like `lucide-react`.
- **Registration**: All workflow icons used must be imported and registered in `src/index.tsx` (e.g. `import '@spectrum-web-components/icons-workflow/icons/sp-icon-movie-camera.js'`). Note: Ensure the icon exists in `@spectrum-web-components/icons-workflow/icons/` (Spectrum 1 compatible) rather than only `icons-s2/` (which falls back to an empty circular DefaultIcon under Spectrum 1).
- **Typing**: Add custom element declarations to `src/declarations.d.ts` under both `declare namespace React.JSX` and `declare global.JSX.IntrinsicElements` with `SpIconCustomElementProps`.

## Adobe UXP Layout Engine Rules (Critical CSS Gotchas)

Adobe UXP's layout engine (Yoga-based) does **not** support several standard modern CSS features:

1. **No CSS Grid**:
   - `display: grid` and `grid-template-columns` are **unsupported / invalid**.
   - Always use Flexbox (`display: flex; flex-direction: row | column;`).
2. **No `aspect-ratio`**:
   - `aspect-ratio` is invalid in UXP and collapses containers to `0px` height.
   - Always specify explicit `width` and `height` on preview / thumbnail containers.
3. **No `box-sizing: border-box`**:
   - `box-sizing` is not supported (UXP elements are natively border-box). Specifying it logs invalid property warnings.
4. **No `gap` in Flexbox**:
   - `gap` is invalid in Premiere UXP flexbox. Items will render with 0px spacing.
   - Use `margin-bottom` or `margin-right` on child items for spacing.
5. **Always Set `flex-shrink: 0` on List Items**:
   - Flex children default to `flex-shrink: 1`. When rendering lists with many items (>10 items), flexbox squishes the items down to slivers instead of scrolling.
   - Always add `flex-shrink: 0` and an explicit `min-height` to list row cards (`.project-row-card`, `.file-row-card`, `.item-row`, etc.).
6. **Scroll Containers**:
   - Scrollable flex children (like `.view-content`) must have `min-height: 0` and `overflow-y: auto` to allow children to overflow and scroll vertically.

## Build and Packaging Commands

- **Build**: `bun run --filter @shumai/premiere-uxp build`
- **Watch mode**: `bun run --filter @shumai/premiere-uxp dev`
- **Package CCX**: `bun run --filter @shumai/premiere-uxp package` (outputs `apps/premiere-uxp/shumai-premiere.ccx`)
