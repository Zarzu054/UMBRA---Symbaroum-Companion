import "@testing-library/jest-dom/vitest";
import type { AdminAccountEvent } from "@umbra/shared";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { controllerMock } = vi.hoisted(() => ({
  controllerMock: {
    data: {
      items: [
        {
          id: "20000000-0000-0000-0000-000000000002",
          email: "player@example.com",
          role: "player",
          status: "active",
          mustChangePassword: true,
          createdAt: "2026-07-24T12:00:00.000Z",
          deactivatedAt: null,
          activeRefreshTokens: 1,
          notificationAttention: true
        }
      ],
      total: 1,
      page: 1,
      pageSize: 25,
      counts: { active: 1, pending: 0, deactivated: 0, notificationAttention: 1 }
    },
    filters: { query: "", role: "all", status: "all", page: 1, pageSize: 25 },
    isLoading: false,
    isSaving: false,
    operationUserId: null,
    events: [] as AdminAccountEvent[],
    eventsUserId: null,
    isLoadingEvents: false,
    error: null,
    refresh: vi.fn(),
    updateFilters: vi.fn(),
    createUser: vi.fn(),
    deactivateUser: vi.fn(),
    reactivateUser: vi.fn(),
    revokeSessions: vi.fn(),
    retryEmail: vi.fn(),
    loadEvents: vi.fn(),
    closeEvents: vi.fn()
  }
}));

vi.mock("../controllers/superadminController", () => ({
  useSuperAdminController: () => controllerMock
}));
vi.mock("../hooks/useBodyScrollLock", () => ({
  useBodyScrollLock: vi.fn()
}));

import { SuperAdminDashboardView } from "./SuperAdminDashboardView";

const admin = {
  id: "10000000-0000-0000-0000-000000000001",
  email: "admin@example.com",
  role: "superadmin" as const,
  status: "active" as const,
  mustChangePassword: false
};

describe("SuperAdminDashboardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    controllerMock.data.items[0]!.status = "active";
    controllerMock.data.items[0]!.mustChangePassword = true;
    controllerMock.data.items[0]!.activeRefreshTokens = 1;
    controllerMock.events = [];
    controllerMock.eventsUserId = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows account management without exposing game modules", () => {
    render(
      <SuperAdminDashboardView
        user={admin}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByRole("heading", { name: "Gestión de cuentas" })).toBeInTheDocument();
    expect(screen.getAllByText("player@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText("Correos pendientes")).toBeInTheDocument();
    expect(screen.queryByText("Personajes")).not.toBeInTheDocument();
    expect(screen.queryByText("Compendio")).not.toBeInTheDocument();
  });

  it("opens a dedicated creation dialog with only email and managed role", () => {
    render(
      <SuperAdminDashboardView
        user={admin}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const dialog = screen.getByRole("dialog", { name: "Crear una cuenta" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Rol")).toHaveValue("player");
    expect(within(dialog).queryByLabelText(/contrasena/i)).not.toBeInTheDocument();
  });

  it("moves focus into dialogs and restores it when they close with Escape", async () => {
    render(
      <SuperAdminDashboardView
        user={admin}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const trigger = screen.getByRole("button", { name: "Crear cuenta" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByLabelText("Correo electrónico")).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Crear una cuenta" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("requires a categorized explanation before deactivation", () => {
    render(
      <SuperAdminDashboardView
        user={admin}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Desactivar" })[0]!);

    const dialog = screen.getByRole("dialog", { name: "Desactivar cuenta" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Motivo")).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox")).toHaveAttribute("minLength", "10");
    expect(within(dialog).getByRole("button", { name: "Desactivar y notificar" })).toBeDisabled();
  });

  it("opens the per-user audit drawer", async () => {
    render(
      <SuperAdminDashboardView
        user={admin}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Historial" })[0]!);

    expect(await screen.findByRole("dialog", { name: "player@example.com" })).toBeInTheDocument();
    expect(controllerMock.loadEvents).toHaveBeenCalledWith("20000000-0000-0000-0000-000000000002");
  });

  it("sends search and role filters to the controller", () => {
    render(
      <SuperAdminDashboardView
        user={admin}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.change(screen.getByLabelText("Buscar por correo"), {
      target: { value: "druj" }
    });
    fireEvent.change(screen.getAllByLabelText("Rol")[0]!, {
      target: { value: "gm" }
    });

    expect(controllerMock.updateFilters).toHaveBeenCalledWith({ query: "druj" });
    expect(controllerMock.updateFilters).toHaveBeenCalledWith({ role: "gm" });
  });

  it("confirms reactivation with credential rotation", async () => {
    controllerMock.data.items[0]!.status = "deactivated";
    controllerMock.data.items[0]!.activeRefreshTokens = 0;
    controllerMock.reactivateUser.mockResolvedValue({
      user: controllerMock.data.items[0],
      event: { notificationStatus: "sent" }
    });
    render(
      <SuperAdminDashboardView
        user={admin}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Reactivar" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Reactivar cuenta" });
    expect(within(dialog).getByText(/credenciales anteriores dejarán de funcionar/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reactivar y enviar acceso" }));

    await waitFor(() => {
      expect(controllerMock.reactivateUser).toHaveBeenCalledWith(
        "20000000-0000-0000-0000-000000000002"
      );
    });
  });

  it("offers persistent retry for a failed account email", async () => {
    controllerMock.events = [{
      id: "30000000-0000-0000-0000-000000000003",
      action: "created",
      actorEmail: "admin@example.com",
      targetEmail: "player@example.com",
      reason: null,
      explanation: "",
      notificationStatus: "failed",
      notificationAttempts: 1,
      notificationLastAttemptAt: "2026-07-24T12:01:00.000Z",
      createdAt: "2026-07-24T12:00:00.000Z"
    }];
    controllerMock.retryEmail.mockResolvedValue({
      user: controllerMock.data.items[0],
      event: { notificationStatus: "sent" }
    });
    render(
      <SuperAdminDashboardView
        user={admin}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Historial" })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar correo" }));

    await waitFor(() => {
      expect(controllerMock.retryEmail).toHaveBeenCalledWith(
        "20000000-0000-0000-0000-000000000002",
        "30000000-0000-0000-0000-000000000003"
      );
    });
  });
});
