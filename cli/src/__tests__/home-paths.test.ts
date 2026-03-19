import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolvePaperclipHomeDir,
  resolvePaperclipInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.paperclip and default instance", () => {
    delete process.env.PAPERCLIP_HOME;
    delete process.env.PAPERCLIP_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(path.resolve(os.homedir(), ".paperclip"));
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(os.homedir(), ".paperclip", "instances", "default", "config.json"));
  });

  it("supports PAPERCLIP_HOME and explicit instance ids", () => {
    process.env.PAPERCLIP_HOME = "~/paperclip-home";

    const home = resolvePaperclipHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "paperclip-home"));
    expect(resolvePaperclipInstanceId("dev_1")).toBe("dev_1");
  });

  it("supports CUBECLOUDIO_HOME and CUBECLOUDIO_INSTANCE_ID aliases", () => {
    delete process.env.PAPERCLIP_HOME;
    delete process.env.PAPERCLIP_INSTANCE_ID;
    process.env.CUBECLOUDIO_HOME = "~/cubecloudio-home";
    process.env.CUBECLOUDIO_INSTANCE_ID = "cube_dev";

    const home = resolvePaperclipHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "cubecloudio-home"));
    expect(resolvePaperclipInstanceId()).toBe("cube_dev");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolvePaperclipInstanceId("bad/id")).toThrow(/Invalid instance id/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
