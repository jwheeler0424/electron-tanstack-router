import ReactDOM from "react-dom/client";

import React from "react";
import ApplicationProviders from "./providers/application.provider";
import "./styles/globals.css";

function App() {
  return <ApplicationProviders />;
}

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
