/**
 * Reads and parses a JSON file
 * @param filePath Path to the JSON file
 * @returns Parsed JSON content
 */
export async function readJSON<T>(filePath: string): Promise<T> {
  try {
    const text = await Deno.readTextFile(filePath);
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Writes data to a JSON file
 * @param filePath Path to the JSON file
 * @param data Data to write
 */
export async function writeJSON(
  filePath: string,
  data: unknown,
): Promise<void> {
  try {
    const text = JSON.stringify(data, null, 2);
    await Deno.writeTextFile(filePath, text);
  } catch (error) {
    console.error(`Error writing JSON file ${filePath}:`, error);
    throw error;
  }
}
