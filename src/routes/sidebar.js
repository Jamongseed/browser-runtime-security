// src/routes/sidebar.js

import checkAuth from "../app/auth";   
import adminRoutes from "./sidebar.admin";
import userRoutes from "./sidebar.user";

export function getSidebarRoutes() {
  const { role } = checkAuth();
  return role === "admin" ? adminRoutes : userRoutes;
}

