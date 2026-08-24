# Zuelen UI Design System v2

Status: **single source of truth for product UI**

## 1. Product design objective

Zuelen should feel like a premium 2026 Luxembourg fintech/SaaS product: calm, precise, intelligent, trustworthy and visually confident. The interface must make financial information easier to understand, not merely decorate it.

The governing principle is **different contexts, same system**. Business, Professional/accountant, onboarding, billing, public directory, light/dark mode and desktop/mobile all use the same tokens, primitives and interaction grammar.

## 2. Design principles

1. **Financial clarity first** — key figures and states must be understood at a glance.
2. **Premium restraint** — neutral surfaces do most of the work; gradients/glow are reserved for high-value moments.
3. **Strong hierarchy** — muted label → prominent value/title → concise explanation → optional action/trend.
4. **Consistent rhythm** — spacing, padding, radii and control heights come from shared scales only.
5. **Semantic colour** — green/red/amber/blue communicate meaning, never decoration alone.
6. **Visual guidance** — icons, charts, progress and illustrations replace unnecessary explanatory copy.
7. **Actionable states** — empty, success, warning and error states always explain what happened and what to do next.
8. **Responsive by design** — mobile is re-composed, not a compressed desktop.
9. **Accessible interaction** — visible focus, large hit targets, keyboard support, sufficient contrast and clear disabled/error states.
10. **Truthful data visualisation** — no fabricated trends, percentages or insights.

## 3. Universal foundations

### Typography

- Primary typeface: **Inter**.
- Numeric values use tabular numerals.
- Page title: 30–40px desktop, 26–32px mobile.
- Section title: 17–22px.
- Card title: 14–17px.
- Metric value: 28–40px depending on density.
- Body: 13–15px.
- Supporting text: 11–13px.
- Eyebrow/metadata: 10–11px, medium/semibold, muted.

Use tighter tracking only for large headings and numbers. Avoid all-caps except very short metadata labels.

### Spacing

Base scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

- Page gutters: 32px desktop, 24px tablet, 16px mobile.
- Standard card padding: 24px desktop, 18–20px compact/mobile.
- Dense card padding: 18–20px.
- Card grid gap: 16px standard, 20–24px for major sections.
- Form field vertical gap: 16px.
- Section gap: 28–32px.

No arbitrary per-page spacing when a system token fits.

### Radius

- Small controls: 10px.
- Inputs/buttons: 12px.
- Standard cards: 16px.
- Major/feature cards: 20px.
- Modals/drawers: 20–24px.
- Pills/badges: 999px.

### Surfaces

Light mode:
- canvas: warm/off-white, never green-tinted
- primary surface: white
- secondary surface: very light neutral
- elevated surface: white with controlled shadow

Dark mode:
- canvas: deep neutral forest-charcoal, not pure black
- surfaces use layered luminance rather than heavy borders
- gradients/glows use lower opacity

### Border and shadow

Borders are subtle separators. Shadows indicate elevation, not decoration.

- standard border: 1px low-contrast neutral
- focus ring: 3px soft Zuelen green ring + stronger field border
- cards default to border OR shadow, rarely both strongly

## 4. Colour semantics

Zuelen brand green remains the primary action/accent family.

- `primary`: main Zuelen green
- `primary-hover`: darker/stronger green
- `primary-soft`: pale green surface
- `success`: positive/complete/approved
- `warning`: attention/pending/deadline
- `danger`: destructive/error/negative
- `info`: informational/neutral guidance

Financial positive/negative values must use semantic green/red only when direction is actually meaningful.

The Zuelen brand gradient is reserved for:
- Copilot / AI
- premium upgrade moments
- selected high-value success states
- rare hero/feature surfaces

Do not place gradients behind normal page backgrounds or every card.

## 5. Core reusable component families

### Shell

- `AppShell`
- `Sidebar`
- `SidebarGroup`
- `SidebarUpgradeCard`
- `Topbar`
- `GlobalSearch`
- `NotificationCenter`
- `LanguageSwitcher`
- `AccountMenu`
- `MobileBottomNav`

Business and Professional use the same shell primitives with different navigation configuration.

### Page composition

- `PageHeader`
- `SectionHeader`
- `SurfaceCard`
- `FeatureCard`
- `MetricGrid`
- `MetricCard`
- `TrendChip`
- `StatusBadge`
- `InsightCard`
- `ChartCard`
- `ActivityCard`

Metric anatomy: **muted label → prominent number/value → optional trend chip → concise explanation**.

### Actions

- `Button` variants: primary, secondary, ghost, danger
- `IconButton`
- `ButtonGroup`
- `SplitButton` only where genuinely useful

All actions share heights, radii, icon sizes and focus behaviour.

### Forms / interaction kit

