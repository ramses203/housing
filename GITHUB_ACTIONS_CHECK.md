# GitHub Actions Cron 실행 확인 및 해결 방법

## 문제 상황
- GitHub Actions Cron이 실행되지 않음
- `last_run`이 null (한 번도 실행되지 않음)

## 확인 단계

### 1. GitHub Actions 실행 상태 확인
1. https://github.com/ramses203/housing/actions 접속
2. "Blog Auto Generate" 워크플로우 확인
3. 실행 기록이 있는지 확인

### 2. GitHub Actions가 활성화되어 있는지 확인
1. https://github.com/ramses203/housing/settings/actions 접속
2. "Actions permissions" 섹션에서:
   - "Allow all actions and reusable workflows" 선택되어 있는지 확인
   - 또는 최소한 "Allow select actions and reusable workflows" 선택

### 3. 브랜치 확인
- Schedule cron은 **default 브랜치(master/main)에서만 실행**됨
- 현재 브랜치: `master` ✅
- `.github/workflows/blog-cron.yml` 파일이 master 브랜치에 있는지 확인

### 4. 수동 실행 테스트
1. https://github.com/ramses203/housing/actions 접속
2. "Blog Auto Generate" 클릭
3. "Run workflow" 버튼 클릭 (workflow_dispatch 옵션 때문에 가능)
4. 수동으로 실행해서 정상 작동하는지 확인

## 즉시 해결 방법

### 방법 1: 수동 실행으로 테스트 (추천)
```bash
# GitHub 웹에서:
# Actions → Blog Auto Generate → Run workflow 클릭
```

### 방법 2: 직접 API 호출 테스트
```bash
curl -X GET "https://dawn-housing.vercel.app/api/cron/blog-auto-generate"
```

### 방법 3: 로컬에서 스케줄러 테스트
```bash
# 서버 실행 후 관리자 페이지에서 "지금 생성하기" 클릭
npm start
# → http://localhost:7000/admin → AI 에이전트 탭 → "지금 생성하기"
```

## GitHub Actions Cron 작동 원리

### Cron 표현식
- `'0 * * * *'` = 매시간 00분 (UTC 기준)
- UTC 0시 = 한국 시간 09시
- UTC 24시 = 한국 시간 다음날 09시

### 한국 시간 09:00에 실행되려면
- UTC로는 00:00 (자정)
- 현재 cron: `0 * * * *` (매시간)
- 서버 로직에서 한국 시간 09시인지 체크함

### 실행 조건 (app.js 로직)
1. ✅ `is_enabled = true` (데이터베이스)
2. ✅ 현재 시간의 시간 부분이 설정 시간과 일치
3. ✅ 오늘 아직 실행하지 않음
4. ✅ 미사용 주제가 있음

## 문제 해결

### A. GitHub Actions가 실행되지 않는 경우
1. **Actions 권한 확인**
   - Settings → Actions → General → "Allow all actions" 선택

2. **워크플로우 활성화 확인**
   - Actions 탭에서 워크플로우가 비활성화되어 있지 않은지 확인
   - 비활성화되어 있다면 "Enable workflow" 클릭

3. **저장소 활동 확인**
   - 60일 이상 활동이 없으면 scheduled workflows가 자동 중지됨
   - 아무 커밋이나 하나 푸시하면 다시 활성화됨

### B. GitHub Actions는 실행되지만 블로그가 생성되지 않는 경우
1. **Vercel 환경 변수 확인**
   - Vercel Dashboard → Settings → Environment Variables
   - `BLOG_AUTO_ENABLED=true` 설정
   - `BLOG_SCHEDULE_TIME=09:00` 설정
   - `GEMINI_API_KEY` 설정 확인

2. **데이터베이스 설정 확인**
   ```sql
   SELECT * FROM agent_config;
   -- is_enabled가 true인지 확인
   ```

3. **Vercel 로그 확인**
   - Vercel Dashboard → Deployments → Logs
   - `/api/cron/blog-auto-generate` 호출 로그 확인

## 임시 대안: 외부 Cron 서비스 사용

GitHub Actions가 불안정하다면 외부 서비스 사용:

### cron-job.org (무료)
1. https://cron-job.org 회원가입
2. Create cronjob:
   - URL: `https://dawn-housing.vercel.app/api/cron/blog-auto-generate`
   - Schedule: Every hour (또는 매일 00:00 UTC)
   - Timezone: UTC
3. Save

### EasyCron (무료 플랜)
1. https://www.easycron.com 회원가입
2. Cron Expression: `0 * * * *`
3. URL: `https://dawn-housing.vercel.app/api/cron/blog-auto-generate`

## 즉시 테스트

현재 시간이 13:33이므로 설정을 13:00 또는 14:00로 변경해서 테스트:

```bash
# 1. 관리자 페이지에서 시간 변경
# → http://localhost:7000/admin
# → AI 에이전트 탭
# → 실행 시간을 14:00으로 변경

# 2. 수동 실행으로 즉시 테스트
# → "지금 생성하기" 버튼 클릭
```

## 현재 상태 요약
- ✅ `.env` 설정: BLOG_AUTO_ENABLED=true, BLOG_SCHEDULE_TIME=09:00
- ✅ 데이터베이스: is_enabled=true, schedule_time=09:00
- ✅ 미사용 주제: 1개
- ✅ GitHub Actions 파일: 존재함 (커밋됨)
- ❌ 실행 이력: 없음 (last_run=null)
- ⏰ 현재 시간: 13:33 (설정 시간 09:00 지남)

## 다음 실행 예정
- 내일(2025년 10월 14일) 오전 09:00 (한국 시간)
- GitHub Actions가 UTC 00:00에 실행되어 API 호출
- 서버가 한국 시간 09시인지 확인하고 블로그 생성

