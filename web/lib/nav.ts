/**
 * Top-level navigation items.
 * Order defines appearance in the site header.
 * Matches the 10-route IA from DASHBOARD_DESIGN.md §2.
 */
export const NAV_ITEMS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/models", label: "Models" },
  { href: "/battles", label: "Battles" },
  { href: "/dataset", label: "Dataset" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
