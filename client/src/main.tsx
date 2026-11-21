import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource-variable/golos-text";
import "katex/dist/katex.min.css";
import "./index.css";

try {
  const saved = localStorage.getItem("mathaz-theme");
  const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
} catch { /* storage unavailable: stay light */ }

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
