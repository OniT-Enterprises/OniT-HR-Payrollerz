# HR/Payroll System - UI Style Guide

## Design Philosophy: Refined Professional

A modern, premium HR platform that feels trustworthy and polished:

- **Typography**: Plus Jakarta Sans - geometric, modern, warm personality
- **Colors**: Warm neutrals with confident gradient accents
- **Motion**: Subtle animations that delight without distracting
- **Consistency**: Same patterns across all modules with module-specific accent colors

---

## Typography

We use **Plus Jakarta Sans** loaded from Google Fonts:

```css
font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
```

### Heading Hierarchy

```tsx
// Page title - 4xl, bold, tight tracking
<h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>

// Section title - lg, semibold
<h2 className="text-lg font-semibold">Department Breakdown</h2>

// Card title - uses CardTitle component
<CardTitle className="text-lg">Recent Hires</CardTitle>

// Stat value - 3xl, bold
<p className="text-3xl font-bold tracking-tight">247</p>
```

### Text Colors

```
Primary text (values, titles):  text-foreground
Labels/secondary:               text-muted-foreground
Subtle/tertiary:                text-muted-foreground/70
```

**Never use hardcoded colors** like `text-white`, `text-gray-400`, or `text-gray-900`.

---

## Theme System

### Using the Theme Context

```tsx
import { useTheme } from "@/contexts/ThemeContext";

function MyComponent() {
  const { theme, isDark, toggleTheme, setTheme } = useTheme();

  return (
    <Button onClick={toggleTheme}>
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
```

### Theme Values
- `"light"` - Light mode
- `"dark"` - Dark mode
- `"system"` - Follow system preference

Preference is persisted in localStorage.

---

## Color Palette

### CSS Variables (global.css)

```css
:root {
  /* Warm, refined light mode */
  --background: 40 20% 98%;      /* Warm off-white */
  --foreground: 220 20% 14%;     /* Rich dark text */
  --card: 0 0% 100%;             /* Pure white cards */
  --muted: 220 14% 95%;          /* Subtle backgrounds */
  --muted-foreground: 220 10% 45%;
  --border: 220 13% 90%;
  --primary: 230 75% 52%;        /* Rich blue */
}

.dark {
  /* Rich, deep dark mode */
  --background: 225 25% 8%;      /* Deep blue-gray */
  --foreground: 210 20% 95%;
  --card: 225 20% 11%;
  --muted: 225 15% 16%;
  --muted-foreground: 215 12% 55%;
  --border: 225 15% 18%;
  --primary: 230 75% 62%;
}
```

### Module Gradient Colors

Each module has a signature gradient used for hero sections, buttons, and icons:

| Module | Gradient | Usage |
|--------|----------|-------|
| **Main/Dashboard** | `from-primary to-violet-500` | Primary actions |
| **Hiring** | `from-emerald-500 to-teal-500` | Green/teal theme |
| **Staff** | `from-blue-500 to-indigo-500` | Blue theme |
| **Time & Leave** | `from-cyan-500 to-teal-500` | Cyan theme |
| **Performance** | `from-orange-500 to-amber-500` | Orange theme |
| **Payroll** | `from-green-500 to-emerald-500` | Green theme |
| **Reports** | `from-violet-500 to-purple-500` | Purple theme |

---

## Page Layout

### Hero Section Pattern

Every dashboard page has a hero section with gradient background:

```tsx
{/* Hero Section */}
<div className="relative overflow-hidden border-b border-border/50">
  {/* Background gradient */}
  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5" />

  {/* Floating orb decoration */}
  <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/10 to-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

  <div className="relative px-6 py-8 lg:px-8">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
      {/* Title area */}
      <div className="flex items-start gap-4 animate-fade-up">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-violet-500 shadow-lg shadow-primary/25">
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Section Label</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Page Title</h1>
          <p className="text-muted-foreground">Page description here</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 animate-fade-up stagger-2">
        <Button variant="outline" className="gap-2 shadow-sm">
          <Icon className="h-4 w-4" />
          Secondary Action
        </Button>
        <Button className="gap-2 bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90 text-white shadow-lg shadow-primary/25">
          <Plus className="h-4 w-4" />
          Primary Action
        </Button>
      </div>
    </div>
  </div>
</div>
```

---

## Stat Cards

### Standard Stat Card

```tsx
<Card className="relative overflow-hidden border-border/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
  {/* Background gradient overlay */}
  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 opacity-50" />

  <CardContent className="relative p-6">
    <div className="flex items-start justify-between">
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
        <div className="space-y-1">
          <p className="text-3xl font-bold tracking-tight">247</p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded text-emerald-600 bg-emerald-500/10">
              <ArrowUpRight className="h-3 w-3 mr-0.5" />
              +12%
            </span>
            <span className="text-xs text-muted-foreground">vs last month</span>
          </div>
        </div>
      </div>

      {/* Gradient icon badge */}
      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg">
        <Users className="h-5 w-5 text-white" />
      </div>
    </div>
  </CardContent>
</Card>
```

