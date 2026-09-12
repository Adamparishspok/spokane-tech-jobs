import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./design/theme.css";
import { App } from "./app/app";
import { DirectoryProvider } from "./db/directory";
import { MineProvider } from "./db/mine";

/* No auth provider. The Neon SDK holds the session itself — including an
   anonymous token for readers with no account — so `useViewer` reads it
   directly and there is no context to wrap the tree in. */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DirectoryProvider>
      <MineProvider>
        <App />
      </MineProvider>
    </DirectoryProvider>
  </StrictMode>,
);
