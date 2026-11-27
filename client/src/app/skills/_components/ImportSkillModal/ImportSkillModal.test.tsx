import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { SkillImportPreview } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";

const PREVIEW: SkillImportPreview = {
  draft: { name: "flaky-test-patterns", description: "Flag flaky tests.", type: "rubric", body: "# Flaky tests\n\nNo sleeps." },
  core_path: "flaky-test-patterns/SKILL.md",
  ignored: [
    { path: "flaky-test-patterns/references.md", reason: "not_core" },
    { path: "flaky-test-patterns/scripts/detect-flakes.sh", reason: "not_text" },
  ],
};

const h = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  previewData: undefined as unknown,
}));

vi.mock("@/lib/skill-archive", async (orig) => ({
  ...(await orig<typeof import("@/lib/skill-archive")>()),
  readSkillUpload: h.read,
}));
vi.mock("@/lib/hooks/skills", () => ({
  usePreviewSkillImport: () => ({
    mutateAsync: async (req: unknown) => {
      h.preview(req);
      h.previewData = PREVIEW;
      return PREVIEW;
    },
    get data() {
      return h.previewData;
    },
    reset: vi.fn(),
  }),
  useCreateSkill: () => ({ mutate: h.create, reset: vi.fn(), isPending: false, isError: false }),
}));

import { ImportSkillModal } from "./ImportSkillModal";

beforeEach(() => {
  vi.clearAllMocks();
  h.previewData = undefined;
  h.read.mockResolvedValue({ filename: "f.zip", entries: [{ path: "x/SKILL.md", content: "c" }], skipped: ["x/run.sh"] });
});

describe("ImportSkillModal", () => {
  it("upload → preview (core, body, ignored files, trust notice) → save as an imported, disabled skill", async () => {
    const { user } = renderWithProviders(<ImportSkillModal onClose={vi.fn()} onImported={vi.fn()} />);
    const file = new File(["zip"], "flaky-test-patterns.zip", { type: "application/zip" });
    await user.upload(screen.getByLabelText("Choose file"), file);

    expect(h.read).toHaveBeenCalledWith(file);
    expect(h.preview).toHaveBeenCalledWith(expect.objectContaining({ skipped: ["x/run.sh"] }));
    expect(await screen.findByText("Skill core: flaky-test-patterns/SKILL.md")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Flaky tests" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("someone else's instructions");
    const ignored = screen.getByRole("list", { name: "Not imported" });
    expect(ignored).toHaveTextContent("scripts/detect-flakes.sh — executable or binary — not read, not run");
    // Nothing is saved until the user confirms.
    expect(h.create).not.toHaveBeenCalled();

    await user.clear(screen.getByRole("textbox", { name: "Description" }));
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Flag time-dependent tests.");
    await user.click(screen.getByRole("button", { name: "Save skill (disabled)" }));
    expect(h.create).toHaveBeenCalledWith(
      { ...PREVIEW.draft, description: "Flag time-dependent tests.", source: "imported_file" },
      expect.anything(),
    );
  });

  it("shows an upload error inline and stays on the picker", async () => {
    const { SkillUploadError } = await import("@/lib/skill-archive");
    h.read.mockRejectedValue(new SkillUploadError("unsupported"));
    const { user } = renderWithProviders(<ImportSkillModal onClose={vi.fn()} onImported={vi.fn()} />);
    await user.upload(screen.getByLabelText("Choose file"), new File(["x"], "x.zip"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unsupported file type");
    expect(h.preview).not.toHaveBeenCalled();
  });
});
