## Description

Makes the editor usable on small mobile screens while preserving the existing desktop three-column layout.

This keeps the change focused on Issue #18:

- adds a small-screen `Code / Preview / Style` workspace switcher
- keeps Preview as the default mobile workspace
- makes the top bar and playback controls fit common mobile widths without horizontal scrolling
- reuses the existing Code, Preview and Style components/state rather than adding duplicate mobile implementations
- preserves the existing desktop three-column editor
- adds Playwright coverage at 320px, 375px and desktop width

## Related issue

Closes #18

## Type of change

- [ ] Bug fix
- [x] New feature
- [ ] Documentation
- [ ] Refactor / maintenance
- [ ] Other (please describe)

## How has this been tested?

Final validated head: `ebda63d1dd44badaa7a8cefac03a3518c6416e4e`.

Verified with:

```sh
npm ci
npm run format:check
npm run lint
npm run test:unit
npm run build
npx playwright test e2e/responsive.spec.ts --ui
npx playwright test e2e/playback.spec.ts --workers=1
git diff --check upstream/main...HEAD
```

Responsive Playwright coverage passed 5/5 on the final head and verifies:

- 320px: Preview and primary controls remain visible and the page/playback controls do not overflow horizontally
- 320px: Code / Preview / Style switching preserves editor state
- 375px: Preview and primary controls remain visible and the page/playback controls do not overflow horizontally
- 375px: Code / Preview / Style switching preserves editor state
- desktop: the existing three-column editor remains visible and the mobile workspace switcher is hidden

Manual checks also covered playback interaction, timeline scrubbing, Projects, Save/Export reachability, Code editing, Style changes, state retention and returning to Preview.

## Video evidence

### 320px: Preview, primary controls and horizontal overflow

`codereel-issue-18-320px-preview-controls.webm`

Shows the preview remaining usable at 320px, playback controls fitting without horizontal scrolling, and the primary Projects, Save and Export controls remaining reachable.

<!-- drag codereel-issue-18-320px-preview-controls.webm here -->

### 320px: Code / Preview / Style switching and state preservation

`codereel-issue-18-320px-workspace-state.webm`

Shows the mobile workspace switcher moving between Code, Preview and Style while preserving editor state.

<!-- drag codereel-issue-18-320px-workspace-state.webm here -->

### 375px: Preview, primary controls and horizontal overflow

`codereel-issue-18-375px-preview-controls.webm`

Shows the same responsive behaviour at 375px with the preview and primary controls remaining usable without horizontal overflow.

<!-- drag codereel-issue-18-375px-preview-controls.webm here -->

### 375px: Code / Preview / Style switching and state preservation

`codereel-issue-18-375px-workspace-state.webm`

Shows Code, Preview and Style switching at 375px while retaining editor state.

<!-- drag codereel-issue-18-375px-workspace-state.webm here -->

### Desktop: Existing three-column editor preserved

`codereel-issue-18-desktop-three-column-preservation.webm`

Shows the existing desktop Code / Preview / Style three-column layout remaining intact at desktop width.

<!-- drag codereel-issue-18-desktop-three-column-preservation.webm here -->

## Screenshots

Video evidence above covers both mobile widths and desktop preservation.

## Checklist

- [x] My code follows the style of this project
- [x] I have tested my changes locally
- [x] I have updated documentation where needed
- [x] My pull request targets the `main` branch
- [x] I have read the [Contributing guide](../CONTRIBUTING.md)
