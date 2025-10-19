/**
 * Parses a value into a boolean.
 * Accepts boolean values and string representations of booleans ("true", "false").
 * Returns false for any other input.
 *
 * @param value - The value to parse.
 * @returns The parsed boolean value.
 */
export const parseBoolean = (value: any): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
};
