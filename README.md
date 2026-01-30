# 🛡️ Browser Runtime Security (BRS)
[cite_start]**실시간 브라우저 위협 탐지 및 대응을 위한 보안 관리자 콘솔** 

[cite_start]본 프로젝트는 브라우저 실행 환경에서 발생하는 다양한 보안 위협을 실시간으로 탐지하고, AI 기반의 분석 결과를 통해 관리자 및 사용자에게 직관적인 보안 통찰력을 제공합니다. 

---

## 🚀 서비스 링크
* [cite_start]**보안 관리자 콘솔**: [https://browser-runtime-security.vercel.app/app/login](https://browser-runtime-security.vercel.app/app/login) 
* [cite_start]**유저 대시보드**: [https://browser-runtime-security.vercel.app/app/user_front/dashboard/](https://browser-runtime-security.vercel.app/app/user_front/dashboard/) 

---

## 🛠️ 기술 스택 (Tech Stack)

### **Frontend**
* [cite_start]**Framework**: React JS v18.2.0 
* [cite_start]**Styling**: Tailwind CSS v3.3.6, Daisy UI v4.4.19 
* [cite_start]**State Management**: Redux Toolkit v1.9 
* [cite_start]**Routing**: React Router v6.4.3 
* [cite_start]**Visualization**: React ChartJS 2 v5 
* [cite_start]**Icons**: HeroIcons 
* [cite_start]**Template**: [DAISY UI Admin Dashboard Template](https://github.com/robbins23/daisyui-admin-dashboard-template) 이용 

### **Infrastructure & Backend**
* [cite_start]**Database**: AWS Dynamo DB 
* [cite_start]**API**: AWS LAMBDA 
* [cite_start]**Deployment**: Vercel 

---

## 🖥️ 주요 화면 구성

### **1. [cite_start]관리자(Admin) 페이지** 
* **로그인**: 관리자 인증 기능을 제공합니다. 
* [cite_start]**대시보드**: 위험도 비율(낮음/중간/높음), TOP 5 탐지 룰, 도메인별 통계를 시각화합니다. 
* [cite_start]**검색 페이지**: 특정 탐지 규칙 및 기간별로 위협 이력을 필터링하여 조회합니다. 
* **최근 리스트 조회**: 시스템에서 발생한 최신 보안 이벤트 리스트를 확인합니다. 
* [cite_start]**디테일 페이지**: 탐지된 위협의 상세 행위 분석 및 대응을 위한 상세 정보를 제공합니다. 

### **2. [cite_start]사용자(User) 페이지** 
* **사용자 대시보드**: 개인별 위험도 비율 및 도메인별 집계 데이터를 확인합니다. 
* [cite_start]**세션별 조회**: 세션 ID별 위협 발생 타임라인을 확인합니다. 
* [cite_start]**세션별 상세 조회**: 특정 세션 내 발생 시점별 점수 변화 및 상세 내역을 분석합니다. 
* **도메인별 조회**: 접속한 도메인별 위협 발생 현황을 파악합니다. 
* [cite_start]**디테일 페이지**: 개별 보안 이벤트에 대한 상세 분석 내용을 제공합니다. 

---

## 📦 설치 및 실행 방법

1. **저장소 클론 (Repository Clone)**
   ```bash
   git clone [https://github.com/robbins23/daisyui-admin-dashboard-template.git](https://github.com/robbins23/daisyui-admin-dashboard-template.git)
   npm start
   npm install
   