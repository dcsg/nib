import { defineConfig } from "vitepress";
import { tabsMarkdownPlugin } from "vitepress-plugin-tabs";

export default defineConfig({
  title: "nib",
  description:
    "Describe your brand once — nib generates design tokens and injects brand context into Claude, Cursor, Copilot, and Windsurf so every AI builds on-brand UI by default.",
  cleanUrls: true,
  base: "/",

  head: [
    ["link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
    ["meta", { name: "theme-color", content: "#1B1F3B" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "nib — Your Design Control Plane" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Describe your brand once — nib injects brand context into Claude, Cursor, Copilot, and Windsurf. Every AI that writes your UI builds on-brand by default.",
      },
    ],
    ["meta", { property: "og:image", content: "https://usenib.dev/og-image.png" }],
    ["meta", { property: "og:url", content: "https://usenib.dev" }],
  ],

  themeConfig: {
    logo: {
      light: "/logo-dark.svg",
      dark: "/logo-light.svg",
      alt: "nib",
    },
    siteTitle: false,

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/cli" },
      {
        text: "v0.1.0",
        items: [
          {
            text: "npm",
            link: "https://www.npmjs.com/package/usenib",
          },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Who Is nib For?", link: "/guide/who-is-nib-for" },
            { text: "Design for Builders", link: "/guide/design-for-builders" },
            { text: "Project Structure", link: "/guide/project-structure" },
            { text: "MCP Setup", link: "/guide/mcp-setup" },
          ],
        },
        {
          text: "How-to Guides",
          items: [
            { text: "Design File Workflow", link: "/guide/design-file-workflow" },
            { text: "Updating Tokens", link: "/guide/updating-tokens" },
            { text: "Framework Integration", link: "/guide/framework-integration" },
          ],
        },
        {
          text: "Tools",
          items: [
            { text: "Brand System", link: "/guide/brand" },
            { text: "Brand Validate", link: "/guide/brand-validate" },
            { text: "Storybook", link: "/guide/storybook" },
            { text: "Component Story", link: "/guide/component-story" },
            { text: "Theming & Dark Mode", link: "/guide/theming" },
            { text: "Prototypes", link: "/guide/prototypes" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "CLI Commands", link: "/reference/cli" },
            { text: "nib.config.json", link: "/reference/config" },
            { text: "brand.config.json", link: "/reference/brand-config" },
          ],
        },
      ],
      "/templates/": [
        {
          text: "Templates",
          items: [
            { text: "Overview", link: "/templates/" },
            { text: "Clean", link: "/templates/clean" },
            { text: "Presentation", link: "/templates/presentation" },
          ],
        },
      ],
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/dcsg/nib",
      },
    ],

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the AGPL-3.0 License.",
      copyright: "Copyright © 2025-present",
    },
  },

  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
    config(md) {
      md.use(tabsMarkdownPlugin);
    },
  },
});
