import TemplatePointers from "./components/TemplatePointers";

function LandingIntro() {
  return (
    <div className="hero rounded-l-xl bg-base-200">
      <div className="hero-content py-24">
        <div className="max-w-md text-center -mt-20">
          <img
            src="/notification_icon.png"
            alt="Browser Runtime Security Illustration"
            className="mx-auto mb-0 w-80 opacity-90"
          />
          <h1 className="text-3xl font-bold flex items-center justify-center gap-1">
            Browser Runtime Security
          </h1>
          <h2 className="mt-2 text-lg font-medium opacity-80">
            Admin Dashboard
          </h2>


          <p className="mt-4 text-sm opacity-70"></p>

          {/* 프로젝트 설명 */}
          <TemplatePointers />
        </div>
      </div>
    </div>
  );
}

export default LandingIntro;
