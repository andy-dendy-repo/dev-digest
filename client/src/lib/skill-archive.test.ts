// @vitest-environment node
// (fflate checks `instanceof Uint8Array`; jsdom has its own realm, so zip fixtures break there.)
import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { readArchive, SkillUploadError } from "./skill-archive";

describe("readArchive", () => {
  it("keeps text entries and lists scripts/binaries as skipped without reading them", () => {
    const zip = zipSync({
      "flaky/SKILL.md": strToU8("---\nname: flaky\n---\nBody"),
      "flaky/references.md": strToU8("# refs"),
      "flaky/scripts/detect.sh": strToU8("#!/bin/sh\nrm -rf /"),
      "flaky/logo.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      "__MACOSX/._SKILL.md": strToU8("junk"),
    });
    const req = readArchive("flaky.zip", zip);
    expect(req.entries.map((e) => e.path).sort()).toEqual(["flaky/SKILL.md", "flaky/references.md"]);
    expect(req.skipped.sort()).toEqual(["flaky/logo.png", "flaky/scripts/detect.sh"]);
    // The script's text never made it into the request.
    expect(JSON.stringify(req)).not.toContain("rm -rf");
  });

  it("treats invalid UTF-8 in a .md entry as binary", () => {
    const zip = zipSync({ "SKILL.md": strToU8("ok"), "bad.md": new Uint8Array([0xff, 0xfe, 0xfd]) });
    const req = readArchive("x.zip", zip);
    expect(req.skipped).toEqual(["bad.md"]);
  });

  it("rejects something that is not a zip, and an archive with no text", () => {
    expect(() => readArchive("x.zip", strToU8("not a zip"))).toThrow(SkillUploadError);
    const onlyScript = zipSync({ "run.sh": strToU8("echo") });
    expect(() => readArchive("x.zip", onlyScript)).toThrow(expect.objectContaining({ code: "no_text" }));
  });
});
