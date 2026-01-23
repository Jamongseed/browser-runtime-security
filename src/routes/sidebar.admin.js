// front\src\routes\sidebar.admin.js
/** Icons are imported separatly to reduce build time */
import DocumentTextIcon from "@heroicons/react/24/outline/DocumentTextIcon";
import Squares2X2Icon from "@heroicons/react/24/outline/Squares2X2Icon";
import TableCellsIcon from "@heroicons/react/24/outline/TableCellsIcon";
import WalletIcon from "@heroicons/react/24/outline/WalletIcon";
import CodeBracketSquareIcon from "@heroicons/react/24/outline/CodeBracketSquareIcon";
import DocumentIcon from "@heroicons/react/24/outline/DocumentIcon";
import ExclamationTriangleIcon from "@heroicons/react/24/outline/ExclamationTriangleIcon";
import CalendarDaysIcon from "@heroicons/react/24/outline/CalendarDaysIcon";
import ArrowRightOnRectangleIcon from "@heroicons/react/24/outline/ArrowRightOnRectangleIcon";
import UserIcon from "@heroicons/react/24/outline/UserIcon";
import Cog6ToothIcon from "@heroicons/react/24/outline/Cog6ToothIcon";
import BoltIcon from "@heroicons/react/24/outline/BoltIcon";
import ChartBarIcon from "@heroicons/react/24/outline/ChartBarIcon";
import UsersIcon from "@heroicons/react/24/outline/UsersIcon";
import KeyIcon from "@heroicons/react/24/outline/KeyIcon";
import DocumentDuplicateIcon from "@heroicons/react/24/outline/DocumentDuplicateIcon";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
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
