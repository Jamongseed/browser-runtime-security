// front\src\routes\sidebar.admin.js
/** Icons are imported separatly to reduce build time */
import DocumentTextIcon from "@heroicons/react/24/outline/DocumentTextIcon";
import Squares2X2Icon from "@heroicons/react/24/outline/Squares2X2Icon";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { ListBulletIcon } from "@heroicons/react/24/outline";
import ArrowLeftOnRectangleIcon from "@heroicons/react/24/outline/ArrowLeftOnRectangleIcon";
import { logout } from "../app/auth";

const iconClasses = `h-6 w-6`;
const submenuIconClasses = `h-5 w-5`;

const routes = [
  {
    path: "/app/admin_front",
    icon: <Squares2X2Icon className={iconClasses} />,
    name: "대시보드",
  },
  {
    path: "/app/admin_front/admin_list",
    icon: <ListBulletIcon className={iconClasses} />,
    name: "최근 이벤트",
  },
  {
    path: "/app/admin_front/admin_search",
    icon: <MagnifyingGlassIcon className={iconClasses} />,
    name: "검색 페이지",
  },
  {
    path: "/login",
    name: "Logout",
    icon: <ArrowLeftOnRectangleIcon className={iconClasses} />,
    onClick: () => logout(),
  },
];

export default routes;
