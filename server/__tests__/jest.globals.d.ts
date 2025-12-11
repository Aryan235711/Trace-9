// Jest setup file - provides global type definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toEqual(expected: any): R;
      toBe(expected: any): R;
      toBeTruthy(): R;
      toBeFalsy(): R;
      toBeGreaterThan(expected: number): R;
      toBeNull(): R;
      toBeDefined(): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledWith(...args: any[]): R;
      not: Matchers<R>;
    }
  }
}

export {};
