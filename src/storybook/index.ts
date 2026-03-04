/**
 * nib storybook module — Storybook integration utilities.
 *
 * Exports:
 * - storybookInit()  — wire up a project's Storybook with nib brand tokens
 * - generateStory()  — generate a .stories.ts scaffold from a component contract
 */

export { storybookInit } from "./init.js";
export type { StorybookInitResult } from "./init.js";

export { generateStory } from "./story-gen.js";
export type { StoryGenOptions } from "./story-gen.js";
