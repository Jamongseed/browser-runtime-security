// src/routes/sidebar.js (업로드된 파일 기준)

import Squares2X2Icon from '@heroicons/react/24/outline/Squares2X2Icon'
import TableCellsIcon from '@heroicons/react/24/outline/TableCellsIcon'
import DocumentTextIcon from '@heroicons/react/24/outline/DocumentTextIcon'
import GlobeAltIcon from '@heroicons/react/24/outline/GlobeAltIcon'
import ChartBarIcon from '@heroicons/react/24/outline/ChartBarIcon'

const iconClasses = `h-6 w-6`

const routes = [
  {
    path: '/app/dashboard',
    icon: <Squares2X2Icon className={iconClasses}/>, 
    name: 'Security Overview',
  },
  {
    path: '/app/events',
    icon: <TableCellsIcon className={iconClasses}/>,
    name: 'Event List',
  },
  {
    path: '/app/domains',
    icon: <GlobeAltIcon className={iconClasses}/>,
    name: 'Domain Ranking',
  },
  {
    path: '/app/analytics',
    icon: <ChartBarIcon className={iconClasses}/>,
    name: 'Trends / Stats',
  },
  {
    path: '/app/transactions',
    icon: <ChartBarIcon className={iconClasses}/>,
    name: 'User',
  },
]
export default routes
