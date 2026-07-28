import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState title="No holdings yet" description="Sync a portfolio to get started." />);

    expect(screen.getByText("No holdings yet")).toBeInTheDocument();
    expect(screen.getByText("Sync a portfolio to get started.")).toBeInTheDocument();
  });

  it("renders without a description", () => {
    render(<EmptyState title="Nothing here" />);

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders an optional action", () => {
    render(<EmptyState title="Empty" action={<button>Retry</button>} />);

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
