import { getSidebarRoutes } from '../routes/sidebar'
import { NavLink, Link, useLocation } from 'react-router-dom'
import SidebarSubmenu from './SidebarSubmenu'
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon'
import { useDispatch } from 'react-redux'

function LeftSidebar() {
  const location = useLocation()
  const dispatch = useDispatch()

  const routes = getSidebarRoutes()

  const close = () => {
    document.getElementById('left-sidebar-drawer').click()
  }

  // ✅ path가 상대경로로 들어와도 무조건 절대경로로 보정
  const normalizePath = (p) => {
    if (!p) return '/app/dashboard'
    return p.startsWith('/') ? p : `/${p}`
  }

  return (
    <div className="drawer-side z-30">
      <label htmlFor="left-sidebar-drawer" className="drawer-overlay"></label>
      <ul className="menu pt-2 w-80 bg-base-100 min-h-full text-base-content">
        <button
          className="btn btn-ghost bg-base-300 btn-circle z-50 top-0 right-0 mt-4 mr-2 absolute lg:hidden"
          onClick={close}
        >
          <XMarkIcon className="h-5 inline-block w-5" />
        </button>

        <li className="mb-2 font-semibold text-xl">
          <Link to="/app/dashboard">
            <img
              className="mask mask-squircle w-10"
              src="/logo192.png"
              alt="DashWind Logo"
            />
            DashWind
          </Link>
        </li>

        {routes.map((route, k) => {
          const toPath = normalizePath(route.path)

          return (
            <li key={k}>
              {route.submenu ? (
                <SidebarSubmenu {...route} />
              ) : (
                <NavLink
                  end
                  to={toPath}
                  onClick={(e) => {
                    if (route.onClick) {
                      e.preventDefault()
                      route.onClick()
                    }
                  }}
                  className={({ isActive }) =>
                    `${isActive ? 'font-semibold bg-base-200' : 'font-normal'}`
                  }
                >
                  {route.icon} {route.name}
                  {location.pathname === toPath && (
                    <span
                      className="absolute inset-y-0 left-0 w-1 rounded-tr-md rounded-br-md bg-primary"
                      aria-hidden="true"
                    />
                  )}
                </NavLink>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default LeftSidebar
