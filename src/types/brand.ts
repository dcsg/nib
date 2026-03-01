/**
 * Types for the nib brand system — AI-native design token generator.
 */

/** Supported AI providers for brand generation */
export type AiProviderName = "anthropic" | "openai" | "ollama" | "claude-code";

/** Supported input source types */
export type BrandInputSource = "interactive" | "markdown" | "url" | "pdf";

/** DTCG token types */
export type DtcgTokenType =
  | "color"
  | "dimension"
  | "fontFamily"
  | "fontWeight"
  | "duration"
  | "cubicBezier"
  | "number"
  | "shadow"
  | "border"
  | "transition"
  | "typography";

/** DTCG composite: shadow value object (FR-5.1) */
export interface ShadowValue {
  offsetX: string;
  offsetY: string;
  blur: string;
  spread: string;
  color: string;
}

/** DTCG composite: typography value object (FR-5.2) */
export interface TypographyValue {
  fontFamily: string;
  fontWeight: string;
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
}

/** DTCG composite: transition value object (FR-5.3) */
export interface TransitionValue {
  duration: string;
  delay: string;
  timingFunction: string;
}

/** Audit status for a token — set by nib brand audit */
export type NibAuditStatus = "pass" | "fail" | "warn" | "unaudited";

/** $extensions.nib block present on every generated token (FR-6) */
export interface ExtensionsNib {
  auditStatus: NibAuditStatus;
  owner: string;
  deprecated: boolean;
  migrateTo: string | null;
  generatedAt: string;
}

/** A single DTCG token */
export interface DtcgToken {
  $value: unknown;
  $type?: DtcgTokenType;
  $description?: string;
  $extensions?: {
    nib?: ExtensionsNib;
  };
}

/** Validation check result */
export interface ValidationIssue {
  check: string;
  token: string;
  message: string;
}

/** Result of nib brand validate */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** .nib/.status.json schema */
export interface NibStatus {
  lastBuild?: string;
  lastAudit?: {
    timestamp: string;
    passed: number;
    failed: number;
  };
  lastValidate?: {
    timestamp: string;
    valid: boolean;
  };
  penFile?: string;
  tokenVersion?: string;
}

/** Nested DTCG token group (tokens or sub-groups) */
export interface DtcgTokenGroup {
  $type?: DtcgTokenType;
  $description?: string;
  [key: string]: unknown;
}

/** Complete DTCG token file — flexible to accommodate any DTCG-compliant structure */
export type DtcgTokenFile = Record<string, unknown>;

/** HSL color representation */
export interface HslColor {
  h: number;
  s: number;
  l: number;
}

/** Color scale steps (Tailwind-style) */
export type ColorScaleStep =
  | "50"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "950";

/** A full color scale */
export type ColorScale = Record<ColorScaleStep, string>;

/** Brand color input — what the user provides */
export interface BrandColorInput {
  primary: string;
  secondary?: string;
  accent?: string;
}

/** Typography style for a type scale */
export type TypeScaleRatio = "major-third" | "perfect-fourth";

/** Brand typography input */
export interface BrandTypographyInput {
  fontFamily: string;
  monoFontFamily?: string;
  scaleRatio?: TypeScaleRatio;
}

/** Brand personality traits */
export type BrandPersonality =
  | "professional"
  | "playful"
  | "warm"
  | "bold"
  | "minimal"
  | "elegant"
  | "technical"
  | "friendly";

/** Raw brand input gathered from any source */
export interface BrandInput {
  name: string;
  personality?: BrandPersonality[];
  colors: BrandColorInput;
  typography: BrandTypographyInput;
  description?: string;
  industry?: string;
}

/** WCAG conformance level */
export type WcagLevel = "AA" | "AAA";

/** Result of a single WCAG contrast check */
export interface WcagCheckResult {
  foreground: string;
  background: string;
  foregroundToken: string;
  backgroundToken: string;
  ratio: number;
  passAA: boolean;
  passAAA: boolean;
  passAALarge: boolean;
}

