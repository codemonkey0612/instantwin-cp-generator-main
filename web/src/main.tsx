import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://724f3e72a58872f11f56ee2579f83945@o1081256.ingest.us.sentry.io/4510040225742848",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("ルート要素が見つかりませんでした。");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
