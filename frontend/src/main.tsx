import React from "react";
import { createRoot } from "react-dom/client";
import AdminPortal from "./auth/AdminPortal";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminPortal />
  </React.StrictMode>,
);
