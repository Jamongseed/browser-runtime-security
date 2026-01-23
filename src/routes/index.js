import { lazy } from "react";

const Login = lazy(() => import("../pages/Login"));
//const EventList = lazy(() => import('../features/events/EventListPage'))

const AdminEventDetailPage = lazy(
  () => import("../features/admin_front/detail"),
);
//const DomainRanking = lazy(() => import('../features/domains/DomainRankingPage'))
//const Analytics = lazy(() => import('../features/analytics/AnalyticsPage'))
const UserDashboard = lazy(() => import("../features/user_front"));
const UserSessionList = lazy(
  () => import("../features/user_front/listpage_session"),
);
const UserSessionDetail = lazy(
  () => import("../features/user_front/listpage_session/detail"),
);
const UserDomainList = lazy(
  () => import("../features/user_front/listpage_domain"),
);
const UserDetail = lazy(() => import("../features/user_front/detail"));

const AdminDashboard = lazy(() => import("../features/admin_front"));
const AdminSearch = lazy(() => import("../features/admin_front/admin_search"));

const Welcome = lazy(() => import("../pages/protected/Welcome"));
const Page404 = lazy(() => import("../pages/protected/404"));
const Blank = lazy(() => import("../pages/protected/Blank"));
const Leads = lazy(() => import("../pages/protected/Leads"));
const Integration = lazy(() => import("../pages/protected/Integration"));
const Calendar = lazy(() => import("../pages/protected/Calendar"));
const Team = lazy(() => import("../pages/protected/Team"));
const Transactions = lazy(() => import("../pages/protected/Transactions"));
const Bills = lazy(() => import("../pages/protected/Bills"));
const ProfileSettings = lazy(
  () => import("../pages/protected/ProfileSettings"),
);
const GettingStarted = lazy(() => import("../pages/GettingStarted"));
const DocFeatures = lazy(() => import("../pages/DocFeatures"));
const DocComponents = lazy(() => import("../pages/DocComponents"));

const routes = [
  {
    path: "/login",
    component: Login,
  },
  {
    path: "/admin_front/:eventId",
    component: AdminEventDetailPage,
  },

  // 보안 운영 페이지 추가
  /*
 {
   path: '/events',
   component: EventList,
 },
 {
   path: '/events/:eventId',
   component: EventDetail,
 },
 {
   path: '/domains',
   component: DomainRanking,
 },
 
 {
   path: '/analytics',
   component: Analytics,
 },
 */
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
    path: "/admin_front/detail/:eventId",
    component: UserDetail,
  },

  // 기존 유지
  //{ path: "/welcome", component: Welcome },
  //{ path: "/leads", component: Leads },
  //{ path: "/settings-team", component: Team },
  //{ path: "/calendar", component: Calendar },
  //{ path: "/transactions", component: Transactions },
  //{ path: "/settings-profile", component: ProfileSettings },
  //{ path: "/settings-billing", component: Bills },
  //{ path: "/getting-started", component: GettingStarted },
  //{ path: "/features", component: DocFeatures },
  //{ path: "/components", component: DocComponents },
  //{ path: "/integration", component: Integration },
  //{ path: "/charts", component: Charts },
  //{ path: "/404", component: Page404 },
  //{ path: "/blank", component: Blank },
];

export default routes;
