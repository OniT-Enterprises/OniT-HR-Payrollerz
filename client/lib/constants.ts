/** Map nationality string to emoji flag. Falls back to empty string. */
export const NATIONALITY_FLAGS: Record<string, string> = {
  "Timor-Leste": "\u{1F1F9}\u{1F1F1}",
  "East Timor": "\u{1F1F9}\u{1F1F1}",
  "Timor Leste": "\u{1F1F9}\u{1F1F1}",
  "Portugal": "\u{1F1F5}\u{1F1F9}",
  "Australia": "\u{1F1E6}\u{1F1FA}",
  "Indonesia": "\u{1F1EE}\u{1F1E9}",
  "China": "\u{1F1E8}\u{1F1F3}",
  "Philippines": "\u{1F1F5}\u{1F1ED}",
  "Brazil": "\u{1F1E7}\u{1F1F7}",
  "India": "\u{1F1EE}\u{1F1F3}",
  "Japan": "\u{1F1EF}\u{1F1F5}",
  "Malaysia": "\u{1F1F2}\u{1F1FE}",
  "New Zealand": "\u{1F1F3}\u{1F1FF}",
  "Singapore": "\u{1F1F8}\u{1F1EC}",
  "South Korea": "\u{1F1F0}\u{1F1F7}",
  "Korea": "\u{1F1F0}\u{1F1F7}",
  "Thailand": "\u{1F1F9}\u{1F1ED}",
  "United Kingdom": "\u{1F1EC}\u{1F1E7}",
  "UK": "\u{1F1EC}\u{1F1E7}",
  "United States": "\u{1F1FA}\u{1F1F8}",
  "USA": "\u{1F1FA}\u{1F1F8}",
  "Vietnam": "\u{1F1FB}\u{1F1F3}",
};

/**
 * Ordered nationality options for dropdowns.
 * Timor-Leste first (default), then common regional countries, then alphabetical rest, then Other.
 */
export const NATIONALITY_OPTIONS = [
  "Timor-Leste",
  "Portugal",
  "Australia",
  "Indonesia",
  "China",
  "Philippines",
  // Alphabetical remaining
  "Brazil",
  "India",
  "Japan",
  "Malaysia",
  "New Zealand",
  "Singapore",
  "South Korea",
  "Thailand",
  "United Kingdom",
  "United States",
  "Vietnam",
  "Other",
] as const;
