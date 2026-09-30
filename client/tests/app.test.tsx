import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { AuthProvider } from "../src/auth/AuthProvider";
import { ApiError } from "../src/api";
import type { DeskRequest, DeskUser } from "../src/types";

const api = vi.hoisted(() => ({
  login: vi.fn(),
  getMe: vi.fn(),
  getOverview: vi.fn(),
  getRequests: vi.fn(),
  getRequest: vi.fn(),
  convertRequest: vi.fn(),
  saveRequest: vi.fn(),
  getWorkItems: vi.fn(),
  getActivities: vi.fn(),
}));

vi.mock("../src/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/api")>();
  return { ...original, ...api };
});

const userProfile: DeskUser = {
  id: "user-saqib",
  name: "Saqib",
  email: "saqib@omni.example",
  role: "ADMIN",
  workspaceId: "workspace-pune",
  workspaceName: "Pune Home Services",
};

const selectedRequest: DeskRequest = {
  id: "5",
  customer_name: "Farhan Sheikh",
  customer_phone: "+91 98220 10005",
  customer_email: "farhan.sheikh@omni.example",
  customer_city: "Pune",
  service: "RO water purifier service",
  scheduled_date: "2026-10-07",
  priority: "IMPORTANT",
  status: "QUALIFIED",
  created_at: "2026-09-25T10:00:00.000Z",
  updated_at: "2026-09-26T10:00:00.000Z",
  work_item_id: null,
};

function renderApp(path = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider><App /></AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Omni Client System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.getMe.mockResolvedValue(userProfile);
    api.getOverview.mockResolvedValue({
      counts: { NEW: 2, QUALIFIED: 5, CLOSED: 1 },
      workItems: 1,
      activity: 10,
      recentRequests: [selectedRequest],
    });
    api.getRequests.mockResolvedValue({
      data: [selectedRequest],
      total: 1,
      page: 1,
      pageSize: 10,
      counts: { NEW: 2, QUALIFIED: 5, CLOSED: 1 },
    });
    api.getRequest.mockResolvedValue({
      request: selectedRequest,
      activities: [{ id: "activity-1", request_id: "5", action: "REQUEST_QUALIFIED", created_at: "2026-09-26T10:00:00.000Z", user_name: "Saqib", user_role: "ADMIN" }],
    });
  });

  it("shows a generic message for failed login", async () => {
    api.login.mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password"));
    const user = userEvent.setup();
    renderApp("/login");

    await user.type(screen.getByLabelText(/email address/i), "saqib@omni.example");
    await user.type(screen.getByLabelText("Password"), "WrongPass123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("redirects a protected 401 to login with an expired-session message", async () => {
    localStorage.setItem("omni_token", "expired-token");
    api.getMe.mockRejectedValue(new ApiError(401, "TOKEN_EXPIRED", "Your session expired, please log in again."));
    renderApp("/requests/9");

    expect(await screen.findByRole("alert")).toHaveTextContent("Your session expired, please log in again.");
    await waitFor(() => expect(localStorage.getItem("omni_token")).toBeNull());
  });

  it("shows conversion details and calls the API only after confirmation", async () => {
    localStorage.setItem("omni_token", "valid-token");
    localStorage.setItem("omni_user", JSON.stringify(userProfile));
    api.convertRequest.mockResolvedValue({
      workItem: { id: "work-item-1", request_id: "5", created_at: "2026-09-28T10:00:00.000Z" },
      alreadyExists: false,
    });
    const user = userEvent.setup();
    renderApp("/requests/5");

    await user.click(await screen.findByRole("button", { name: /create work item/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Farhan Sheikh")).toBeInTheDocument();
    expect(within(dialog).getByText("RO water purifier service")).toBeInTheDocument();
    expect(within(dialog).getByText(/7 Oct 2026/i)).toBeInTheDocument();
    expect(api.convertRequest).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(api.convertRequest).toHaveBeenCalledWith("valid-token", "5"));
  });
});
