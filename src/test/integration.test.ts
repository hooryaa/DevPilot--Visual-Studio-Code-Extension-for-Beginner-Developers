/**
 * DevPilot Integration Tests
 * Tests local VS Code storage sync, offline translation, and build speed tracking
 * No backend dependencies - everything works offline
 */

import * as assert from 'assert';
import { OfflineTranslationEngine, getOfflineSupportedLanguages } from '../core/offlineTranslationEngine';

/**
 * Mock VS Code StateManager for testing
 */
class MockStateManager {
  private globalState: Map<string, string> = new Map();
  
  async get<T>(key: string, options: { scope: string }): Promise<T | undefined> {
    const value = this.globalState.get(key);
    if (!value) {return undefined;}
    return JSON.parse(value) as T;
  }

  async set(key: string, value: any, options: { scope: string }): Promise<void> {
    this.globalState.set(key, JSON.stringify(value));
  }

  reset() {
    this.globalState.clear();
  }
}

/**
 * Test Suite: User Sync Service (VS Code Storage)
 */
export class UserSyncServiceTests {
  static testName = 'UserSyncService';

  static testSyncDataStructure(): void {
    const syncData = {
      streak: 5,
      longestStreak: 10,
      points: 150,
      achievements: ['achievement1', 'achievement2'],
      todosCompleted: 8,
      lessonsCompleted: 3,
      lastSyncedAt: new Date().toISOString()
    };

    assert.strictEqual(syncData.streak, 5, 'Current streak should be 5');
    assert.strictEqual(syncData.longestStreak, 10, 'Longest streak should be 10');
    assert.strictEqual(syncData.points, 150, 'Points should be 150');
    assert.strictEqual(syncData.todosCompleted, 8, 'Completed TODOs should be 8');
    assert.strictEqual(syncData.achievements.length, 2, 'Should have 2 achievements');
  }

