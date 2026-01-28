// eventdetailrouter.js
import { lazy } from "react";
import { useParams } from "react-router-dom";

const UserEventDetailPage = lazy(() => import("../features/user_front/detail"));
const UserAIEventDetailPage = lazy(() => import("../features/user_front/aidetail"));
const AdminEventDetailPage = lazy(() => import("../features/admin_front/detail"));
const AdminAIEventDetailPage = lazy(() => import("../features/admin_front/aidetail"));

export function UserEventDetailRouter() {
  const { eventId } = useParams();
  const isAiEvent = eventId?.startsWith("AI_");

  return isAiEvent ? <UserAIEventDetailPage /> : <UserEventDetailPage />;
}

export function AdminEventDetailRouter() {
  const { eventId } = useParams();
  const isAiEvent = eventId?.startsWith("AI_");

  return isAiEvent ? <AdminAIEventDetailPage /> : <AdminEventDetailPage />;
}
