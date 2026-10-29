import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, vi } from "vitest";

const apiMock = vi.fn();
vi.mock("../api", async (orig) => ({ ...(await orig<typeof import("../api")>()), api: (...a: unknown[]) => apiMock(...a) }));

import { Questionnaire } from "../components/Questionnaire";

const questions = {
  id: "phq9", title: "PHQ-9", source: "Official source", stem: "Over the last 2 weeks, how often…", reviewed: false,
  items: ["Item A", "Item B"], options: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
};
const resources = { region: "IN", label: "India", region_chosen: true, available_regions: {}, items: [
  { name: "Emergency", contact: "112", kind: "emergency", note: "", source: null, verified: true }] };

beforeEach(() => { apiMock.mockReset(); });

const renderQ = () => render(<MemoryRouter><Questionnaire id="phq9" onClose={vi.fn()} /></MemoryRouter>);

it("needs every answer, then shows the fixed result and the unreviewed label", async () => {
  apiMock.mockResolvedValueOnce(questions).mockResolvedValueOnce({
    questionnaire_result: { total: 3, max: 27, band: "minimal", band_text: "Score 3 of 27: none to minimal range.", next_steps: "Keep going." },
    reviewed: false, disclaimer: "It is not a diagnosis.", safety: null,
  });
  renderQ();
  await screen.findByText("1. Item A");
  expect(screen.getAllByText(/hasn't been reviewed by a clinician/).length).toBeGreaterThan(0);
  const submit = screen.getByRole("button", { name: "See my result" });
  expect(submit).toBeDisabled();

  const [a, b] = screen.getAllByRole("group");
  await userEvent.click(within(a).getByLabelText("Nearly every day"));
  expect(submit).toBeDisabled();
  await userEvent.click(within(b).getByLabelText("Not at all"));
  await userEvent.click(submit);

  expect(apiMock).toHaveBeenLastCalledWith("/assessments/phq9/attempts", { method: "POST", json: { answers: [3, 0] } });
  await screen.findByText("Score 3 of 27: none to minimal range.");
  expect(screen.getByText("It is not a diagnosis.")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows urgent support first when the risk item is answered", async () => {
  apiMock.mockResolvedValueOnce(questions).mockResolvedValueOnce({
    questionnaire_result: { total: 1, max: 27, band: "minimal", band_text: "Score 1 of 27.", next_steps: "…" },
    reviewed: false, disclaimer: "Not a diagnosis.", safety: { level: "urgent", message: "You deserve support right now.", resources },
  });
  renderQ();
  await screen.findByText("1. Item A");
  const [a, b] = screen.getAllByRole("group");
  await userEvent.click(within(a).getByLabelText("Not at all"));
  await userEvent.click(within(b).getByLabelText("Several days"));
  await userEvent.click(screen.getByRole("button", { name: "See my result" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("You deserve support right now."));
  expect(screen.getByText("112")).toBeInTheDocument();
});
