// front\src\routes\sidebar.user.js
/** Icons are imported separatly to reduce build time */
import {
  Squares2X2Icon,
  ArrowRightOnRectangleIcon,
  UserIcon,
  ChartBarIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { getInstallId } from "../app/auth";

const iconClasses = `h-6 w-6`;
const submenuIconClasses = `h-5 w-5`;

const routes = [
  {
    path: "/app/user_front/dashboard/",
    icon: <ChartBarIcon className={iconClasses} />,
    name: "대시보드",
  },
  {
    path: "/app/user_front/listpage_session/",
    icon: <UserIcon className={iconClasses} />,
    name: "세션별 조회",
  },
  {
    path: "/app/user_front/listpage_domain/",
    icon: <GlobeAltIcon className={iconClasses} />,
    name: "도메인별 조회",
  },
];

export default routes;
