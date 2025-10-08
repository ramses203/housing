# 블로그 자동 포스팅 에이전트 사용 가이드

## 개요
Google Gemini API를 사용하여 매일 자동으로 블로그 포스트를 생성하는 AI 에이전트입니다.
Unsplash/Pexels 무료 이미지 API를 통해 본문에 자동으로 이미지를 삽입합니다.

## 설치 및 설정

### 1. 환경 변수 설정 (.env)

`.env` 파일에 다음 API 키들을 추가해야 합니다:

```env
# Google Gemini API (필수)
GEMINI_API_KEY=your_gemini_api_key

# 이미지 API (둘 중 하나 이상 필수)
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
PEXELS_API_KEY=your_pexels_api_key

# 스케줄 설정
BLOG_SCHEDULE_TIME=09:00
BLOG_AUTO_ENABLED=true
```

#### API 키 발급 방법:

**Google Gemini API:**
1. https://makersuite.google.com/app/apikey 접속
2. Google 계정으로 로그인
3. "Create API Key" 클릭
4. 생성된 API 키 복사

**Unsplash API (무료):**
1. https://unsplash.com/developers 접속
2. "Register as a developer" 클릭
3. 새 앱 생성
4. Access Key 복사 (시간당 50 requests)

**Pexels API (무료):**
1. https://www.pexels.com/api/ 접속
2. "Get Started" 클릭
3. API Key 복사 (시간당 200 requests)

### 2. 의존성 설치

```bash
npm install
```

### 3. 초기 주제 데이터 삽입

데이터베이스에 초기 주제 리스트를 추가합니다:

```sql
-- data/initial_topics.sql 파일의 내용을 데이터베이스에서 실행
-- 또는 관리자 페이지에서 수동으로 주제를 추가
```

### 4. 서버 시작

```bash
npm start
```

서버가 시작되면 2초 후 자동으로 스케줄러가 활성화됩니다.

## 사용 방법

### 관리자 페이지 접근

1. `/admin` 또는 `/admin.html` 접속
2. 로그인 (기본 비밀번호: `bae1234!`)
3. "AI 에이전트" 탭 클릭

### 주요 기능

#### 1. 에이전트 상태 모니터링
- **상태**: 활성화/비활성화 확인
- **실행 시간**: 매일 자동 실행 시간 (기본: 09:00)
- **미사용 주제**: 사용 가능한 주제 개수
- **마지막 실행**: 마지막 블로그 생성 시간

#### 2. 주제 관리
- **주제 추가**: 새로운 블로그 주제 추가
- **키워드 입력**: 이미지 검색에 사용될 키워드 (쉼표로 구분)
- **주제 삭제**: 불필요한 주제 삭제
- **주제 리셋**: 모든 주제를 미사용 상태로 되돌림

#### 3. 수동 생성
- "지금 생성하기" 버튼 클릭
- 1-2분 소요
- 자동으로 다음 미사용 주제 선택
- 이미지 자동 삽입 및 Cloudinary 업로드
- 블로그 포스트 자동 저장

#### 4. 에이전트 제어
- **활성화/비활성화**: 자동 생성 켜기/끄기
- **주제 리셋**: 사용된 주제를 다시 사용 가능하게 변경

## 작동 원리

### 자동 생성 프로세스

1. **스케줄 실행**: 매일 설정된 시간(기본 09:00)에 자동 실행
2. **주제 선택**: DB에서 미사용 주제를 순차적으로 선택
3. **중복 방지**: 최근 10개 포스트 제목 분석하여 중복 방지
4. **콘텐츠 생성**: Gemini AI가 2000-3000자 분량의 HTML 콘텐츠 생성
5. **이미지 검색**: 주제 키워드로 Unsplash/Pexels에서 이미지 검색
6. **이미지 업로드**: Cloudinary에 이미지 업로드
7. **이미지 삽입**: 본문에 2-3개의 이미지 자동 삽입
8. **포스트 저장**: DB에 저장 및 자동 발행
9. **주제 표시**: 사용된 주제를 "사용됨"으로 표시

### 이미지 삽입 로직

- 본문을 문단 단위로 분석
- 전체 문단을 균등하게 나누어 이미지 배치
- 각 이미지에 출처 표시 (photographer, source)
- 첫 번째 이미지는 자동으로 썸네일로 설정

### 주제 순환

- 모든 주제를 사용하면 자동으로 리셋
- 리셋 후 다시 처음부터 순차 진행
- 수동으로 "주제 리셋" 버튼으로도 가능

## 파일 구조

```
housing/
├── services/
│   ├── blogAgent.js      # AI 콘텐츠 생성 로직
│   ├── imageService.js   # 이미지 검색 및 업로드
│   └── scheduler.js      # 크론 스케줄러
├── data/
│   └── initial_topics.sql # 초기 주제 데이터
├── app.js                # API 엔드포인트
├── public/
│   └── admin.html        # 관리자 UI
└── .env                  # 환경 변수
```

## API 엔드포인트

### 주제 관리
- `GET /api/blog/topics` - 주제 목록 조회
- `POST /api/blog/topics` - 주제 추가
- `DELETE /api/blog/topics/:id` - 주제 삭제
- `POST /api/blog/topics/reset` - 주제 리셋

### 에이전트 제어
- `POST /api/blog/auto-generate` - 수동 생성 트리거
- `GET /api/blog/agent-status` - 에이전트 상태 조회
- `PUT /api/blog/agent-config` - 에이전트 설정 변경

## 문제 해결

### 블로그가 생성되지 않는 경우

1. **API 키 확인**: `.env` 파일의 `GEMINI_API_KEY` 확인
2. **주제 확인**: 미사용 주제가 있는지 확인
3. **에이전트 상태**: 활성화되어 있는지 확인
4. **로그 확인**: 콘솔에서 에러 메시지 확인

### 이미지가 삽입되지 않는 경우

1. **이미지 API 키**: Unsplash 또는 Pexels API 키 확인
2. **Cloudinary 설정**: Cloudinary 환경 변수 확인
3. **키워드 확인**: 주제에 적절한 키워드가 있는지 확인

### 스케줄러가 작동하지 않는 경우

1. **환경 변수**: `BLOG_AUTO_ENABLED=true` 확인
2. **시간 형식**: `BLOG_SCHEDULE_TIME`이 `HH:MM` 형식인지 확인
3. **서버 재시작**: 설정 변경 후 서버 재시작

## 주의사항

1. **API 제한**: 무료 API는 요청 제한이 있습니다
   - Gemini: 일일 제한 확인 필요
   - Unsplash: 시간당 50 requests
   - Pexels: 시간당 200 requests

2. **생성 시간**: 블로그 생성에 1-2분 소요

3. **Cloudinary 용량**: 무료 플랜은 용량 제한이 있습니다

4. **중복 방지**: 최근 10개 포스트만 분석하므로 완벽한 중복 방지는 아닙니다

## 커스터마이징

### 스케줄 시간 변경

`.env` 파일에서 변경:
```env
BLOG_SCHEDULE_TIME=14:30  # 오후 2시 30분
```

### 콘텐츠 길이 조정

`services/blogAgent.js` 파일의 프롬프트에서 수정:
```javascript
// "본문은 2000-3000자 분량으로 작성하세요"
// → "본문은 1000-1500자 분량으로 작성하세요"
```

### 이미지 개수 조정

`services/blogAgent.js`의 `generateBlogPost` 함수에서:
```javascript
const imageCount = Math.min(imageKeywords.length, 3); // 3을 원하는 개수로 변경
```

## 지원

문제가 발생하거나 질문이 있으시면 이슈를 등록해주세요.

