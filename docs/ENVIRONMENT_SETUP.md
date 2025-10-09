# 환경 변수 설정 가이드

블로그 자동 생성 기능에서 이미지가 포함되려면 다음 환경 변수들이 필요합니다.

## 필수 환경 변수

### 1. Gemini AI API (콘텐츠 생성)
```
GEMINI_API_KEY=your_gemini_api_key_here
```

**발급 방법**:
1. [Google AI Studio](https://makersuite.google.com/app/apikey) 접속
2. "Get API Key" 클릭
3. API 키 복사

---

### 2. Cloudinary (이미지 업로드)
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**발급 방법**:
1. [Cloudinary](https://cloudinary.com/) 가입/로그인
2. Dashboard에서 "Account Details" 확인
3. Cloud Name, API Key, API Secret 복사

---

### 3. 이미지 검색 API (하나 이상 필요)

#### 옵션 A: Unsplash (권장)
```
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
```

**발급 방법**:
1. [Unsplash Developers](https://unsplash.com/developers) 접속
2. "Register as a developer" 클릭
3. 새 애플리케이션 생성
4. Access Key 복사

**무료 사용량**: 50 requests/hour

---

#### 옵션 B: Pexels (백업용)
```
PEXELS_API_KEY=your_pexels_api_key
```

**발급 방법**:
1. [Pexels API](https://www.pexels.com/api/) 접속
2. "Get Started" 클릭하여 가입
3. API Key 발급받기

**무료 사용량**: 200 requests/hour

---

## 선택적 환경 변수

### 데이터베이스
```
DATABASE_URL=postgresql://username:password@host/database
```
> Neon Database 사용 시 자동 제공됨

### 세션
```
SESSION_SECRET=your_random_secret_string
```
> 랜덤 문자열 (예: `openssl rand -base64 32`)

### 블로그 자동 생성 설정
```
BLOG_AUTO_ENABLED=true
BLOG_SCHEDULE_TIME=09:00
```

---

## Vercel 환경 변수 설정 방법

### 방법 1: Vercel 대시보드 (권장)

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. 프로젝트 선택
3. **Settings** 탭 클릭
4. 왼쪽 메뉴에서 **Environment Variables** 선택
5. 각 환경 변수를 다음과 같이 추가:
   - **Key**: 환경 변수 이름 (예: `GEMINI_API_KEY`)
   - **Value**: 실제 값 입력
   - **Environments**: `Production`, `Preview`, `Development` 모두 체크
6. **Save** 클릭

### 방법 2: Vercel CLI

```bash
# Vercel CLI 설치
npm install -g vercel

# 로그인
vercel login

# 환경 변수 추가
vercel env add GEMINI_API_KEY production
vercel env add UNSPLASH_ACCESS_KEY production
vercel env add CLOUDINARY_CLOUD_NAME production
vercel env add CLOUDINARY_API_KEY production
vercel env add CLOUDINARY_API_SECRET production
```

### 환경 변수 적용

환경 변수를 추가한 후 **반드시 재배포**해야 적용됩니다:

```bash
# 자동 재배포 (GitHub에 푸시)
git add .
git commit -m "Update environment variables"
git push

# 또는 수동 재배포
vercel --prod
```

---

## 환경 변수 확인

### 로컬에서 확인

```bash
# 환경 변수 체크 스크립트 실행
node scripts/check-env.js
```

### Vercel 로그 확인

1. Vercel Dashboard → 프로젝트 선택
2. **Deployments** 탭
3. 최신 배포 클릭
4. **Functions** 로그에서 다음 메시지 확인:
   ```
   🔑 API 키 상태: {
     unsplash: '✅',
     pexels: '❌',
     cloudinary: '✅'
   }
   ```

---

## 문제 해결

### "이미지 검색 API 키가 설정되지 않았습니다"

**원인**: `UNSPLASH_ACCESS_KEY` 또는 `PEXELS_API_KEY`가 없음

**해결**:
1. Unsplash 또는 Pexels API 키 발급
2. Vercel 환경 변수에 추가
3. 재배포

### "Cloudinary 설정이 없습니다"

**원인**: Cloudinary 환경 변수가 불완전함

**해결**:
1. 다음 3개가 모두 설정되어 있는지 확인:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
2. Vercel 환경 변수 재확인
3. 재배포

### "이미지를 찾지 못했습니다"

**원인**: 키워드로 적절한 이미지가 검색되지 않음

**해결**:
1. 주제 추가 시 명확한 키워드 입력
   - 좋은 예: `황토집, 건강, 자연`
   - 나쁜 예: `의, 를, 에, 대한`
2. 영어 키워드 추가 시도
   - 예: `earth house, health, nature`

---

## 권장 설정

최적의 블로그 이미지 품질을 위해 다음과 같이 설정하는 것을 권장합니다:

```env
# AI 콘텐츠 생성
GEMINI_API_KEY=your_key_here

# 이미지 검색 (Unsplash 우선, Pexels 백업)
UNSPLASH_ACCESS_KEY=your_unsplash_key
PEXELS_API_KEY=your_pexels_key

# 이미지 업로드
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# 자동 생성 활성화
BLOG_AUTO_ENABLED=true
BLOG_SCHEDULE_TIME=09:00
```

이렇게 설정하면:
- ✅ 고품질 이미지 자동 검색
- ✅ 블로그 포스트당 2-3개 이미지 삽입
- ✅ 콘텐츠와 관련된 적절한 이미지 배치
- ✅ 이미지 출처 자동 표시

