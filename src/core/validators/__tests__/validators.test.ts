/**
 * Validator Tests
 */

import {
  isWebviewMessage,
  isTranslatePayload,
  isAnalyzePayload,
  validateWebviewMessage,
  WebviewMessageValidator,
} from "../index";

describe("Validators", () => {
  describe("isTranslatePayload", () => {
    it("should validate correct payload", () => {
      const payload = {
        code: "function test() {}",
        sourceLanguage: "javascript",
        targetLanguage: "python",
      };
      expect(isTranslatePayload(payload)).toBe(true);
    });

    it("should reject missing fields", () => {
      expect(isTranslatePayload({ code: "test" })).toBe(false);
      expect(isTranslatePayload({})).toBe(false);
      expect(isTranslatePayload(null)).toBe(false);
    });
  });

  describe("isAnalyzePayload", () => {
    it("should validate correct payload", () => {
      const payload = {
        code: "function test() {}",
        language: "javascript",
      };
      expect(isAnalyzePayload(payload)).toBe(true);
    });

    it("should reject missing fields", () => {
      expect(isAnalyzePayload({ code: "test" })).toBe(false);
      expect(isAnalyzePayload({})).toBe(false);
    });
  });

  describe("isWebviewMessage", () => {
    it("should validate translate message", () => {
      const msg = {
        type: "translate",
        payload: {
          code: "test",
          sourceLanguage: "js",
          targetLanguage: "py",
        },
      };
      expect(isWebviewMessage(msg)).toBe(true);
    });

    it("should validate getState message", () => {
      expect(isWebviewMessage({ type: "getState" })).toBe(true);
    });

    it("should validate error message", () => {
      expect(
        isWebviewMessage({
          type: "error",
          payload: { message: "test error" },
        })
      ).toBe(true);
    });

    it("should reject invalid type", () => {
      expect(isWebviewMessage({ type: "unknown" })).toBe(false);
    });

    it("should reject missing type", () => {
      expect(isWebviewMessage({ payload: {} })).toBe(false);
    });

    it("should reject null/undefined", () => {
      expect(isWebviewMessage(null)).toBe(false);
      expect(isWebviewMessage(undefined)).toBe(false);
    });
  });

  describe("validateWebviewMessage", () => {
    it("should return parsed message if valid", () => {
      const msg = { type: "getState" };
      const result = validateWebviewMessage(msg);
      expect(result).toEqual(msg);
    });

    it("should return null if invalid", () => {
      const result = validateWebviewMessage({ type: "invalid" });
      expect(result).toBeNull();
    });

    it("should handle errors gracefully", () => {
      const result = validateWebviewMessage(null);
      expect(result).toBeNull();
    });
  });

  describe("WebviewMessageValidator", () => {
    let validator: WebviewMessageValidator;

    beforeEach(() => {
      validator = new WebviewMessageValidator();
    });

    it("should validate valid message", () => {
      const msg = { type: "getState" };
      const result = validator.validate(msg);
      expect(result.valid).toBe(true);
    });

    it("should reject invalid message type", () => {
      const result = validator.validate({ type: "invalid" });
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should validate translate payload", () => {
      const msg = {
        type: "translate",
        payload: {
          code: "test",
          sourceLanguage: "js",
          targetLanguage: "py",
        },
      };
      const result = validator.validate(msg);
      expect(result.valid).toBe(true);
    });

    it("should reject translate with invalid payload", () => {
      const msg = {
        type: "translate",
        payload: { code: "test" },
      };
      const result = validator.validate(msg);
      expect(result.valid).toBe(false);
    });
  });
});
