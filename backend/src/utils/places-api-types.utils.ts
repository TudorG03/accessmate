import { readJSON } from "./file.utils.ts";
import { join } from "https://deno.land/std/path/mod.ts";

// Path to the JSON file containing supported place types
const TYPES_FILE_PATH = join(
  Deno.cwd(),
  "src",
  "models",
  "activity",
  "google_places_supported_types.json",
);

// Interface for type records with formatted names
interface PlaceTypeRecord {
  value: string; // Original value (e.g., "accounting")
  label: string; // Formatted label (e.g., "Accounting")
}

/**
 * Loads all supported Google Places types from the JSON file
 * @returns Array of raw type strings
 */
export async function loadPlaceTypes(): Promise<string[]> {
  try {
    return await readJSON(TYPES_FILE_PATH);
  } catch (error) {
    console.error("Error loading place types:", error);
    return [];
  }
}

/**
 * Formats a place type string to be more readable
 * @param type The place type string (e.g., "night_club")
 * @returns Formatted string with first letter capitalized and spaces (e.g., "Night club")
 */
export function formatPlaceType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Gets all place types with both raw values and formatted labels
 * @returns Array of objects with value and label properties
 */
export async function getFormattedPlaceTypes(): Promise<PlaceTypeRecord[]> {
  const types = await loadPlaceTypes();

  return types.map((type) => ({
    value: type,
    label: formatPlaceType(type),
  }));
}

/**
 * Gets all place types as formatted strings
 * @returns Array of formatted place type strings
 */
export async function getFormattedPlaceTypeStrings(): Promise<string[]> {
  const types = await loadPlaceTypes();
  return types.map(formatPlaceType);
}
