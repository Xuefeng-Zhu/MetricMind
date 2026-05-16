import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockToast = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import DataSourcesRoute from "../page";

describe("DataSourcesPage", () => {
  beforeEach(() => {
    mockToast.mockClear();
  });

  it("renders the management page with summary cards and primary actions", () => {
    render(<DataSourcesRoute />);

    expect(screen.getByRole("heading", { name: "Data Sources" })).toBeInTheDocument();
    expect(screen.getAllByText("Connected sources").length).toBeGreaterThan(0);
    expect(screen.getByText("Datasets profiled")).toBeInTheDocument();
    expect(screen.getByText("Rows synced")).toBeInTheDocument();
    expect(screen.getAllByText("Open issues").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /upload csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect source/i })).toBeInTheDocument();
    expect(screen.getAllByText("Snowflake Revenue Warehouse").length).toBeGreaterThan(0);
  });

  it("filters sources by search query", () => {
    render(<DataSourcesRoute />);

    fireEvent.change(screen.getByLabelText("Search data sources"), {
      target: { value: "zendesk" },
    });

    expect(screen.getAllByText("Zendesk Support").length).toBeGreaterThan(0);
    expect(screen.queryByText("Snowflake Revenue Warehouse")).not.toBeInTheDocument();
  });

  it("filters sources by status", () => {
    render(<DataSourcesRoute />);

    fireEvent.click(screen.getByRole("button", { name: "Issue" }));

    expect(screen.getAllByText("Stripe Billing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Zendesk Support").length).toBeGreaterThan(0);
    expect(screen.queryByText("Snowflake Revenue Warehouse")).not.toBeInTheDocument();
  });

  it("updates datasets and schema preview when a source is selected", () => {
    render(<DataSourcesRoute />);

    fireEvent.click(screen.getByRole("button", { name: /Segment Product Events/i }));

    expect(screen.getAllByText("Product Events").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Which feature events predict expansion within 30 days/)
    ).toBeInTheDocument();
    expect(screen.getByText("event_id")).toBeInTheDocument();
  });

  it("updates schema preview when a dataset is selected", () => {
    render(<DataSourcesRoute />);

    fireEvent.click(screen.getByText("Subscriptions"));

    expect(screen.getByText("Primary key: subscription_id")).toBeInTheDocument();
    expect(screen.getByText("Define Monthly Recurring Revenue")).toBeInTheDocument();
  });

  it("opens the CSV upload dialog", () => {
    render(<DataSourcesRoute />);

    fireEvent.click(screen.getByRole("button", { name: /upload csv/i }));

    expect(screen.getByRole("dialog", { name: "Upload CSV" })).toBeInTheDocument();
    expect(screen.getByText("q1_board_metrics.csv")).toBeInTheDocument();
  });

  it("opens the connector gallery dialog", () => {
    render(<DataSourcesRoute />);

    fireEvent.click(screen.getByRole("button", { name: /connect source/i }));

    expect(screen.getByRole("dialog", { name: "Connector gallery" })).toBeInTheDocument();
    expect(screen.getByText("BigQuery")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
  });

  it("triggers mock sync and semantic model toasts", () => {
    render(<DataSourcesRoute />);

    fireEvent.click(screen.getByRole("button", { name: /sync now/i }));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Mock sync started" })
    );

    fireEvent.click(screen.getAllByRole("button", { name: /create semantic model/i })[0]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Semantic model draft created" })
    );
  });
});
