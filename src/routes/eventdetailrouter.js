// eventdetailrouter.js
import { lazy } from "react";
import { useParams } from "react-router-dom";

const UserEventDetailPage = lazy(() => import("../features/user_front/detail"));
const UserAIEventDetailPage = lazy(() => import("../features/user_front/aidetail"));
const UserRSEventDetailPage = lazy(() => import("../features/user_front/rsdetail"));

const AdminEventDetailPage = lazy(() => import("../features/admin_front/detail"));
const AdminAIEventDetailPage = lazy(() => import("../features/admin_front/aidetail"));
const AdminRSEventDetailPage = lazy(() => import("../features/admin_front/rsdetail"));

export function UserEventDetailRouter() {
  const { eventId } = useParams();
  const isAiEvent = eventId?.startsWith("AI_");
  const isRSEvent = eventId?.startsWith("RS_");

  if (isAiEvent) return <UserAIEventDetailPage />;
  if (isRSEvent) return <UserRSEventDetailPage />;
  return <UserEventDetailPage />;
}

export function AdminEventDetailRouter() {
  const { eventId } = useParams();
  const isAiEvent = eventId?.startsWith("AI_");
  const isRSEvent = eventId?.startsWith("RS_");

  if (isAiEvent) return <AdminAIEventDetailPage />;
  if (isRSEvent) return <AdminRSEventDetailPage />;
  return <AdminEventDetailPage />;
}
