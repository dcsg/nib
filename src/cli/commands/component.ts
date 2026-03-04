/**
 * `nib component` — CLI command suite for the component system.
 *
 * Subcommands: init, list, story
 */

import { defineCommand } from "citty";
import { initComponentCommand } from "./component/init.js";
import { listComponentCommand } from "./component/list.js";
import { storyCommand } from "./component/story.js";

export const componentCommand = defineCommand({
  meta: {
    name: "component",
    description: "Manage component contracts — scaffold, list, and validate components",
  },
  subCommands: {
    init: initComponentCommand,
    list: listComponentCommand,
    story: storyCommand,
  },
});
