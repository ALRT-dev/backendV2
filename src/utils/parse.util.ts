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

/**
 * Parses a value into an array.
 * If the value is already an array, returns it as-is.
 * If the value is a single item, wraps it in an array.
 * If the value is undefined/null, returns an empty array.
 *
 * @param value - The value to parse into an array.
 * @returns An array containing the parsed values.
 */
export const parseArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value !== undefined && value !== null) {
    return [value];
  }
  return [];
};
