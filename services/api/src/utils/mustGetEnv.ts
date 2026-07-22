/**
 * Retrieves the value of an environment variable.
 * Throws an error if the variable is missing or empty.
 *
 * @param name The name of the environment variable.
 * @returns The value of the environment variable.
 */
export function mustGetEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Environment variable "${name}" is required but was not found or is empty.`);
  }
  return value;
}
