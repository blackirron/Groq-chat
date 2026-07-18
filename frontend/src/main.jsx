import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ShareView from "./ShareView.jsx";
import "./theme.css";
import "./App.css";

// Simple path-based routing for exactly one extra route (/share/:id).
// Not pulling in react-router for a single static route — if this
// grows more routes later, that's the point to add it for real.
const shareMatch = window.location.pathname.match(/^\/share\/([\w-]+)\/?$/);

const rootEl = document.getElementById("root");
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    {shareMatch ? <ShareView shareId={shareMatch[1]} /> : <App />}
  </React.StrictMode>
);