---

## Cards & Containers

### Standard Card

```tsx
<Card className="border-border/50">
  <CardHeader>
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="text-lg">Card Title</CardTitle>
        <CardDescription>Card description text</CardDescription>
      </div>
      <Badge variant="secondary" className="font-normal">Status</Badge>
    </div>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### List Item Pattern

```tsx
<div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
  {/* Color indicator bar */}
  <div className="w-1 h-12 bg-blue-500 rounded-full" />

  {/* Or icon with background */}
  <div className="p-2.5 rounded-lg bg-blue-500/10">
    <Icon className="h-4 w-4 text-blue-500" />
  </div>

  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium truncate">Item Title</p>
    <p className="text-xs text-muted-foreground truncate">Subtitle text</p>
  </div>

  <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
    Label
  </Badge>
</div>
```

---

## Buttons

### Primary Button (Gradient)

```tsx
<Button className="gap-2 bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90 text-white shadow-lg shadow-primary/25">
  <Plus className="h-4 w-4" />
  Add Employee
</Button>
```

### Module-Specific Primary Button

```tsx
// Hiring module (emerald)
<Button className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25">

// Staff module (blue)
<Button className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/25">
```

### Outline Button

```tsx
<Button variant="outline" className="gap-2 shadow-sm">
  <Download className="h-4 w-4" />
  Export
</Button>
```

### Ghost Button

```tsx
<Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1">
  View All
  <ChevronRight className="h-4 w-4" />
</Button>
```

---

## Quick Action Buttons

```tsx
<button
  onClick={() => navigate(path)}
  className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
>
  <div className="p-3 rounded-xl bg-muted group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-violet-500 transition-all duration-200">
    <Icon className="h-5 w-5 text-muted-foreground group-hover:text-white transition-colors" />
  </div>
  <span className="text-sm font-medium text-foreground">Action Label</span>
</button>
```

---

## Badges

### Status Badges

```tsx
// Success/Complete
<Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
  Complete
</Badge>

// Info/Active
<Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
  Active
</Badge>

// Warning/Pending
<Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
  Pending
</Badge>

// Neutral
<Badge variant="secondary" className="font-normal">
  Label
</Badge>
```

---

## Animations

### Available Animation Classes

```css
.animate-fade-in     /* Fade in */
.animate-fade-up     /* Fade in + slide up */
.animate-scale-in    /* Fade in + scale up */
.animate-slide-in-right
.animate-pulse-subtle
.animate-shimmer
```

### Stagger Animation Delays

Use with animations for sequential reveals:

```tsx
<div className="animate-fade-up stagger-1">First</div>
<div className="animate-fade-up stagger-2">Second</div>
<div className="animate-fade-up stagger-3">Third</div>
// stagger-1 through stagger-6 available
```

### Hover Effects

```tsx
// Lift on hover
<Card className="hover:-translate-y-1 hover:shadow-lg transition-all duration-300">

// Scale on hover
<Avatar className="transition-transform duration-200 group-hover:scale-105">
```

---

## Icon Sizing

| Size | Class | Usage |
|------|-------|-------|
| Tiny | `h-3 w-3` | Inline indicators, change arrows |
| Standard | `h-4 w-4` | Buttons, nav items, badges |
| Medium | `h-5 w-5` | List items, card icons |
| Large | `h-6 w-6` | Hero section icons |
| XL | `h-8 w-8` | Stat cards (inside gradient badge) |
| Hero | `h-12 w-12` | Empty states |

---

## Navigation

### Header Navigation

The main navigation uses a glass-morphism effect:

```tsx
<nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
```

### Dropdown Menus

```tsx
<DropdownMenuContent className="w-56 p-2 bg-popover/95 backdrop-blur-xl border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20 animate-scale-in">
  <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
    <Icon className="h-4 w-4" />
    <span className="font-medium">Menu Item</span>
  </DropdownMenuItem>
</DropdownMenuContent>
```

---

## Progress Bars

```tsx
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span className="font-medium">Engineering</span>
    <span className="text-muted-foreground">45 employees (35%)</span>
  </div>
  <div className="h-2 bg-muted rounded-full overflow-hidden">
    <div
      className="h-full bg-blue-500 rounded-full transition-all duration-500"
      style={{ width: '35%' }}
    />
  </div>
</div>
```

---

## Empty States

```tsx
<div className="text-center py-8">
  <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
  <p className="text-muted-foreground">No employees yet</p>
  <Button variant="link" className="mt-2" onClick={() => navigate("/admin/seed")}>
    Seed database
  </Button>