- `Field`
- `TextInput`
- `NumberInput`
- `CurrencyInput`
- `PercentageInput`
- `DateInput`
- `Textarea`
- `Select`
- `Combobox`
- `MultiSelect`
- `TagInput`
- `Toggle`
- `Checkbox`
- `RadioGroup`
- `Dropzone`
- `FileUpload`
- `ValidationMessage`
- `FormSection`
- `Stepper`

Input states: default, hover, focus, filled, success, error, disabled.

Use contextual leading icons when they improve recognition (email, phone, company, bank, date, VAT). Do not decorate every field unnecessarily.

### Tables / lists

- `DataPageHeader`
- `SummaryMetricStrip`
- `DataTable`
- `DataTableToolbar`
- `TableSearch`
- `TableFilter`
- `TableTabs`
- `TableCheckbox`
- `RowActionMenu`
- `BulkActionBar`
- `Pagination`
- `ColumnPicker`

Rows use disciplined spacing, right-aligned numeric columns, semantic status pills, selected-row states and contextual bulk actions.

For accounting data, available bulk actions must respect immutability rules (e.g. posted entries reverse rather than delete).

### Overlays

- `Modal`
- `Drawer`
- `BottomSheet`
- `ConfirmDialog`
- `ChoiceCard`
- `PlanSelector`

Visual-choice modals may use illustrations and recommended badges. Task modals stay focused and compact.

### Feedback

- `Toast`
- `InlineAlert`
- `ActionNotification`
- `EmptyState`
- `FilteredEmptyState`
- `ErrorState`
- `SuccessState`
- `Skeleton`

Toast anatomy: status icon + strong title + optional supporting copy + dismiss + optional progress timer/action.

Empty state anatomy: visual + clear title + 1–2 lines of guidance + one primary CTA.

### AI / Copilot

- `CopilotCard`
- `CopilotComposer`
- `SuggestedPrompt`
- `CopilotPanel`
- `CopilotInsight`

Copilot should feel embedded in the financial workflow. Suggested prompts are contextual to the current page/data, and the Zuelen gradient is used selectively as its visual signature.

## 6. Navigation behaviour

Desktop sidebar may collapse to icon-only mode. Collapsed items retain tooltips/flyouts. Navigation hierarchy should be shallow and predictable.

Topbar controls share one consistent pattern across Business and Professional:
- global search
- notifications
- language
- account/workspace switcher

Mobile replaces the sidebar with bottom navigation for frequent destinations plus a More menu. Task-heavy flows may become full-screen or bottom-sheet experiences.

## 7. Dashboard composition

Overview pages are command centres, not collections of unrelated cards.

Preferred order:
1. page context / greeting
2. top-line metrics
3. principal chart or financial health view
4. actionable insight / deadline / status
5. recent activity
6. Copilot / intelligent assistance
7. contextual premium upgrade only where relevant

Charts support the insight; they do not compete with the key number.

## 8. Dark mode

Dark mode maps the same semantic tokens to dark surfaces. Do not create a separate visual language.

- preserve hierarchy through surface luminance
- avoid pure black/white extremes
- lower gradient/glow opacity
- semantic status colours stay distinguishable
- borders become subtle light-alpha separators

## 9. Responsive rules

### Desktop ≥ 1180
Multi-column dashboards, persistent/collapsible sidebar, 4-column metric strips where useful.

### Tablet 768–1179
Two-column metrics/content, reduced gutters, sidebar becomes drawer when space is constrained.

### Mobile < 768
Single-column composition, bottom navigation, bottom sheets/full-screen task flows, simplified charts, list cards replacing wide tables when necessary.

Minimum interactive target: 40–44px.

## 10. Illustration language

Illustrations should form one coherent Zuelen family:
- clean geometric/3D-hybrid forms
- off-white/translucent materials
- Zuelen greens + restrained lime highlight
- dark forest accents
- soft shadows/glow
- consistent perspective and lighting
- no childish stock-cartoon aesthetic

Illustrations are appropriate for onboarding choices, document creation, imports, empty states, premium/AI moments and success states. They should explain a concept faster than copy.

## 11. Rollout strategy

1. Foundation tokens/theme + primitives.
2. Business Overview + Professional Overview as reference implementations.
3. Shared shell/navigation consolidation.
4. Transactions and other data tables.
5. Documents/import/create flows and overlays.
6. Forms/onboarding/settings/profile.
7. Billing/plans/team access.
8. Directory/public profiles.
9. Copilot.
10. Mobile-specific composition and final dark-mode/accessibility pass.

Every migrated page should remove page-local duplication when an approved v2 primitive exists.

## 12. Definition of done

A screen is v2-compliant when:
- all colours/spacing/radii come from system tokens
- standard UI is composed from reusable primitives
- light/dark states are intentional
- desktop/tablet/mobile layouts are defined
- focus/hover/error/disabled states exist
- empty/loading/error/success states are designed
- copy is concise and action-oriented
- financial data is truthful and semantically formatted
- Business and Professional versions feel like the same product family