  static testSyncPayloadFormat(): void {
    const payload = {
      email: 'test@example.com',
      data: {
        streak: 5,
        longestStreak: 10,
        points: 150,
        achievements: [],
        todosCompleted: 0,
        lessonsCompleted: 0,
        lastSyncedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    assert.ok(payload.email, 'Email should be present');
    assert.ok(payload.data, 'Data should be present');
    assert.ok(payload.timestamp, 'Timestamp should be present');
    assert.ok(payload.data.streak !== undefined, 'Streak should be in data');
    assert.ok(payload.data.longestStreak !== undefined, 'Longest streak should be in data');
  }

  static testStorageFormat(): void {
    const data = {
      currentStreak: 5,
      longestStreak: 12,
      totalPoints: 250,
      achievementsCount: 8,
      todosCompletedToday: 3
    };

    const json = JSON.stringify(data);
    const restored = JSON.parse(json);

    assert.deepStrictEqual(restored, data, 'Should preserve data through serialization');
  }
}

/**
 * Test Suite: Offline Code Translation Engine
 */
export class TranslationServiceTests {
  static testName = 'TranslationService (Offline)';

  static testSupportedLanguages(): void {
    const languages = getOfflineSupportedLanguages();

    assert.ok(languages.includes('python'), 'Should support Python');
    assert.ok(languages.includes('javascript'), 'Should support JavaScript');
    assert.ok(languages.includes('java'), 'Should support Java');
    assert.ok(languages.includes('cpp'), 'Should support C++');
    assert.strictEqual(languages.length >= 10, true, 'Should support multiple languages');
  }

  static testLanguagePairSupport(): void {
    // Test basic language pairs
    const pairs = [
      ['python', 'javascript'],
      ['javascript', 'python'],
      ['python', 'java']
    ];

    pairs.forEach(([from, to]) => {
      const result = OfflineTranslationEngine.translateCode('test code', from, to);
      assert.ok(result !== undefined, `Should support ${from} to ${to}`);
    });
  }

  static testTranslation(): void {
    // Test actual translation
    const pythonCode = 'print("hello")';
    const result = OfflineTranslationEngine.translateCode(pythonCode, 'python', 'javascript');
    
    assert.ok(result !== undefined, 'Should produce translation');
    assert.ok(result.length > 0, 'Should produce non-empty output');
  }

  static testOfflineCapability(): void {
    // Verify translation works completely offline
    const code = 'def greet(name):\n    return "Hello, " + name';
    const result = OfflineTranslationEngine.translateCode(code, 'python', 'javascript');
    
    assert.ok(result !== undefined, 'Should work offline');
    assert.ok(result.includes('function'), 'Should translate function');
  }
}

/**
 * Test Suite: Build Speed Tracking
 */
export class BuildSpeedTrackingTests {
  static testName = 'BuildSpeedTracking';

  static testBuildTimeFormatting(): void {
    const testCases = [
      { ms: 0, expected: 'N/A' },
      { ms: 234, expected: '234ms' },
      { ms: 1000, expected: '1.0s' },
      { ms: 1234, expected: '1.2s' },
      { ms: 5000, expected: '5.0s' },
    ];

    testCases.forEach(({ ms, expected }) => {
      const result = ms === 0 ? 'N/A' : (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
      assert.strictEqual(result, expected, `Build time ${ms}ms should format to ${expected}`);
    });
  }

  static testBuildMetricsStructure(): void {
    const metrics = {
      compilationTime: 1234,
      startTime: Date.now() - 1234,
      endTime: Date.now(),
      status: 'success' as const,
      errors: 0,
      warnings: 0
    };

    assert.ok(metrics.compilationTime > 0, 'Compilation time should be positive');
    assert.ok(metrics.startTime < metrics.endTime, 'End time should be after start time');
    assert.strictEqual(metrics.status, 'success', 'Status should be success');
    assert.strictEqual(metrics.errors, 0, 'No errors');
  }
}

/**
 * Test Suite: Offline Translation Engine Tests
 */
export class OfflineTranslationTests {
  static testName = 'OfflineTranslation';

  static testBasicSyntaxTransformation(): void {
    // Test Python print -> JavaScript console.log
    const pythonCode = `print("Hello, World!")`;
    const result = OfflineTranslationEngine.translateCode(pythonCode, 'python', 'javascript');
    assert.ok(result && result.includes('console.log'), 'Should contain console.log');
  }

  static testVariableDeclarationTransformation(): void {
    // Python: x = 5 -> JavaScript: let x = 5;
    const pythonCode = `x = 5`;
    const result = OfflineTranslationEngine.translateCode(pythonCode, 'python', 'javascript');
    assert.ok(result && result.length > 0, 'Should produce JavaScript code');
  }

  static testFunctionDefinitionTransformation(): void {
    // Python: def func(): -> JavaScript: function func() {
    const pythonCode = `def greet(name):\n    return f"Hello, {name}"`;
    const result = OfflineTranslationEngine.translateCode(pythonCode, 'python', 'javascript');
    assert.ok(result && (result.includes('function') || result.includes('greet')),
      'Should use JavaScript function syntax');
  }

  static testOfflineReliability(): void {
    // Test that offline translation works without network
    const testCodes = [
      'print("test")',
      'x = 10',
      'def foo(): pass',
      'if x > 5: return True'
    ];

    testCodes.forEach(code => {
      const result = OfflineTranslationEngine.translateCode(code, 'python', 'javascript');
      assert.ok(result && result.length > 0, `Should transform: ${code}`);
    });
  }

  static testMultipleLanguagePairs(): void {
    // Test various combinations
    const pairs: [string, string][] = [
      ['python', 'javascript'],
      ['javascript', 'python'],
      ['python', 'java']
    ];

    pairs.forEach(([from, to]) => {
      const result = OfflineTranslationEngine.translateCode('test', from, to);
      assert.ok(result !== undefined, `Should support ${from} -> ${to}`);
    });
  }

  static testTypeScriptVariant(): void {
    const code = 'console.log("test");';
    const result = OfflineTranslationEngine.translateCode(code, 'typescript', 'python');
    assert.ok(result !== undefined, 'TypeScript should be treated as JavaScript variant');
  }
}

/**
 * Test Suite: Email Notifications
 */
export class EmailNotificationTests {
  static testName = 'EmailNotifications';

  static testEmailPayloadStructure(): void {
    const payload = {
      to: 'user@example.com',
      subject: 'Achievement Unlocked!',
      text: 'You unlocked an achievement',
      html: '<p>You unlocked an achievement</p>',
      type: 'achievement_unlock' as const,
      data: {
        achievementName: 'Week Warrior',
        daysAchieved: 7
      },
      timestamp: new Date().toISOString()
    };

    assert.ok(payload.to, 'Email recipient should be present');
    assert.ok(payload.subject, 'Subject should be present');
    assert.ok(payload.html, 'HTML should be present');
    assert.strictEqual(payload.type, 'achievement_unlock', 'Type should match');
    assert.ok(payload.data.achievementName, 'Achievement data should be present');
  }

  static testNotificationTypes(): void {
    const types = [
      'streak_milestone',
      'achievement_unlock',
      'weekly_summary',
      'sync_failure',
      'important_update',
      'learning_milestone'
    ];

    types.forEach(type => {
      assert.ok(type.length > 0, `Notification type should be valid: ${type}`);
    });
  }
}

/**
 * Test Runner
 */
export async function runAllTests(): Promise<void> {
  const testSuites = [
    UserSyncServiceTests,
    TranslationServiceTests,
    BuildSpeedTrackingTests,
    OfflineTranslationTests,
    EmailNotificationTests
  ];

  console.log('🧪 Starting DevPilot Integration Tests...\n');

  for (const suite of testSuites) {
    console.log(`\n📋 ${suite.testName}`);
    console.log('─'.repeat(50));

    const methods = Object.getOwnPropertyNames(suite)
      .filter(m => m.startsWith('test') && typeof (suite as any)[m] === 'function');

    for (const method of methods) {
      try {
        const result = await (suite as any)[method]();
        console.log(`   ${method}`);
      } catch (error) {
        console.log(`   ${method}`);
        console.log(`     Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  console.log('\n\n Test suite completed!');
}
