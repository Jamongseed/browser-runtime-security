// features/events/eventApi.js
import { brsQueryApi } from "../aws/BRSQuery.ts";

export async function getEventBody({ eventId }) {
  if (!eventId) throw new Error("MISSING_eventId");
  return await brsQueryApi.eventBody({ eventId });
}
