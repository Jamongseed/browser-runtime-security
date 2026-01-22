import axios from "axios";

// 비로그인(user)이 접근하면 안 되는 admin 전용 페이지들
const ADMIN_ONLY_PREFIXES = ["/app/admin_front", "/app/domains", "/app/analytics"];

const checkAuth = () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role") || "user";
  const path = window.location.pathname;

  const isAdminOnlyPage = ADMIN_ONLY_PREFIXES.some((p) => path.startsWith(p));

  // 비로그인(user)
  if (!token) {
    // admin 전용 페이지 접근만 막고, 나머지 user 페이지는 허용
    if (isAdminOnlyPage) {
      window.location.replace("/login"); // 절대경로 + replace
    }

    return {
      token: null,
      role: "user",
      isLoggedIn: false,
    };
  }

  // 로그인(admin)일 때만 axios 설정
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  // 인터셉터는 매번 추가되면 중복 쌓임 → 한 번만 등록되도록 가드
  if (!axios.__HAS_LOADING_INTERCEPTORS__) {
    axios.__HAS_LOADING_INTERCEPTORS__ = true;

    axios.interceptors.request.use(
      function (config) {
        document.body.classList.add("loading-indicator");
        return config;
      },
      function (error) {
        document.body.classList.remove("loading-indicator");
        return Promise.reject(error);
      }
    );

    axios.interceptors.response.use(
      function (response) {
        document.body.classList.remove("loading-indicator");
        return response;
      },
      function (error) {
        document.body.classList.remove("loading-indicator");
        return Promise.reject(error);
      }
    );
  }

  return {
    token,
    role,
    isLoggedIn: true,
  };
};

export default checkAuth;

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");

  // ✅ 로그아웃 후 user 페이지로
  window.location.replace("/app/user_front");
}
