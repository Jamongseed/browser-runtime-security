import { useState } from "react";
import { Link } from "react-router-dom";
import LandingIntro from "./LandingIntro";
import ErrorText from "../../components/Typography/ErrorText";
import InputText from "../../components/Input/InputText";

function Login() {
  const INITIAL_LOGIN_OBJ = {
    password: "",
    emailId: "",
  };

  const ADMIN_ACCOUNT = {
    emailId: "admin@admin.com",
    password: "admin!234",
  };

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loginObj, setLoginObj] = useState(INITIAL_LOGIN_OBJ);

  const submitForm = (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (loginObj.emailId.trim() === "")
      return setErrorMessage("Admin ID is required!");
    if (loginObj.password.trim() === "")
      return setErrorMessage("Password is required!");

    setLoading(true);

    if (
      loginObj.emailId === ADMIN_ACCOUNT.emailId &&
      loginObj.password === ADMIN_ACCOUNT.password
    ) {
      localStorage.setItem("token", "AdminDummyToken");
      localStorage.setItem("role", "admin");

      setLoading(false);
      window.location.href = "/app/admin_front";
    } else {
      setLoading(false);
      setErrorMessage("Invalid admin credentials. (Demo: admin / admin)");
    }
  };

  const updateFormValue = ({ updateType, value }) => {
    setErrorMessage("");
    setLoginObj({ ...loginObj, [updateType]: value });
  };

  const fillDemoAccount = () => {
    setErrorMessage("");
    setLoginObj({
      emailId: ADMIN_ACCOUNT.emailId,
      password: ADMIN_ACCOUNT.password,
    });
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center">
      <div className="card mx-auto w-full max-w-5xl shadow-xl">
        <div className="grid md:grid-cols-2 grid-cols-1 bg-base-100 rounded-xl">
          <div className="">
            <LandingIntro />
          </div>

          <div className="py-24 px-10">
            <h2 className="text-2xl font-semibold mb-2 text-center">
              Admin Login
            </h2>

            <form onSubmit={submitForm}>
              <div className="mb-4">
                <InputText
                  type="text"
                  defaultValue={loginObj.emailId}
                  updateType="emailId"
                  containerStyle="mt-4"
                  labelTitle="Admin ID"
                  updateFormValue={updateFormValue}
                />

                <InputText
                  defaultValue={loginObj.password}
                  type="password"
                  updateType="password"
                  containerStyle="mt-4"
                  labelTitle="Password"
                  updateFormValue={updateFormValue}
                />
              </div>

              {/* 데모 계정 자동 입력 버튼 */}
              <button
                type="button"
                className="btn btn-outline w-full"
                onClick={fillDemoAccount}
                disabled={loading}
              >
                데모 계정 자동 입력
              </button>

              <div className="text-right text-primary mt-2">
                <Link to="/forgot-password">
                  <span className="text-sm inline-block hover:text-primary hover:underline hover:cursor-pointer transition duration-200">
                    Forgot Password?
                  </span>
                </Link>
              </div>

              <ErrorText styleClass="mt-6">{errorMessage}</ErrorText>

              <button
                type="submit"
                className={
                  "btn mt-2 w-full btn-primary" + (loading ? " loading" : "")
                }
              >
                Login
              </button>

              <div className="text-center mt-4">
                Don&apos;t have an account yet?{" "}
                <Link to="/register">
                  <span className="inline-block hover:text-primary hover:underline hover:cursor-pointer transition duration-200">
                    Register
                  </span>
                </Link>
              </div>

              {/* (선택) 발표용 힌트 고정 표시 */}
              <div className="text-center mt-3 text-xs opacity-60">
                Demo Admin: <span className="font-mono">admin / admin</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
