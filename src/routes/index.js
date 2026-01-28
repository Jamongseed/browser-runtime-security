import { lazy } from "react";
import { UserEventDetailRouter, AdminEventDetailRouter } from "./eventdetailrouter";

const Login = lazy(() => import("../pages/Login"));

const UserDashboard = lazy(() => import("../features/user_front"));
const UserSessionList = lazy(() => import("../features/user_front/listpage_session"),);
const UserSessionDetail = lazy(() => import("../features/user_front/listpage_session/detail"),);
const UserDomainList = lazy(() => import("../features/user_front/listpage_domain"),);
const UserDetail = lazy(() => import("../features/user_front/detail"));

const AdminDashboard = lazy(() => import("../features/admin_front"));
const AdminSearch = lazy(() => import("../features/admin_front/admin_search"));
const AdminList = lazy(() => import("../features/admin_front/admin_list"));
const routes = [
  {
    path: "/login",
    component: Login,
  },
  {
    path: "/user_front",
    component: UserDashboard,
  },
  {
    path: "/user_front/dashboard",
    component: UserDashboard,
  },
  {
    path: "/user_front/dashboard/:installId",
    component: UserDashboard,
  },
  {
    path: "/user_front/listpage_session",
    component: UserSessionList,
  },
  {
    path: "/user_front/listpage_session/detail",
    component: UserSessionDetail,
  },
  {
    path: "/user_front/listpage_domain",
    component: UserDomainList,
  },
  {
    path: "/user_front/detail/:eventId",
    component: UserEventDetailRouter,
  },
  {
    path: "/admin_front",
    component: AdminDashboard,
  },
  {
    path: "/admin_front/admin_search",
    component: AdminSearch,
  },
  {
    path: "/admin_front/admin_list",
    component: AdminList,
  },
  {
    path: "/admin_front/detail/:eventId",
    component: AdminEventDetailRouter,
  },
];

export default routes;
