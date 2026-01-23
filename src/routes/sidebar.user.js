// front\src\routes\sidebar.user.js
/** Icons are imported separatly to reduce build time */
import {
  Squares2X2Icon,
  ArrowRightOnRectangleIcon,
  UserIcon,
  ChartBarIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";

const iconClasses = `h-6 w-6`;
const submenuIconClasses = `h-5 w-5`;

const routes = [
  {
    path: "/app/user_front",
    icon: <Squares2X2Icon className={iconClasses} />,
    name: "User Dashboard",
  },
  {
    path: "/app/user_front/listpage_session",
    icon: <UserIcon className={iconClasses} />,
    name: "User SessionList",
  },
  {
    path: "/app/user_front/listpage_domain",
    icon: <GlobeAltIcon className={iconClasses} />,
    name: "User DomainList",
  },
  {
    path: "/app/login",
    icon: <ArrowRightOnRectangleIcon className={iconClasses} />,
    name: "Admin Login",
  },
  {
    path: "/app/charts",
    icon: <ChartBarIcon className={iconClasses} />,
    name: "Analytics",
  },
];

export default routes;
