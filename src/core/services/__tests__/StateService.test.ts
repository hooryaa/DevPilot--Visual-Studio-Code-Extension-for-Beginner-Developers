/**
 * StateService Tests
 */

import * as vscode from "vscode";
import { StateService } from "../StateService";
import { ExtensionState } from "../../types";
import { createInitialState } from "../../state/migrations";

describe("StateService", () => {
  let stateService: StateService;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // Create mock context
    mockContext = {
      globalState: {
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as vscode.ExtensionContext;

    stateService = new StateService(mockContext, createInitialState());
  });

  describe("getState", () => {
    it("should return current state", () => {
      const state = stateService.getState();
      expect(state).toBeDefined();
      expect(state.version).toBe(1);
      expect(state.stats.usageCount).toBe(0);
    });

    it("should return a copy, not reference", () => {
      const state1 = stateService.getState();
      const state2 = stateService.getState();
      state1.stats.usageCount = 999;
      expect(state2.stats.usageCount).toBe(0);
    });
  });

  describe("updateState", () => {
    it("should update state properties", () => {
      stateService.updateState({
        user: { id: "user123", email: "test@example.com" },
      });

      const state = stateService.getState();
      expect(state.user?.id).toBe("user123");
      expect(state.user?.email).toBe("test@example.com");
    });

    it("should emit change event", (done) => {
      stateService.onStateChange((state: ExtensionState) => {
        expect(state.user?.id).toBe("user123");
        done();
      });

      stateService.updateState({
        user: { id: "user123" },
      });
    });

    it("should never downgrade version", () => {
      stateService.updateState({ version: 0 } as any);
      const state = stateService.getState();
      expect(state.version).toBe(1);
    });
  });

  describe("recordUsage", () => {
    it("should increment usage count", () => {
      const before = stateService.getState().stats.usageCount;
      stateService.recordUsage();
      const after = stateService.getState().stats.usageCount;
      expect(after).toBe(before + 1);
    });

    it("should update lastUsed timestamp", () => {
      stateService.recordUsage();
      const state = stateService.getState();
      expect(state.stats.lastUsed).toBeDefined();
    });
  });

  describe("setFeatureEnabled", () => {
    it("should enable/disable features", () => {
      stateService.setFeatureEnabled("translation", false);
      const state = stateService.getState();
      expect(state.settings.features.translation).toBe(false);

      stateService.setFeatureEnabled("translation", true);
      expect(stateService.getState().settings.features.translation).toBe(true);
    });
  });

  describe("setUser / clearUser", () => {
    it("should set and clear user", () => {
      const user = { id: "user123", email: "test@example.com" };
      stateService.setUser(user);
      expect(stateService.getState().user).toEqual(user);

      stateService.clearUser();
      expect(stateService.getState().user).toBeUndefined();
    });
  });
});
