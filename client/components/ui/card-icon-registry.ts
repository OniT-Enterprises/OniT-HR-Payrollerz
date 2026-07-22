const raw = import.meta.glob("../../assets/card-icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const icons: Record<string, string> = {};
for (const [path, svg] of Object.entries(raw)) {
  const name = path
    .split("/")
    .pop()!
    .replace(/\.svg$/, "");
  icons[name] = svg;
}

export function hasCardIcon(name?: string | null): boolean {
  return !!name && name in icons;
}

export function getCardIconSvg(name: string): string | undefined {
  return icons[name];
}
