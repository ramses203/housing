# 새벽하우징 - 황토방 풍경

새벽하우징의 공식 웹사이트입니다.

## 주요 기능

- 🏡 황토방 갤러리
- 🛍️ 상품 관리
- 📝 블로그 시스템
- 🤖 AI 기반 블로그 자동 생성
- 👁️ IP 기반 조회수 추적

## 기술 스택

- **Backend**: Node.js, Express
- **Database**: Neon (PostgreSQL)
- **Hosting**: Vercel
- **AI**: Google Gemini 2.0 Flash
- **Storage**: Cloudinary
- **Automation**: GitHub Actions

## 블로그 자동 생성

이 프로젝트는 GitHub Actions를 사용하여 매시간 블로그 자동 생성을 체크합니다.

### 작동 방식

1. GitHub Actions가 매시간 00분에 실행
2. 관리자 페이지에서 설정한 시간 확인
3. 현재 시간이 설정한 시간과 일치하면 블로그 생성
4. 하루에 한 번만 실행

### 관리자 설정

관리자 페이지(`/admin`)에서:
- 실행 시간 변경 (연필 아이콘 클릭)
- 에이전트 활성화/비활성화
- 주제 추가/관리
- 수동 생성 ("지금 생성하기" 버튼)

## 환경 변수

```env
# Database
DATABASE_URL=your_neon_database_url

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Session
SESSION_SECRET=your_session_secret

# Cron (선택사항, 보안 강화용)
CRON_SECRET=your_cron_secret
```

## 로컬 실행

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm start
```

## 배포

Vercel에 자동 배포됩니다:
- GitHub에 푸시하면 자동으로 배포
- 배포 상태는 Vercel 대시보드에서 확인

## 라이선스

© 2025 새벽하우징. All rights reserved.

