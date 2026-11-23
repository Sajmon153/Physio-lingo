/**
 * tests/e2e/harness/testContext.ts
 * Asynchronous E2E Test Suite Runner, Lifecycle Hooks, Assertion Utilities & ANSI Reporter
 */

export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: Error;
}

export interface SuiteResult {
  name: string;
  tier: string;
  tests: TestResult[];
  durationMs: number;
  passed: boolean;
}

export interface RunnerSummary {
  suites: SuiteResult[];
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalDurationMs: number;
  passed: boolean;
}

type TestFn = () => void | Promise<void>;

interface PendingTest {
  name: string;
  fn: TestFn;
}

interface PendingSuite {
  name: string;
  tier: string;
  tests: PendingTest[];
}

class TestRegistry {
  private suites: PendingSuite[] = [];
  private currentSuite: PendingSuite | null = null;
  private currentTier = 'General';

  public setTier(tier: string): void {
    this.currentTier = tier;
  }

  public getTier(): string {
    return this.currentTier;
  }

  public registerSuite(name: string, fn: () => void | Promise<void>): void {
    const suite: PendingSuite = {
      name,
      tier: this.currentTier,
      tests: [],
    };
    this.suites.push(suite);
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    try {
      const res = fn();
      if (res && typeof (res as any).then === 'function') {
        throw new Error(`Synchronous suite callback expected in describe("${name}")`);
      }
    } finally {
      this.currentSuite = prevSuite;
    }
  }

  public registerTest(name: string, fn: TestFn): void {
    if (!this.currentSuite) {
      // Create an implicit suite if describe was omitted
      this.registerSuite('Default Suite', () => {
        this.currentSuite!.tests.push({ name, fn });
      });
      return;
    }
    this.currentSuite.tests.push({ name, fn });
  }

  public getSuites(): PendingSuite[] {
    return this.suites;
  }

  public clear(): void {
    this.suites = [];
    this.currentSuite = null;
  }
}

export const registry = new TestRegistry();

export function setTestTier(tier: string): void {
  registry.setTier(tier);
}

export function describe(name: string, fn: () => void): void {
  registry.registerSuite(name, fn);
}

export function it(name: string, fn: TestFn): void {
  registry.registerTest(name, fn);
}

export const test = it;

// ============================================================================
// ASSERTION UTILITIES
// ============================================================================

export function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
    );
  }
}

export function assertNotEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual === expected) {
    throw new Error(
      message || `Expected values not to equal: ${JSON.stringify(actual)}`
    );
  }
}

export function assertDeepEqual(actual: any, expected: any, message?: string): void {
  const aStr = JSON.stringify(actual);
  const eStr = JSON.stringify(expected);
  if (aStr !== eStr) {
    throw new Error(
      message || `Deep equality mismatch:\nExpected: ${eStr}\nActual:   ${aStr}`
    );
  }
}

export function assertThrows(fn: () => void, expected?: RegExp | string, message?: string): void {
  let threw = false;
  let error: any;
  try {
    fn();
  } catch (err: any) {
    threw = true;
    error = err;
  }
  if (!threw) {
    throw new Error(message || 'Expected function to throw an error, but it succeeded.');
  }
  if (expected) {
    const errText = error ? String(error.message || error) : '';
    if (typeof expected === 'string' && !errText.includes(expected)) {
      throw new Error(`Expected error containing "${expected}", got: "${errText}"`);
    } else if (expected instanceof RegExp && !expected.test(errText)) {
      throw new Error(`Expected error matching ${expected}, got: "${errText}"`);
    }
  }
}

export async function assertRejects(
  fn: () => Promise<void>,
  expected?: RegExp | string,
  message?: string
): Promise<void> {
  let threw = false;
  let error: any;
  try {
    await fn();
  } catch (err: any) {
    threw = true;
    error = err;
  }
  if (!threw) {
    throw new Error(message || 'Expected promise to reject, but it resolved.');
  }
  if (expected) {
    const errText = error ? String(error.message || error) : '';
    if (typeof expected === 'string' && !errText.includes(expected)) {
      throw new Error(`Expected rejection containing "${expected}", got: "${errText}"`);
    } else if (expected instanceof RegExp && !expected.test(errText)) {
      throw new Error(`Expected rejection matching ${expected}, got: "${errText}"`);
    }
  }
}