/** Full WCAG audit report */
export interface WcagAuditReport {
  totalPairs: number;
  passed: number;
  failed: number;
  results: WcagCheckResult[];
}

/** Platform build targets */
export type BrandPlatform = "css" | "tailwind" | "pencil";

/** Platform output paths */
export interface BrandPlatformPaths {
  css: string;
  tailwind: string;
  /** Path to the built variables JSON consumed by push */
  pencil: string;
  /** Path to the .pen file to push variables into */
  penFile: string;
}

/** Brand config stored in .nib/brand.config.json */
export interface NibBrandConfig {
  version: "1";
  generator: "nib";
  brand: {
    name: string;
    personality: BrandPersonality[];
  };
  tokens: string;
  platforms: BrandPlatformPaths;
  output: string;
  ai: {
    provider: AiProviderName | false;
    model?: string;
  };
  /** Component registry — populated by nib component init */
  components?: ComponentRegistry;
}

/** Options for `nib brand init` */
export interface BrandInitOptions {
  /** Source file/URL for brand guidelines */
  from?: string;
  /** AI provider override */
  ai?: AiProviderName;
  /** Output directory for the design system */
  output?: string;
  /** Skip AI enhancement (use only algorithmic derivation) */
  noAi?: boolean;
}

/** Options for `nib brand build` */
export interface BrandBuildOptions {
  /** Path to brand config (default: .nib/brand.config.json) */
  config?: string;
  /** Specific platforms to build */
  platforms?: BrandPlatform[];
}

/** Options for `nib brand push` */
export interface BrandPushOptions {
  /** Path to .pen file (overrides config.platforms.penFile) */
  file?: string;
  /** Path to brand config (default: .nib/brand.config.json) */
  config?: string;
}

/** Options for `nib brand audit` */
export interface BrandAuditOptions {
  /** Path to brand config (default: .nib/brand.config.json) */
  config?: string;
  /** Minimum conformance level */
  level?: WcagLevel;
}

/** Options for `nib brand style` */
export interface BrandStyleOptions {
  /** Pencil style guide tags to fetch */
  tags?: string[];
  /** Pencil style guide name to fetch */
  name?: string;
  /** Path to .pen file (overrides config.platforms.penFile) */
  file?: string;
  /** Path to brand config (default: .nib/brand.config.json) */
  config?: string;
}

// ---------------------------------------------------------------------------
// Component system types (Phase 3)
// ---------------------------------------------------------------------------

/** Supported WAI-ARIA widget types */
export type WidgetType =
  | "button"
  | "textinput"
  | "checkbox"
  | "radio"
  | "switch"
  | "tabs"
  | "dialog"
  | "combobox"
  | "tooltip"
  | "badge"
  | "toast"
  | "alert"
  | "generic";

/** Component status in the registry */
export type ComponentStatus = "draft" | "stable" | "deprecated";

/** Focus behavior for a component */
export type FocusBehavior =
  | "receives-focus"
  | "focus-trap"
  | "roving-tabindex"
  | "not-focusable"
  | "manages-focus"
  | "user-defined";

/** Named parts of the component */
export type ComponentAnatomy = Record<string, string>;

/** A single component state */
export interface ComponentState {
  /** Human-readable description of the state */
  description: string;
  /** Whether this state shows a focus ring */
  focusRing?: boolean;
  /** ARIA label override in this state */
  ariaLabel?: string;
  /** Whether aria-disabled applies in this state */
  ariaDisabled?: boolean;
  /** If true, this state is only reachable via hover (accessibility violation) */
  hoverOnly?: boolean;
}

/** All interactive states for a component */
export type ComponentStates = Record<string, ComponentState>;

/** Touch target minimums */
export interface TouchTarget {
  ios: string;
  android: string;
  web: string;
}

