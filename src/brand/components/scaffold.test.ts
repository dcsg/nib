/**
 * Tests for component contract scaffolder.
 */

import { describe, it, expect } from "bun:test";
import { detectWidgetType, scaffoldContract } from "./scaffold.js";

// ---------------------------------------------------------------------------
// detectWidgetType — heuristics
// ---------------------------------------------------------------------------

describe("detectWidgetType", () => {
  it("detects button from name containing 'button'", () => {
    expect(detectWidgetType("Button")).toBe("button");
    expect(detectWidgetType("IconButton")).toBe("button");
    expect(detectWidgetType("SubmitButton")).toBe("button");
  });

  it("detects button from 'btn' abbreviation", () => {
    expect(detectWidgetType("PrimaryBtn")).toBe("button");
  });

  it("detects textinput from 'input'", () => {
    expect(detectWidgetType("TextInput")).toBe("textinput");
    expect(detectWidgetType("SearchInput")).toBe("textinput");
  });

  it("detects textinput from 'field'", () => {
    expect(detectWidgetType("EmailField")).toBe("textinput");
  });

  it("detects textinput from 'textfield'", () => {
    expect(detectWidgetType("TextField")).toBe("textinput");
  });

  it("detects dialog from 'dialog'", () => {
    expect(detectWidgetType("Dialog")).toBe("dialog");
    expect(detectWidgetType("ConfirmDialog")).toBe("dialog");
  });

  it("detects dialog from 'modal'", () => {
    expect(detectWidgetType("Modal")).toBe("dialog");
  });

  it("detects tabs from 'tab'", () => {
    expect(detectWidgetType("Tabs")).toBe("tabs");
    expect(detectWidgetType("TabPanel")).toBe("tabs");
  });

  it("detects combobox from 'combobox'", () => {
    expect(detectWidgetType("Combobox")).toBe("combobox");
  });

  it("detects combobox from 'select'", () => {
    expect(detectWidgetType("Select")).toBe("combobox");
    expect(detectWidgetType("CountrySelect")).toBe("combobox");
  });

  it("detects combobox from 'dropdown'", () => {
    expect(detectWidgetType("Dropdown")).toBe("combobox");
  });

  it("detects checkbox from 'checkbox'", () => {
    expect(detectWidgetType("Checkbox")).toBe("checkbox");
  });

  it("detects radio from 'radio'", () => {
    expect(detectWidgetType("RadioButton")).toBe("radio");
    expect(detectWidgetType("RadioGroup")).toBe("radio");
  });

  it("detects switch from 'switch'", () => {
    expect(detectWidgetType("Switch")).toBe("switch");
  });

  it("detects switch from 'toggle'", () => {
    expect(detectWidgetType("Toggle")).toBe("switch");
    expect(detectWidgetType("DarkModeToggle")).toBe("switch");
  });

  it("detects tooltip from 'tooltip'", () => {
    expect(detectWidgetType("Tooltip")).toBe("tooltip");
  });

  it("falls back to generic for unknown names", () => {
    expect(detectWidgetType("Card")).toBe("generic");
    expect(detectWidgetType("Avatar")).toBe("generic");
    expect(detectWidgetType("Sidebar")).toBe("generic");
  });

  it("detects Phase 3.2 feedback widget types", () => {
    expect(detectWidgetType("Badge")).toBe("badge");
    expect(detectWidgetType("Toast")).toBe("toast");
    expect(detectWidgetType("Alert")).toBe("alert");
  });

  // Priority order: checkbox/radio/switch check before textinput
  it("does not confuse 'checkbox' with 'textinput' (no 'input' match wins)", () => {
    expect(detectWidgetType("Checkbox")).toBe("checkbox");
  });
});

// ---------------------------------------------------------------------------
// scaffoldContract — full contract generation
// ---------------------------------------------------------------------------

