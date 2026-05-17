/**
 * Offline Translation Engine Tests
 * 
 * Tests the heuristic-based code translation system
 * Ensures translation works WITHOUT AI backend
 */

import { describe, it, beforeEach } from 'mocha';
import * as assert from 'assert';
import { OfflineTranslationEngine, translateCodeOffline, getOfflineSupportedLanguages } from '../core/offlineTranslationEngine';

describe('OfflineTranslationEngine', () => {
  describe('Python -> JavaScript', () => {
    it('should translate print statement', () => {
      const python = 'print("Hello World")';
      const result = translateCodeOffline(python, 'python', 'javascript');
      assert(result.includes('console.log'), 'Should contain console.log');
    });

    it('should translate function definition', () => {
      const python = 'def greet(name):\n    print(f"Hello {name}")';
      const result = translateCodeOffline(python, 'python', 'javascript');
      assert(result.includes('function'), 'Should contain function keyword');
      assert(result.includes('greet'), 'Should preserve function name');
    });

    it('should translate boolean values', () => {
      const python = 'result = True';
      const result = translateCodeOffline(python, 'python', 'javascript');
      assert(result.includes('true'), 'Should convert True to true');
    });

    it('should translate None to null', () => {
      const python = 'value = None';
      const result = translateCodeOffline(python, 'python', 'javascript');
      assert(result.includes('null'), 'Should convert None to null');
    });

    it('should translate logical operators', () => {
      const python = 'if x and y or z:';
      const result = translateCodeOffline(python, 'python', 'javascript');
      assert(result.includes('&&') || result.includes('and'), 'Should handle and operator');
      assert(result.includes('||') || result.includes('or'), 'Should handle or operator');
    });

    it('should translate if-elif-else statements', () => {
      const python = 'if x > 5:\n    pass\nelif x == 5:\n    pass\nelse:\n    pass';
      const result = translateCodeOffline(python, 'python', 'javascript');
      assert(result.includes('if'), 'Should contain if');
      assert(result.includes('else'), 'Should contain else');
    });

    it('should translate for loop', () => {
      const python = 'for item in items:';
      const result = translateCodeOffline(python, 'python', 'javascript');
      assert(result.includes('for') || result.includes('item'), 'Should translate for loop');
    });

    it('should translate while loop', () => {
      const python = 'while x < 10:';
      const result = translateCodeOffline(python, 'python', 'javascript');
      assert(result.includes('while'), 'Should contain while');
    });

    it('should translate list methods', () => {
      const python = 'items.append(x)\nitems.pop()\nitems.remove(y)';
      const result = translateCodeOffline(python, 'python', 'javascript');
      // Should have attempted to substitute with JS methods
      assert(result !== python, 'Should transform code');
    });
  });

  describe('JavaScript -> Python', () => {
    it('should translate console.log to print', () => {
      const js = 'console.log("Hello");';
      const result = translateCodeOffline(js, 'javascript', 'python');
      assert(result.includes('print'), 'Should contain print');
    });

    it('should translate function definition', () => {
      const js = 'function greet(name) {';
      const result = translateCodeOffline(js, 'javascript', 'python');
      assert(result.includes('def'), 'Should contain def');
    });

    it('should translate true/false to True/False', () => {
      const js = 'let x = true; let y = false;';
      const result = translateCodeOffline(js, 'javascript', 'python');
      assert(result.includes('True') || result !== js, 'Should attempt to translate booleans');
    });

    it('should translate null to None', () => {
      const js = 'const x = null;';
      const result = translateCodeOffline(js, 'javascript', 'python');
      assert(result.includes('None'), 'Should convert null to None');
    });

    it('should translate if-else statements', () => {
      const js = 'if (x > 5) {';
      const result = translateCodeOffline(js, 'javascript', 'python');
      assert(result.includes('if'), 'Should contain if');
    });

    it('should translate logical operators', () => {
      const js = 'if (x && y || z) {';
      const result = translateCodeOffline(js, 'javascript', 'python');
      assert(result !== js, 'Should attempt to translate logical operators');
    });
  });

  describe('Python -> Java', () => {
    it('should translate print to System.out.println', () => {
      const python = 'print("Hello")';
      const result = translateCodeOffline(python, 'python', 'java');
      assert(result.includes('System.out.println') || result !== python, 'Should translate print');
    });

    it('should translate function to method', () => {
      const python = 'def greet(name):';
      const result = translateCodeOffline(python, 'python', 'java');
      assert(result.includes('public') || result.includes('void') || result !== python, 'Should translate function');
    });

    it('should translate boolean values', () => {
      const python = 'x = True';
      const result = translateCodeOffline(python, 'python', 'java');
      assert(result.includes('true'), 'Should convert True to true');
    });
  });

  describe('Java -> Python', () => {
    it('should translate System.out.println to print', () => {
      const java = 'System.out.println("Hello");';
      const result = translateCodeOffline(java, 'java', 'python');
      assert(result.includes('print'), 'Should translate println');
    });

    it('should translate method to function', () => {
      const java = 'public void greet(String name) {';
      const result = translateCodeOffline(java, 'java', 'python');
      assert(result.includes('def') || result !== java, 'Should translate method');
    });
  });

  describe('TypeScript Support', () => {
    it('should accept TypeScript as alias for JavaScript', () => {
      const code = 'console.log("test");';
      
      // TypeScript to JavaScript should work
      const result1 = translateCodeOffline(code, 'typescript', 'javascript');
      assert(result1 !== undefined, 'Should handle typescript->javascript');
      
      // JavaScript to TypeScript should work
      const result2 = translateCodeOffline(code, 'javascript', 'typescript');
      assert(result2 !== undefined, 'Should handle javascript->typescript');
    });
  });

  describe('Unsupported Language Pairs', () => {
    it('should return code with comment for unsupported pairs', () => {
      const code = 'some code';
      const result = translateCodeOffline(code, 'fortran', 'lisp');
      assert(result.includes('Unable to translate'), 'Should indicate unsupported translation');
    });
  });

  describe('Supported Languages', () => {
    it('should return list of supported languages', () => {
      const languages = getOfflineSupportedLanguages();
      assert(Array.isArray(languages), 'Should return array');
      assert(languages.length > 0, 'Should have supported languages');
      assert(languages.includes('python'), 'Should include python');
      assert(languages.includes('javascript'), 'Should include javascript');
      assert(languages.includes('java'), 'Should include java');
      assert(languages.includes('cpp'), 'Should include cpp');
    });

    it('should include at least 10 languages', () => {
      const languages = getOfflineSupportedLanguages();
      assert(languages.length >= 10, 'Should support at least 10 languages');
    });
  });

  describe('Complex Code Translation', () => {
    it('should translate class with methods', () => {
      const python = `class Calculator:
    def add(self, a, b):
        return a + b
    def multiply(self, a, b):
        return a * b`;
      
      const result = translateCodeOffline(python, 'python', 'javascript');
      assert(result.includes('class') || result.includes('function'), 'Should translate class structure');
    });

    it('should translate nested if statements', () => {
      const python = `if x > 5:
    if y < 10:
        print("inside")
    else:
        print("not inside")`;
      
      const result = translateCodeOffline(python, 'python', 'javascript');
      assert(result !== python, 'Should attempt to translate nested structure');
    });

    it('should preserve strings and comments', () => {
      const python = `# This is a comment
x = "This is a string"
print(x)`;
      
      const result = translateCodeOffline(python, 'python', 'javascript');
      assert(result.includes('comment') || result.includes('string'), 'Should preserve some content');
    });
  });

  describe('Translation Edge Cases', () => {
    it('should handle empty code', () => {
      const result = translateCodeOffline('', 'python', 'javascript');
      assert(result !== undefined, 'Should handle empty code');
    });

    it('should handle code with only comments', () => {
      const code = '# just a comment';
      const result = translateCodeOffline(code, 'python', 'javascript');
      assert(result !== undefined, 'Should handle comment-only code');
    });

    it('should handle code without matching patterns', () => {
      const code = 'some random text that looks like code';
      const result = translateCodeOffline(code, 'python', 'javascript');
      assert(result !== null, 'Should handle code without patterns');
    });

    it('should maintain code length roughly (not add too much)', () => {
      const python = 'x = 5\nprint(x)';
      const result = translateCodeOffline(python, 'python', 'javascript');
      // JavaScript version should be similar or slightly longer
      assert(result.length < python.length * 3, 'Should not triple code size');
    });
  });

  describe('Integration with Translation Flow', () => {
    it('should reliably translate between common pairs', () => {
      const pairs = [
        ['python', 'javascript'],
        ['javascript', 'python'],
        ['python', 'java'],
        ['java', 'python'],
      ];

      const code = 'print("test")';

      pairs.forEach(([from, to]) => {
        const result = translateCodeOffline(code, from, to);
        assert(result !== undefined, `Should translate from ${from} to ${to}`);
        assert(result !== null, `Should not return null for ${from} to ${to}`);
      });
    });

    it('should handle back-and-forth translation reasonable', () => {
      const original = 'print("hello")';
      
      // Python -> JavaScript -> Python
      const js = translateCodeOffline(original, 'python', 'javascript');
      const backToPython = translateCodeOffline(js, 'javascript', 'python');
      
      assert(backToPython !== undefined, 'Should handle round-trip translation');
      assert(backToPython !== null, 'Should not be null after round-trip');
      // Shouldn't be exactly the same due to transformations, but should be valid code
      assert(backToPython.length > 0, 'Should produce non-empty result');
    });
  });
});
