/**
 * Unit tests for Ask (AI Analyst) page.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock hooks
vi.mock("@/hooks/use-api-query", () => ({
  useApiQuery: vi.fn(),
}));

vi.mock("@/hooks/use-api-mutation", () => ({
  useApiMutation: vi.fn(),
}));

// Mock chart component (requires canvas/SVG)
vi.mock("@/components/charts/simple-bar-chart", () => ({
  SimpleBarChart: (props: Record<string, unknown>) => (
    <div data-testid="simple-bar-chart" aria-label={props["aria-label"] as string} />
  ),
}));

import AskPage from "../page";
import { useApiQuery } from "@/hooks/use-api-query";
import { useApiMutation } from "@/hooks/use-api-mutation";

const mockedUseApiQuery = vi.mocked(useApiQuery);
const mockedUseApiMutation = vi.mocked(useApiMutation);

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockConversations = {
  conversations: [
    {
      id: "conv-1",
      workspace_id: "ws-1",
      user_id: "user-1",
      title: "Revenue analysis",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T10:00:00Z",
    },
    {
      id: "conv-2",
      workspace_id: "ws-1",
      user_id: "user-1",
      title: "Churn metrics",
      created_at: "2024-01-03T00:00:00Z",
      updated_at: "2024-01-04T12:00:00Z",
    },
  ],
};

const mockMessages = {
  messages: [
    {
      id: "msg-1",
      conversation_id: "conv-1",
      role: "user" as const,
      content: "What is our MRR?",
      created_at: "2024-01-02T09:00:00Z",
    },
    {
      id: "msg-2",
      conversation_id: "conv-1",
      role: "assistant" as const,
      content: "Your current MRR is $125,000.",
      created_at: "2024-01-02T09:01:00Z",
    },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const defaultMutationReturn = {
  mutate: vi.fn().mockResolvedValue(null),
  isLoading: false,
  error: null,
};

/**
 * Sets up mock return values for the two useApiQuery calls:
 * 1st call = conversations, 2nd call = messages
 */
function mockQueryCalls(
  conversationsReturn: ReturnType<typeof useApiQuery>,
  messagesReturn: ReturnType<typeof useApiQuery>
) {
  let callIndex = 0;
  mockedUseApiQuery.mockImplementation(() => {
    const returns = [conversationsReturn, messagesReturn];
    const result = returns[callIndex % 2];
    callIndex++;
    return result;
  });
}

describe("AskPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseApiMutation.mockReturnValue(defaultMutationReturn);
  });

  describe("conversation list loading (Req 4.1)", () => {
    it("renders a loading skeleton in the sidebar when conversations are loading", () => {
      const conversationsReturn = {
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      };
      const messagesReturn = {
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };

      mockQueryCalls(conversationsReturn, messagesReturn);

      render(<AskPage />);

      // LoadingSkeleton renders with role="status"
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("conversation list success (Req 4.1)", () => {
    it("renders conversation titles in the sidebar", () => {
      const conversationsReturn = {
        data: mockConversations,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
      const messagesReturn = {
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };

      mockQueryCalls(conversationsReturn, messagesReturn);

      render(<AskPage />);

      expect(screen.getByText("Revenue analysis")).toBeInTheDocument();
      expect(screen.getByText("Churn metrics")).toBeInTheDocument();
    });
  });

  describe("question submission loading state (Req 4.4)", () => {
    it("renders loading skeleton in the answer area when ask is in progress", () => {
      const conversationsReturn = {
        data: mockConversations,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
      const messagesReturn = {
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };

      mockQueryCalls(conversationsReturn, messagesReturn);
      mockedUseApiMutation.mockReturnValue({
        mutate: vi.fn().mockResolvedValue(null),
        isLoading: true,
        error: null,
      });

      render(<AskPage />);

      // The answer area loading skeleton uses animate-pulse divs
      const answerArea = screen.getByRole("region", { name: "AI answer area" });
      expect(answerArea.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("error on failed ask (Req 4.5)", () => {
    it("displays error message when the ask mutation fails", () => {
      const conversationsReturn = {
        data: mockConversations,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
      const messagesReturn = {
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };

      mockQueryCalls(conversationsReturn, messagesReturn);
      mockedUseApiMutation.mockReturnValue({
        mutate: vi.fn().mockResolvedValue(null),
        isLoading: false,
        error: "AI service unavailable",
      });

      render(<AskPage />);

      expect(screen.getByText("AI service unavailable")).toBeInTheDocument();
    });
  });

  describe("successful answer rendering (Req 4.6)", () => {
    it("renders AI summary text and Generated SQL button when answer is available", async () => {
      const conversationsReturn = {
        data: mockConversations,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
      const messagesReturn = {
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };

      const mockAnswer = {
        success: true,
        data: {
          summary: "Your monthly recurring revenue is $125,000, up 12% from last month.",
          sql: "SELECT SUM(amount) FROM subscriptions WHERE status = 'active'",
          results: [{ mrr: 125000 }],
          confidence: 92,
          metrics: [
            { label: "MRR", value: "$125K", trend: "up" as const },
          ],
          chartData: [
            { month: "Jan", revenue: 100000 },
            { month: "Feb", revenue: 125000 },
          ],
        },
      };

      const mockMutate = vi.fn().mockResolvedValue(mockAnswer);
      mockedUseApiMutation.mockReturnValue({
        mutate: mockMutate,
        isLoading: false,
        error: null,
      });

      mockQueryCalls(conversationsReturn, messagesReturn);

      render(<AskPage />);

      // Type a question and submit
      const input = screen.getByPlaceholderText("Ask a question about your data...");
      fireEvent.change(input, { target: { value: "What is our MRR?" } });

      const submitButton = screen.getByRole("button", { name: "Send question" });
      fireEvent.click(submitButton);

      // Wait for the mutate to resolve and state to update
      // The component calls submitQuestion and sets lastAnswer on success
      await vi.waitFor(() => {
        expect(screen.getByText("Your monthly recurring revenue is $125,000, up 12% from last month.")).toBeInTheDocument();
      });

      // Generated SQL button should be present
      expect(screen.getByRole("button", { name: /generated sql/i })).toBeInTheDocument();

      // Chart should render
      expect(screen.getByTestId("simple-bar-chart")).toBeInTheDocument();

      // Confidence badge
      expect(screen.getByText("92% confidence")).toBeInTheDocument();
    });
  });
});
