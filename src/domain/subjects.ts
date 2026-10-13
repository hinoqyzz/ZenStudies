export const SUBJECT_COLORS = [
  { value: "#6558E8", label: "Violeta" },
  { value: "#73D8B2", label: "Menta" },
  { value: "#E0B56D", label: "Âmbar" },
  { value: "#187A58", label: "Verde" },
  { value: "#101C1A", label: "Tinta" },
] as const;

export function subjectColorLabel(value: string): string {
  return SUBJECT_COLORS.find((color) => color.value.toLowerCase() === value.toLowerCase())?.label ?? "Cor personalizada";
}

export function isPaletteColor(value: string): boolean {
  return SUBJECT_COLORS.some((color) => color.value.toLowerCase() === value.toLowerCase());
}