</div>
```

---

## Loading States

```tsx
<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
  <div className="relative">
    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-violet-500/20 rounded-full blur-2xl animate-pulse" />
    <Loader2 className="h-12 w-12 animate-spin text-primary relative" />
  </div>
  <p className="text-muted-foreground animate-pulse">Loading dashboard...</p>
</div>
```

---

## Subpage Pattern

Subpages (forms, detail views, secondary pages) use a constrained width layout with a colored hero section. The hero uses the **module's gradient colors** for consistency.

### Full Subpage Template

```tsx
export default function SubpageName() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Hero Section - Uses module gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500">
        {/* Decorative orb */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-400/20 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2" />

        <div className="relative max-w-5xl mx-auto px-6 py-12">
          <AutoBreadcrumb className="mb-6 text-white/70 [&_a]:text-white/70 [&_a:hover]:text-white" />

          <div className="flex items-center gap-4 animate-fade-up">
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
              <PageIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Page Title</h1>
              <p className="text-emerald-100 mt-1">Page subtitle or description</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Constrained width */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Cards for form sections */}
        <Card className="border-border/50 animate-fade-up stagger-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                <SectionIcon className="h-5 w-5 text-emerald-600" />
              </div>
              Section Title
            </CardTitle>
            <CardDescription>Section description</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Form fields, content, etc. */}
          </CardContent>
        </Card>

        {/* Gradient submit button */}
        <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25">
          Submit Action
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

### Module-Specific Hero Gradients

Each module uses its signature colors for subpage heroes:

| Module | Hero Gradient | Text Color | Icon BG | Button Gradient |
|--------|---------------|------------|---------|-----------------|
| **Hiring** | `from-emerald-600 via-emerald-500 to-teal-500` | `text-emerald-100` | `bg-white/10` | `from-emerald-500 to-teal-500` |
| **Staff** | `from-blue-600 via-blue-500 to-indigo-500` | `text-blue-100` | `bg-white/10` | `from-blue-500 to-indigo-500` |
| **Time & Leave** | `from-cyan-600 via-cyan-500 to-teal-500` | `text-cyan-100` | `bg-white/10` | `from-cyan-500 to-teal-500` |
| **Performance** | `from-orange-600 via-orange-500 to-amber-500` | `text-orange-100` | `bg-white/10` | `from-orange-500 to-amber-500` |
| **Payroll** | `from-green-600 via-green-500 to-emerald-500` | `text-green-100` | `bg-white/10` | `from-green-500 to-emerald-500` |
| **Reports** | `from-violet-600 via-violet-500 to-purple-500` | `text-violet-100` | `bg-white/10` | `from-violet-500 to-purple-500` |

### Subpage Key Patterns

1. **Max Width**: Use `max-w-5xl` or `max-w-6xl` for constrained content
2. **Hero Breadcrumb**: Style breadcrumbs for visibility on colored backgrounds
3. **Card Section Icons**: Wrap section icons in gradient background div
4. **Form Labels with Icons**: Add small icons to labels for visual clarity
5. **Gradient Buttons**: Match button gradients to module colors
6. **Border Styling**: Use `border-border/50` for subtle card borders
7. **Input Styling**: Add `border-border/50` class to inputs
8. **Animations**: Use `animate-fade-up` with stagger classes

### Form Field with Icon Label

```tsx
<div className="space-y-2">
  <Label htmlFor="fieldName" className="flex items-center gap-2">
    <FieldIcon className="h-4 w-4 text-muted-foreground" />
    Field Label
  </Label>
  <Input
    id="fieldName"
    className="border-border/50"
    placeholder="Placeholder text"
  />
</div>
```

### File Upload Area

```tsx
<div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-emerald-300 transition-colors cursor-pointer bg-muted/30">
  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
  <input type="file" className="hidden" id="fileUpload" />
  <label htmlFor="fileUpload" className="cursor-pointer">
    <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
    <p className="text-xs text-muted-foreground/70">PDF, JPG, PNG up to 10MB</p>
  </label>
</div>
```

### Checkbox with Theme Styling

```tsx
<Checkbox
  id="checkboxId"
  className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
/>
```

---

## Quick Reference

### DO
- Use `text-foreground` for primary text
- Use `text-muted-foreground` for secondary text
- Use `bg-background` and `bg-card` for surfaces
- Use `border-border/50` for subtle borders
- Use gradient buttons for primary actions
- Use `animate-fade-up` with stagger classes for page loads
- Use `transition-all duration-300` for smooth interactions

### DON'T
- Never use hardcoded colors like `bg-gray-900`, `text-white`
- Never use `bg-gray-50` - use `bg-background` or `bg-muted`
- Never skip the hero section pattern on dashboard pages
- Never use plain colored icons - wrap in gradient badge or use muted color
- Never forget hover states on interactive elements
