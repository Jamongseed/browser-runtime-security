import TemplatePointers from "./components/TemplatePointers"

function LandingIntro() {
  return (
    <div className="hero min-h-full rounded-l-xl bg-base-200">
      <div className="hero-content py-12">
        <div className="max-w-md text-center">

          {/* 로고 + 서비스명 */}
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            
            Browser Runtime Security
          </h1>

          <p className="mt-4 text-sm opacity-70">
            
          </p>
          
          {/* 프로젝트 설명 */}
          <TemplatePointers />

        </div>
      </div>
    </div>
  )
}

export default LandingIntro
