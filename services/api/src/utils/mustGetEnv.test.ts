import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mustGetEnv } from './mustGetEnv.js';

describe('mustGetEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should return the environment variable if present', () => {
    process.env.TEST_VAR = 'hello';
    const result = mustGetEnv('TEST_VAR');
    expect(result).toBe('hello');
  });

  it('should throw an error if the environment variable is missing', () => {
    delete process.env.TEST_VAR;
    expect(() => mustGetEnv('TEST_VAR')).toThrow(
      'Environment variable "TEST_VAR" is required but was not found or is empty.'
    );
  });

  it('should throw an error if the environment variable is empty string', () => {
    process.env.TEST_VAR = '';
    expect(() => mustGetEnv('TEST_VAR')).toThrow(
      'Environment variable "TEST_VAR" is required but was not found or is empty.'
    );
  });

  it('should throw an error if the environment variable contains only spaces', () => {
    process.env.TEST_VAR = '   ';
    expect(() => mustGetEnv('TEST_VAR')).toThrow(
      'Environment variable "TEST_VAR" is required but was not found or is empty.'
    );
  });
});
