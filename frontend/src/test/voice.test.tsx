import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, vi } from "vitest";

const apiMock = vi.fn();
vi.mock("../api", async (orig) => ({ ...(await orig<typeof import("../api")>()), api: (...a: unknown[]) => apiMock(...a) }));
const user0 = { id: 1, email: null, is_guest: true, onboarding_complete: true, save_chat_history: false, personalization_enabled: true,
  share_with_ai_provider: false, response_length: "medium", language: "en", region: "IN" };
vi.mock("../auth", () => ({ useAuth: () => ({ user: user0, setUser: vi.fn(), refresh: vi.fn() }) }));

import { Chat } from "../pages/Chat";

type Handler = ((e: unknown) => void) | null;
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = ""; continuous = false; interimResults = false;
  onresult: Handler = null; onerror: Handler = null; onend: (() => void) | null = null;
  start = vi.fn(); abort = vi.fn();
  stop = vi.fn(() => this.onend?.());
  constructor() { FakeRecognition.last = this; }
  say(transcript: string, isFinal: boolean) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript } }] });
  }
}

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockResolvedValue({ message: "Hi." });
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
});
afterEach(() => { delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition; });

const renderChat = () => render(<MemoryRouter><Chat /></MemoryRouter>);

it("puts spoken words into the message box without sending", async () => {
  renderChat();
  await userEvent.type(screen.getByLabelText("Message"), "Hello");
  await userEvent.click(screen.getByRole("button", { name: "Start voice typing" }));
  expect(FakeRecognition.last?.lang).toBe("en-IN");
  expect(screen.getByText(/Nothing is sent until you press Send/)).toBeInTheDocument();

  act(() => FakeRecognition.last!.say("I feel tired", true));
  expect(screen.getByLabelText("Message")).toHaveValue("Hello I feel tired");
  // Only the welcome call: dictation never sends on its own.
  expect(apiMock).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole("button", { name: "Stop voice typing" }));
  expect(screen.getByRole("button", { name: "Start voice typing" })).toBeInTheDocument();
});

it("explains a blocked microphone", async () => {
  renderChat();
  await userEvent.click(screen.getByRole("button", { name: "Start voice typing" }));
  act(() => FakeRecognition.last!.onerror?.({ error: "not-allowed" }));
  expect(screen.getByText(/Microphone access is blocked/)).toBeInTheDocument();
});

it("hides the mic when the browser has no speech support", () => {
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  renderChat();
  expect(screen.queryByRole("button", { name: /voice typing/ })).not.toBeInTheDocument();
});
