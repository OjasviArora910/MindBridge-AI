import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, vi } from "vitest";

const apiMock = vi.fn();
vi.mock("../api", async (orig) => ({ ...(await orig<typeof import("../api")>()), api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("../auth", () => ({ useAuth: () => ({ refresh: vi.fn() }) }));

import { Onboarding } from "../pages/Onboarding";

const setup = () => render(<MemoryRouter><Onboarding /></MemoryRouter>);

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation((path: string, init?: { method?: string }) => {
    if (path === "/onboarding" && init?.method === "PUT") return Promise.resolve({ saved: true, welcome_message: "Thanks for sharing that with me. We don't have to solve everything at once." });
    return Promise.resolve(null); // GET /onboarding: nothing saved yet
  });
});

describe("Onboarding", () => {
  it("shows the plain-language question, a self-rating explanation and progress", async () => {
    setup();
    expect(screen.getByText(/How intense does your stress or emotional discomfort feel right now\?/)).toBeInTheDocument();
    expect(screen.getByText(/isn't a clinical score or a diagnosis/)).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 4")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /onboarding progress/i })).toBeInTheDocument();
  });

  it("supports Back, Skip and editing from the review screen", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("radio", { name: "7" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("checkbox", { name: "Overwhelmed" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: "7" })).toHaveAttribute("aria-checked", "true");

    // Back on question 1 with "7" kept. Skip forward through 1, 2, 3 and 4 to the review screen.
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText(/Here's what you shared/)).toBeInTheDocument();
    expect(screen.getByText("7 out of 10")).toBeInTheDocument();
    expect(screen.getAllByText("Skipped").length).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole("button", { name: "Edit Main concern" }));
    await user.click(screen.getByRole("radio", { name: "Studies or exams" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" })); // through duration
    expect(screen.getByText("Studies or exams")).toBeInTheDocument();
  });

  it("requires an explicit saving choice and sends it", async () => {
    const user = userEvent.setup();
    setup();
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByRole("button", { name: "Finish" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Don't save/ }));
    await user.click(screen.getByRole("button", { name: "Finish" }));
    const put = apiMock.mock.calls.find((c) => c[1]?.method === "PUT");
    expect(put?.[1].json.consent_to_save).toBe(false);
    await waitFor(() => expect(screen.getByText(/We don't have to solve everything at once/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "I want to talk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show me a calming exercise" })).toBeInTheDocument();
  });

  it("never mentions diagnosis or severity labels in its own UI", () => {
    setup();
    expect(document.body.textContent).not.toMatch(/depress|disorder|severity|mild anxiety|diagnos(e|ed)\b/i);
  });
});
