import ReactDOM from "react-dom/client";

import React from "react";
import ApplicationProviders from "./providers/application.provider";
import "./styles/globals.css";

function App() {
  return <ApplicationProviders />;
}

const rootElement = document.getElementById("app")!;
window.electron.health().then((res) => {
  console.log("Health Check:", res);
});
window.electron.auth.login("testuser", "Password123!").then((res) => {
  console.log("Login Response:", res);
});

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
