import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockPath = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath,
  useSearchParams: () => new URLSearchParams(),
}));

import { NavigationProgress } from "./navigation-progress";

function bar(container: HTMLElement) {
  return container.querySelector('[aria-hidden="true"]') as HTMLElement;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockPath = "/dashboard";
});
afterEach(() => vi.useRealTimers());

describe("NavigationProgress", () => {
  it("shows when an internal link is clicked and finishes when the path changes", () => {
    const link = document.createElement("a");
    link.href = "/portfolios";
    document.body.appendChild(link);
    const { container, rerender } = render(<NavigationProgress />);
    expect(bar(container).style.opacity).toBe("0");

    fireEvent.click(link);
    expect(bar(container).style.opacity).toBe("1");

    mockPath = "/portfolios";
    rerender(<NavigationProgress />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(bar(container).style.opacity).toBe("0");
    link.remove();
  });

  it("ignores external links and clicks that stay on the same page", () => {
    const external = document.createElement("a");
    external.href = "https://example.com/x";
    const same = document.createElement("a");
    same.href = "/dashboard";
    document.body.append(external, same);
    // jsdom can't navigate; stop the default after the component's capture listener has run.
    const stopNavigation = (event: Event) => event.preventDefault();
    document.addEventListener("click", stopNavigation);
    const { container } = render(<NavigationProgress />);

    fireEvent.click(external);
    fireEvent.click(same);

    expect(bar(container).style.opacity).toBe("0");
    document.removeEventListener("click", stopNavigation);
    external.remove();
    same.remove();
  });
});
