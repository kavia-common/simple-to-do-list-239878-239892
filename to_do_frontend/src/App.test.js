import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app title", () => {
  render(<App />);
  // Title uses a non-breaking hyphen (U+2011) between "To" and "Do".
  const title = screen.getByText(/retro to[\-‑]do/i);
  expect(title).toBeInTheDocument();
});
