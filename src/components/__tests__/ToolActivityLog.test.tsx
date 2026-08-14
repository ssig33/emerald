import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import ToolActivityLog from "../ToolActivityLog";
import { ToolInteraction } from "../../types";

const interactions: ToolInteraction[] = [
  {
    name: "browser_list_elements",
    arguments: '{"filter":"login","max_elements":null}',
    result: '[0] <button> "Log in"',
  },
  {
    name: "browser_click",
    arguments: '{"index":0,"selector":null}',
    result: 'Clicked <button> "Log in".',
  },
];

describe("ToolActivityLog", () => {
  it("renders nothing without interactions", () => {
    const { container } = render(<ToolActivityLog interactions={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("summarises how many actions ran", () => {
    render(<ToolActivityLog interactions={interactions} />);

    expect(screen.getByText("2 tool actions")).toBeInTheDocument();
  });

  it("uses the singular form for a single action", () => {
    render(<ToolActivityLog interactions={[interactions[0]]} />);

    expect(screen.getByText("1 tool action")).toBeInTheDocument();
  });

  it("reveals the call arguments and results when expanded", async () => {
    const user = userEvent.setup();
    render(<ToolActivityLog interactions={interactions} />);

    await user.click(screen.getByText("2 tool actions"));

    expect(
      screen.getByText('browser_list_elements(filter: "login")'),
    ).toBeInTheDocument();
    expect(screen.getByText("browser_click(index: 0)")).toBeInTheDocument();
    expect(screen.getByText('Clicked <button> "Log in".')).toBeInTheDocument();
  });

  it("keeps unparseable arguments readable", async () => {
    const user = userEvent.setup();
    render(
      <ToolActivityLog
        interactions={[{ name: "web_search", arguments: "oops", result: "ok" }]}
      />,
    );

    await user.click(screen.getByText("1 tool action"));

    expect(screen.getByText("web_search(oops)")).toBeInTheDocument();
  });
});
