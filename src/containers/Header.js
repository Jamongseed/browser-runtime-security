import React from "react";
import { useSelector } from "react-redux";
import Bars3Icon from "@heroicons/react/24/outline/Bars3Icon";

function Header() {
  // Redux에서 pageTitle만 가져옵니다.
  const { pageTitle } = useSelector((state) => state.header);

  return (
    <>
      <div className="navbar sticky top-0 bg-base-100 z-10 shadow-md">
        {/* 1. 모바일용 햄버거 메뉴 (반드시 남겨두어야 모바일에서 사이드바를 열 수 있습니다) */}
        <div className="flex-1">
          <label
            htmlFor="left-sidebar-drawer"
            className="btn btn-primary drawer-button lg:hidden"
          >
            <Bars3Icon className="h-5 inline-block w-5" />
          </label>

          {/* 2. 페이지 제목만 출력 */}
          <h1 className="text-2xl font-semibold ml-2">{pageTitle}</h1>
        </div>

        {/* 우측 아이콘들이 있던 flex-none 영역을 아예 비워두거나 삭제합니다. */}
        <div className="flex-none">{/* 비어 있음 */}</div>
      </div>
    </>
  );
}

export default Header;