export function expect(actual: any) {
  return {
    toBe(expected: any, msg?: string) {
      assertEqual(actual, expected, msg);
    },
    toEqual(expected: any, msg?: string) {
      assertDeepEqual(actual, expected, msg);
    },
    toBeTruthy(msg?: string) {
      assert(!!actual, msg || `Expected truthy, got ${actual}`);
    },
    toBeFalsy(msg?: string) {
      assert(!actual, msg || `Expected falsy, got ${actual}`);
    },
    toBeUndefined(msg?: string) {
      assertEqual(actual, undefined, msg || `Expected undefined, got ${actual}`);
    },
    toBeGreaterThan(expected: number, msg?: string) {
      assert(
        typeof actual === 'number' && actual > expected,
        msg || `Expected ${actual} > ${expected}`
      );
    },
    toBeLessThan(expected: number, msg?: string) {
      assert(
        typeof actual === 'number' && actual < expected,
        msg || `Expected ${actual} < ${expected}`
      );
    },
    toBeGreaterThanOrEqual(expected: number, msg?: string) {
      assert(
        typeof actual === 'number' && actual >= expected,
        msg || `Expected ${actual} >= ${expected}`
      );
    },
    toBeLessThanOrEqual(expected: number, msg?: string) {
      assert(
        typeof actual === 'number' && actual <= expected,
        msg || `Expected ${actual} <= ${expected}`
      );
    },
    toHaveLength(expected: number, msg?: string) {
      const len = actual?.length ?? (actual?.size !== undefined ? actual.size : undefined);
      assert(
        len === expected,
        msg || `Expected length ${expected}, got ${len}`
      );
    },
    toContain(expected: any, msg?: string) {
      if (Array.isArray(actual) || typeof actual === 'string') {
        assert(actual.includes(expected), msg || `Expected collection to contain ${expected}`);
      } else {
        throw new Error(`toContain requires array or string, got ${typeof actual}`);
      }
    },
    toMatch(regex: RegExp, msg?: string) {
      assert(
        typeof actual === 'string' && regex.test(actual),
        msg || `Expected "${actual}" to match ${regex}`
      );
    },
    toThrow(expected?: RegExp | string, msg?: string) {
      if (typeof actual !== 'function') throw new Error('toThrow requires a function');
      assertThrows(actual, expected, msg);
    },
    toBeDefined(msg?: string) {
      assert(actual !== undefined, msg || 'Expected defined, got undefined');
    },
    toBeNull(msg?: string) {
      assertEqual(actual, null, msg);
    },
    not: {
      toBe(expected: any, msg?: string) {
        assertNotEqual(actual, expected, msg);
      },
      toEqual(expected: any, msg?: string) {
        let threw = false;
        try {
          assertDeepEqual(actual, expected);
        } catch {
          threw = true;
        }
        assert(threw, msg || `Expected deep equality mismatch with ${JSON.stringify(expected)}`);
      },
      toContain(expected: any, msg?: string) {
        if (Array.isArray(actual) || typeof actual === 'string') {
          assert(!actual.includes(expected), msg || `Expected collection NOT to contain ${expected}`);
        }
      },
      toHaveLength(expected: number, msg?: string) {
        const len = actual?.length ?? (actual?.size !== undefined ? actual.size : undefined);
        assert(
          len !== expected,
          msg || `Expected length NOT to be ${expected}, got ${len}`
        );
      },
      toThrow(expected?: RegExp | string, msg?: string) {
        if (typeof actual !== 'function') throw new Error('toThrow requires a function');
        let threw = false;
        let err: any;
        try {
          actual();
        } catch (e) {
          threw = true;
          err = e;
        }
        assert(!threw, msg || `Expected function not to throw, but it threw: ${err?.message || err}`);
      },
      toBeUndefined(msg?: string) {
        assertNotEqual(actual, undefined, msg);
      },
      toBeDefined(msg?: string) {
        assertEqual(actual, undefined, msg);
      },
    },
  };
}

// ============================================================================
// ANSI STYLING & TERMINAL REPORTING
// ============================================================================

export const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgBlue: '\x1b[44m',
};

