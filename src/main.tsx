import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // Ensure this is present

document.title = "SASP Dashboard"; // Dynamically set the title

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
