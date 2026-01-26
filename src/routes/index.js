import { lazy } from "react";

const Login = lazy(() => import("../pages/Login"));
const Dashboard = lazy(() => import("../features/dashboard"));

const UserDashboard = lazy(() => import("../features/user_front"));
const UserSessionList = lazy(() => import("../features/user_front/listpage_session"),);
const UserSessionDetail = lazy(() => import("../features/user_front/listpage_session/detail"),);
const UserDomainList = lazy(() => import("../features/user_front/listpage_domain"),);
const UserDetail = lazy(() => import("../features/user_front/detail"));

const AdminDashboard = lazy(() => import("../features/admin_front"));
const AdminSearch = lazy(() => import("../features/admin_front/admin_search"));
const AdminList = lazy(() => import("../features/admin_front/admin_list"));
const AdminEventDetailPage = lazy(() => import("../features/admin_front/detail"),);

const routes = [
  {
    path: "/login",
    component: Login,
  },
  {
    path: "/dashboard",
    component: Dashboard,
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
    component: UserDetail,
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
    component: AdminEventDetailPage,
  },
  {
    path: "/admin_front/:eventId",
    component: AdminEventDetailPage,
  },
];

export default routes;