describe("scaffoldContract", () => {
  it("scaffolds a button contract with correct widgetType", async () => {
    const contract = await scaffoldContract("Button");
    expect(contract.widgetType).toBe("button");
    expect(contract.name).toBe("Button");
  });

  it("includes $schema field", async () => {
    const contract = await scaffoldContract("Button");
    expect(contract.$schema).toContain("component-contract");
  });

  it("includes required fields: anatomy, states, a11y, tokens", async () => {
    const contract = await scaffoldContract("Button");
    expect(contract.anatomy).toBeDefined();
    expect(Object.keys(contract.anatomy).length).toBeGreaterThan(0);
    expect(contract.states).toBeDefined();
    expect(Object.keys(contract.states).length).toBeGreaterThan(0);
    expect(contract.a11y).toBeDefined();
    expect(contract.tokens).toBeDefined();
  });

  it("button contract has Enter and Space keyboard bindings", async () => {
    const contract = await scaffoldContract("Button");
    expect(contract.a11y.keyboard["Enter"]).toBeDefined();
    expect(contract.a11y.keyboard["Space"]).toBeDefined();
  });

  it("dialog contract has focus trap", async () => {
    const contract = await scaffoldContract("Dialog");
    expect(contract.widgetType).toBe("dialog");
    expect(contract.a11y.focusTrap).toBe(true);
    expect(contract.a11y.keyboard["Escape"]).toBeDefined();
  });

  it("tabs contract has ArrowLeft/ArrowRight keyboard bindings", async () => {
    const contract = await scaffoldContract("Tabs");
    expect(contract.widgetType).toBe("tabs");
    expect(contract.a11y.keyboard["ArrowLeft"]).toBeDefined();
    expect(contract.a11y.keyboard["ArrowRight"]).toBeDefined();
  });

  it("combobox contract has ArrowDown, Enter, Escape", async () => {
    const contract = await scaffoldContract("Combobox");
    expect(contract.widgetType).toBe("combobox");
    expect(contract.a11y.keyboard["ArrowDown"]).toBeDefined();
    expect(contract.a11y.keyboard["Enter"]).toBeDefined();
    expect(contract.a11y.keyboard["Escape"]).toBeDefined();
  });

  it("tooltip contract has not-focusable focus behavior", async () => {
    const contract = await scaffoldContract("Tooltip");
    expect(contract.widgetType).toBe("tooltip");
    expect(contract.a11y.focusBehavior).toBe("not-focusable");
  });

  it("respects --widget-type override", async () => {
    // Name would be detected as generic, but override forces dialog
    const contract = await scaffoldContract("MyOverlay", { widgetType: "dialog" });
    expect(contract.widgetType).toBe("dialog");
    expect(contract.a11y.focusTrap).toBe(true);
  });

  it("respects --variants override", async () => {
    const contract = await scaffoldContract("Button", { variants: ["primary", "outline"] });
    expect(contract.variants).toBeDefined();
    expect(Object.keys(contract.variants!)).toContain("primary");
    expect(Object.keys(contract.variants!)).toContain("outline");
    expect(Object.keys(contract.variants!)).toHaveLength(2);
  });

  it("respects --sizes override", async () => {
    const contract = await scaffoldContract("Button", { sizes: ["xs", "sm"] });
    expect(contract.sizes).toBeDefined();
    expect(Object.keys(contract.sizes!)).toContain("xs");
    expect(Object.keys(contract.sizes!)).toContain("sm");
  });

  it("uses template variants when no --variants option given", async () => {
    const contract = await scaffoldContract("Button");
    // Button template has primary, secondary, ghost, danger
    expect(contract.variants).toBeDefined();
    expect(Object.keys(contract.variants!).length).toBeGreaterThan(0);
  });

  it("scaffolds checkbox with Space keyboard binding", async () => {
    const contract = await scaffoldContract("Checkbox");
    expect(contract.widgetType).toBe("checkbox");
    expect(contract.a11y.keyboard["Space"]).toBeDefined();
  });

  it("scaffolds radio with Arrow key bindings", async () => {
    const contract = await scaffoldContract("RadioGroup");
    expect(contract.widgetType).toBe("radio");
    expect(contract.a11y.keyboard["ArrowDown"]).toBeDefined();
    expect(contract.a11y.keyboard["ArrowUp"]).toBeDefined();
  });

  it("scaffolds switch with Space and Enter bindings", async () => {
    const contract = await scaffoldContract("Toggle");
    expect(contract.widgetType).toBe("switch");
    expect(contract.a11y.keyboard["Space"]).toBeDefined();
    expect(contract.a11y.keyboard["Enter"]).toBeDefined();
  });

  it("scaffolds generic contract with user-defined focus behavior", async () => {
    const contract = await scaffoldContract("Card");
    expect(contract.widgetType).toBe("generic");
    expect(contract.a11y.focusBehavior).toBe("user-defined");
  });

  it("all required fields present in TextInput contract", async () => {
    const contract = await scaffoldContract("SearchInput");
    expect(contract.widgetType).toBe("textinput");
    expect(contract.anatomy).toBeDefined();
    expect(contract.states).toBeDefined();
    expect(contract.a11y.role).toBeDefined();
    expect(contract.tokens).toBeDefined();
  });
});