/** A11y contract for a component */
export interface ComponentA11y {
  /** WAI-ARIA role */
  role: string;
  /** Keyboard interaction map: key → description */
  keyboard: Record<string, string>;
  /** How focus is managed */
  focusBehavior: FocusBehavior;
  /** Whether focus is trapped within this component */
  focusTrap: boolean;
  /** Where focus returns when closed/dismissed (null if N/A) */
  focusReturnTarget: string | null;
  /** Minimum touch target dimensions */
  minimumTouchTarget: TouchTarget;
  /** Supported ARIA attributes */
  ariaAttributes: string[];
  /** Whether a visible label or aria-label is required */
  requiredLabel: boolean;
  /** Strategy for providing the accessible label */
  labelStrategy: string;
}

/** Responsive behavior per window size class */
export interface ResponsiveSizeClass {
  fullWidth?: boolean;
  [key: string]: unknown;
}

/** Responsive behavior for a component */
export type ComponentResponsive = Record<string, ResponsiveSizeClass>;

/** A token value — either a reference string or a structured composite object (shadow, transition, etc.) */
export type ComponentTokenValue = string | Record<string, string>;

/** Token bindings for a single state of an anatomy part */
export type ComponentStateTokens = Record<string, ComponentTokenValue>;

/** Token bindings for all states of an anatomy part */
export type ComponentPartTokens = Record<string, ComponentStateTokens>;

/** Token bindings per anatomy part */
export type ComponentTokenBindings = Record<string, ComponentPartTokens>;

/** Size definition for a component */
export interface ComponentSizeStep {
  height?: string;
  paddingX?: string;
  paddingY?: string;
  fontSize?: string;
  [key: string]: string | undefined;
}

/** Interaction model for a component */
export interface ComponentInteraction {
  /** Keys that activate the component */
  activationKeys?: string[];
  /** Primary ARIA role */
  role?: string;
  /** Whether activating submits a form */
  submitsForm?: boolean;
  [key: string]: unknown;
}

/**
 * A single slot in a component's design API.
 * Slots define what content a component accepts — preventing "15 almost-identical buttons."
 */
export interface ComponentSlot {
  /** What this slot contains or does */
  description: string;
  /** Whether this slot must be provided */
  required: boolean;
  /** What this slot accepts */
  accepts: "text" | "icon" | "component" | "action";
  /** Maximum character length (text slots only) */
  maxLength?: number;
  /** Whether long content can be truncated */
  truncatable?: boolean;
}

/** Slot definitions for a component's design API */
export type ComponentSlots = Record<string, ComponentSlot>;

/** A complete component contract (FR-1, FR-2) */
export interface ComponentContract {
  $schema: string;
  name: string;
  description: string;
  widgetType: WidgetType;
  anatomy: ComponentAnatomy;
  variants?: Record<string, string>;
  sizes?: Record<string, ComponentSizeStep>;
  states: ComponentStates;
  interaction?: ComponentInteraction;
  a11y: ComponentA11y;
  responsive?: ComponentResponsive;
  /** Design API: what content slots this component accepts */
  slots?: ComponentSlots;
  tokens: ComponentTokenBindings;
}

/** Registry entry for a single component */
export interface ComponentRegistryEntry {
  contractPath: string;
  widgetType: WidgetType;
  status: ComponentStatus;
  addedAt: string;
}

/** Full component registry stored in brand.config.json */
export type ComponentRegistry = Record<string, ComponentRegistryEntry>;

/** Options for `nib component init` */
export interface ComponentInitOptions {
  /** Force a specific widget type instead of using heuristics */
  widgetType?: WidgetType;
  /** Comma-separated list of variant names */
  variants?: string[];
  /** Comma-separated list of size names */
  sizes?: string[];
}

/** AI provider interface — implement for each supported LLM API */
export interface BrandAiProvider {
  /** Enhance brand input with AI-generated semantic descriptions and component rules */
  enhanceBrand(input: BrandInput): Promise<BrandAiEnhancement>;
}

/** AI-generated enhancements to the brand system */
export interface BrandAiEnhancement {
  /** Enhanced brand description for brand.md */
  identity: string;
  /** Color usage rules */
  colorRules: string;
  /** Typography usage rules */
  typographyRules: string;
  /** Spacing usage rules */
  spacingRules: string;
  /** Component styling patterns */
  componentPatterns: string;
}
