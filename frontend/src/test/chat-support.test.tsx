import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { axe } from "./axe";

const apiMock = vi.fn();
vi.mock("../api", async (orig) => ({ ...(await orig<typeof import("../api")>()), api: (...a: unknown[]) => apiMock(...a) }));
const user0 = { id: 1, email: null, is_guest: true, onboarding_complete: true, save_chat_history: false, personalization_enabled: true,
  share_with_ai_provider: false, response_length: "medium", language: "en", region: "IN" };
vi.mock("../auth", () => ({ useAuth: () => ({ user: user0, setUser: vi.fn(), refresh: vi.fn() }) }));

import { ApiError } from "../api";
import { ResourceList, ResourcesLoader } from "../components/Support";
import { Chat } from "../pages/Chat";
import { Landing } from "../pages/Landing";

const resources = (over = {}) => ({
  region: "IN", label: "India", region_chosen: true, available_regions: { IN: "India", US: "United States", OTHER: "Another country" },
  items: [
    { name: "National emergency number (ERSS)", contact: "112", kind: "emergency", note: "For immediate danger.", source: null, verified: true },
    { name: "Tele-MANAS", contact: "14416", kind: "mental_health", note: "Check hours.", source: null, verified: false },
  ], ...over,
});

beforeEach(() => { apiMock.mockReset(); });

describe("Support resources", () => {
  it("shows contacts, flags unverified ones, and says it can't contact anyone", () => {
    render(<ResourceList data={resources()} />);
    expect(screen.getByText("112")).toBeInTheDocument();
    expect(screen.getAllByText(/double-check this number/i)).toHaveLength(1);
    expect(screen.getByText(/can't contact anyone for you/)).toBeInTheDocument();
  });

  it("asks for a region instead of guessing one", () => {
    render(<ResourceList data={resources({ region_chosen: false, region: "OTHER" })} onRegion={vi.fn()} />);
    expect(screen.getByText(/We don't guess where you are/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "India" })).toBeInTheDocument();
  });

  it("falls back to guidance with no invented phone numbers when loading fails", async () => {
    apiMock.mockImplementation(async () => { throw new ApiError(0, "offline"); });
    const { container } = render(<ResourcesLoader user={null} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(container.textContent).toMatch(/local emergency number/);
    expect(container.textContent).not.toMatch(/\d{3}/);
  });
});

describe("Chat", () => {
  const renderChat = () => render(<MemoryRouter><Chat /></MemoryRouter>);
  const route = (reply: Record<string, unknown> | Error) => apiMock.mockImplementation((path: string) => {
    if (path === "/chat/welcome") return Promise.resolve({ message: "Welcome. We can talk, pause, or organize your thoughts." });
    if (path === "/chat") return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
    return Promise.resolve(null);
  });
  const base = { conversation_id: null, ai_generated: true, ai_available: true, mock_mode: false, suggestions: [], resources: null,
    safety: { level: "none", category: "none", show_resources: false } };

  it("labels who is speaking: automated welcome vs AI-generated reply", async () => {
    route({ ...base, reply: "That sounds like a lot to carry." });
    const u = userEvent.setup();
    renderChat();
    await screen.findByText(/Welcome\. We can talk/);
    expect(screen.getByText("MindBridge · automated message")).toBeInTheDocument();
    expect(screen.getByText(/You're chatting with an AI, not a person or a therapist/)).toBeInTheDocument();
    await u.type(screen.getByLabelText("Message"), "I'm stressed about exams");
    await u.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("That sounds like a lot to carry.");
    expect(screen.getByText("MindBridge · AI-generated")).toBeInTheDocument();
  });

  it("shows support options inside the conversation when the safety workflow responds", async () => {
    route({ ...base, ai_generated: false, reply: "I'm really glad you told me.", resources: resources(),
      safety: { level: "urgent", category: "self_harm", show_resources: true } });
    const u = userEvent.setup();
    renderChat();
    await screen.findByText(/Welcome/);
    await u.type(screen.getByLabelText("Message"), "I want to end my life");
    await u.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("I'm really glad you told me.");
    expect(screen.getByText("Support options")).toBeInTheDocument();
    expect(screen.getByText("112")).toBeInTheDocument();
    // The reviewed safety reply is labelled as an automated message, not as AI-generated text.
    expect(screen.getAllByText("MindBridge · automated message")).toHaveLength(2);
    expect(screen.queryByText("MindBridge · AI-generated")).not.toBeInTheDocument();
  });

  it("does not invent a reply when sending fails, and keeps the person's text", async () => {
    route(new ApiError(0, "Can't reach MindBridge right now. Check your connection and try again."));
    const u = userEvent.setup();
    renderChat();
    await screen.findByText(/Welcome/);
    await u.type(screen.getByLabelText("Message"), "hello there");
    await u.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText(/Can't reach MindBridge/);
    expect(screen.getByLabelText("Message")).toHaveValue("hello there");
    expect(screen.queryByText("MindBridge · AI-generated")).not.toBeInTheDocument();
  });

  it("offers calming-exercise shortcuts only when the reply suggests them", async () => {
    route({ ...base, reply: "Happy to.", suggestions: [{ type: "sos", id: "breathing", label: "Paced breathing" }] });
    const u = userEvent.setup();
    renderChat();
    await screen.findByText(/Welcome/);
    await u.click(screen.getByRole("button", { name: "Show me a calming exercise" }));
    expect(await screen.findByRole("button", { name: "Paced breathing" })).toBeInTheDocument();
  });
});

describe("Landing page", () => {
  it("has the required heading, actions and limitation notice, and passes axe checks", async () => {
    const { container } = render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: "A space to pause, reflect, and feel heard." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Let's get started" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore calming exercises" })).toBeInTheDocument();
    expect(screen.getByText(/not a therapist or a person/)).toBeInTheDocument();
    const results = await axe(container);
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
