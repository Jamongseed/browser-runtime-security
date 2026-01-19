// src/routes/index.js (업로드된 파일 기준)

import { lazy } from 'react'

const Dashboard = lazy(() => import('../pages/protected/Dashboard'))
const EventList = lazy(() => import('../features/events/EventListPage'))
const EventDetail = lazy(() => import('../features/events/EventDetailPage'))
const DomainRanking = lazy(() => import('../features/domains/DomainRankingPage'))
const Analytics = lazy(() => import('../features/analytics/AnalyticsPage'))

const Welcome = lazy(() => import('../pages/protected/Welcome'))
const Page404 = lazy(() => import('../pages/protected/404'))
const Blank = lazy(() => import('../pages/protected/Blank'))
const Charts = lazy(() => import('../pages/protected/Charts'))
const Leads = lazy(() => import('../pages/protected/Leads'))
const Integration = lazy(() => import('../pages/protected/Integration'))
const Calendar = lazy(() => import('../pages/protected/Calendar'))
const Team = lazy(() => import('../pages/protected/Team'))
const Transactions = lazy(() => import('../pages/protected/Transactions'))
const Bills = lazy(() => import('../pages/protected/Bills'))
const ProfileSettings = lazy(() => import('../pages/protected/ProfileSettings'))
const GettingStarted = lazy(() => import('../pages/GettingStarted'))
const DocFeatures = lazy(() => import('../pages/DocFeatures'))
const DocComponents = lazy(() => import('../pages/DocComponents'))

const routes = [
  {
    path: '/dashboard',
    component: Dashboard,
  },

 // 보안 운영 페이지 추가
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

  // 기존 유지
  { path: '/welcome', component: Welcome },
  { path: '/leads', component: Leads },
  { path: '/settings-team', component: Team },
  { path: '/calendar', component: Calendar },
  { path: '/transactions', component: Transactions },
  { path: '/settings-profile', component: ProfileSettings },
  { path: '/settings-billing', component: Bills },
  { path: '/getting-started', component: GettingStarted },
  { path: '/features', component: DocFeatures },
  { path: '/components', component: DocComponents },
  { path: '/integration', component: Integration },
  { path: '/charts', component: Charts },
  { path: '/404', component: Page404 },
  { path: '/blank', component: Blank },
]

export default routes