export async function runRegisteredSuites(verbose = true): Promise<RunnerSummary> {
  const suites = registry.getSuites();
  const suiteResults: SuiteResult[] = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  const startGlobal = performance.now();

  for (const s of suites) {
    if (verbose) {
      console.log(`\n${ANSI.bold}${ANSI.green}[${s.tier}] ${s.name}${ANSI.reset}`);
    }
    const testResults: TestResult[] = [];
    let suitePassed = true;
    const startSuite = performance.now();

    for (const t of s.tests) {
      totalTests++;
      const startTest = performance.now();
      let passed = true;
      let error: Error | undefined;

      try {
        await t.fn();
        totalPassed++;
      } catch (err: any) {
        passed = false;
        suitePassed = false;
        totalFailed++;
        error = err instanceof Error ? err : new Error(String(err));
      }

      const durationMs = Math.round(performance.now() - startTest);
      testResults.push({ name: t.name, passed, durationMs, error });

      if (verbose) {
        if (passed) {
          console.log(`  ${ANSI.green}✓${ANSI.reset} ${t.name} ${ANSI.dim}(${durationMs}ms)${ANSI.reset}`);
        } else {
          console.log(`  ${ANSI.red}✗ ${t.name} (${durationMs}ms)${ANSI.reset}`);
          if (error) {
            const indented = (error.stack || error.message)
              .split('\n')
              .map((line) => `      ${ANSI.red}${line}${ANSI.reset}`)
              .join('\n');
            console.log(indented);
          }
        }
      }
    }

    const durationSuiteMs = Math.round(performance.now() - startSuite);
    suiteResults.push({
      name: s.name,
      tier: s.tier,
      tests: testResults,
      durationMs: durationSuiteMs,
      passed: suitePassed,
    });
  }

  const totalDurationMs = Math.round(performance.now() - startGlobal);
  const allPassed = totalFailed === 0 && totalTests > 0;

  return {
    suites: suiteResults,
    totalTests,
    totalPassed,
    totalFailed,
    totalDurationMs,
    passed: allPassed,
  };
}

export function printSummaryTable(summary: RunnerSummary): void {
  console.log('\n' + '='.repeat(80));
  console.log(
    `${ANSI.bold}E2E TEST SUITE EXECUTION SUMMARY${ANSI.reset} — Fizjolingo Production Validation`
  );
  console.log('='.repeat(80));

  // Group by Tier
  const tierMap = new Map<string, SuiteResult[]>();
  for (const s of summary.suites) {
    const list = tierMap.get(s.tier) || [];
    list.push(s);
    tierMap.set(s.tier, list);
  }

  console.log(
    `\n${ANSI.bold}%-30s %-12s %-10s %-10s %-12s${ANSI.reset}`
      .replace('%-30s', 'Suite Name'.padEnd(36))
      .replace('%-12s', 'Tier'.padEnd(14))
      .replace('%-10s', 'Tests'.padEnd(10))
      .replace('%-10s', 'Pass/Fail'.padEnd(12))
      .replace('%-12s', 'Duration')
  );
  console.log('-'.repeat(80));

  for (const [tier, list] of tierMap.entries()) {
    for (const s of list) {
      const passCount = s.tests.filter((t) => t.passed).length;
      const failCount = s.tests.length - passCount;
      const passRatio = failCount === 0
        ? `${ANSI.green}${passCount}/${s.tests.length} pass${ANSI.reset}`
        : `${ANSI.red}${passCount}/${s.tests.length} (${failCount} fail)${ANSI.reset}`;
      const statusIcon = s.passed ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.red}✗${ANSI.reset}`;

      console.log(
        `${statusIcon} ${s.name.padEnd(34)} ${tier.padEnd(14)} ${String(s.tests.length).padEnd(10)} ${passRatio.padEnd(20)} ${s.durationMs}ms`
      );
    }
  }

  console.log('-'.repeat(80));
  const finalBadge = summary.passed
    ? `${ANSI.bgGreen}${ANSI.bold} ALL PASS ${ANSI.reset} ${ANSI.green}100% of requirement test cases passed!${ANSI.reset}`
    : `${ANSI.bgRed}${ANSI.bold} FAILURE ${ANSI.reset} ${ANSI.red}${summary.totalFailed} test(s) failed!${ANSI.reset}`;

  console.log(
    `Total Tests: ${summary.totalTests} | Passed: ${ANSI.green}${summary.totalPassed}${ANSI.reset} | Failed: ${summary.totalFailed > 0 ? ANSI.red : ANSI.dim}${summary.totalFailed}${ANSI.reset} | Duration: ${summary.totalDurationMs}ms`
  );
  console.log(finalBadge);
  console.log('='.repeat(80) + '\n');
}
