import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PageShell from "./components/PageShell";
import "./index.css"; // asegúrate de que este archivo existe (abajo)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PageShell>
      <App />
    </PageShell>
  </React.StrictMode>
);
