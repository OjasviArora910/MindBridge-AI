import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import { ExerciseRunner } from "../sos/ExerciseRunner";
import { exercises } from "../sos/exercises";

const ex = exercises.find((e) => e.id === "grounding")!;

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); });

describe("SOS exercises (no network, no LLM)", () => {
  it("does not autoplay: nothing counts down until Begin is pressed", () => {
    render(<ExerciseRunner exercise={ex} onExit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Begin" })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("counts down, pauses, resumes and skips", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ExerciseRunner exercise={ex} onExit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Begin" }));
    expect(screen.getByText("5 things you can see")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByRole("timer")).toHaveTextContent("27 seconds left");

    await user.click(screen.getByRole("button", { name: "Pause" }));
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole("timer")).toHaveTextContent("27 seconds left"); // frozen
    await user.click(screen.getByRole("button", { name: "Resume" }));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole("timer")).toHaveTextContent("25 seconds left");

    await user.click(screen.getByRole("button", { name: "Skip step" }));
    expect(screen.getByText("4 things you can feel")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
  });

  it("auto-advances at zero and finishes with a gentle closing screen", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onExit = vi.fn();
    render(<ExerciseRunner exercise={ex} onExit={onExit} />);
    await user.click(screen.getByRole("button", { name: "Begin" }));
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByText("4 things you can feel")).toBeInTheDocument();
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole("button", { name: "Skip step" }));
    expect(screen.getByText(/Thanks for taking a pause/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onExit).toHaveBeenCalledWith("done");
  });

  it("can always be exited, including when it feels uncomfortable", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onExit = vi.fn();
    render(<ExerciseRunner exercise={ex} onExit={onExit} />);
    await user.click(screen.getByRole("button", { name: "Exit" }));
    expect(onExit).toHaveBeenLastCalledWith("exit");
    await user.keyboard("{Escape}");
    expect(onExit).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Begin" }));
    await user.click(screen.getByRole("button", { name: /feels uncomfortable/i }));
    expect(onExit).toHaveBeenLastCalledWith("uncomfortable");
  });

  it("keeps sound off by default and makes no claim to treat anything", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ExerciseRunner exercise={ex} onExit={vi.fn()} />);
    expect(screen.getByText(/isn't a treatment for any condition and can't resolve a crisis/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Begin" }));
    expect(screen.getByRole("checkbox", { name: /chime/i })).not.toBeChecked();
  });

  it("drops the breathing animation when the user prefers reduced motion", async () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<ExerciseRunner exercise={exercises[0]} onExit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Begin" }));
    expect(container.querySelector("[style*='animation']")).toBeNull();
    expect(screen.getByText("Breathe in")).toBeInTheDocument(); // still guided by text + countdown
  });

  it("every exercise has steps with positive durations", () => {
    expect(exercises.map((e) => e.id).sort()).toEqual(["breathing", "grounding", "pmr", "stop"]);
    for (const e of exercises) { expect(e.steps.length).toBeGreaterThan(0); expect(e.steps.every((s) => s.seconds > 0)).toBe(true); }
  });
});
