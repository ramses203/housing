# 블로그 자동 생성 Cron 설정 가이드

이 프로젝트는 **GitHub Actions**를 사용하여 매시간 블로그 자동 생성을 실행합니다.

## 현재 설정 (GitHub Actions) ✅

`.github/workflows/blog-cron.yml` 파일이 이미 설정되어 있습니다:
- **실행 주기**: 매시간 00분 (UTC 기준)
- **작동 방식**: 
  1. 매시간 `/api/cron/blog-auto-generate` API 호출
  2. 서버에서 현재 시간과 관리자 페이지 설정 시간 비교
  3. 일치하면 블로그 자동 생성
  4. 하루에 한 번만 실행되도록 중복 방지

## 확인 방법

GitHub Repository → Actions 탭에서 워크플로우 실행 상태 확인 가능

## 대안: 외부 Cron 서비스

GitHub Actions 외에도 다음 서비스들을 사용할 수 있습니다:

## 방법 1: cron-job.org (추천)

### 1. 회원가입
- https://cron-job.org 접속
- 무료 회원가입

### 2. Cron Job 생성
1. Dashboard → Create cronjob 클릭
2. 설정 입력:
   - **Title**: "블로그 자동 생성"
   - **URL**: `https://dawn-housing.vercel.app/api/cron/blog-auto-generate`
   - **Schedule**: 
     - Type: `Every hour` 선택
     - 또는 Custom으로 특정 시간 설정 (예: 매일 09:00 KST)
   - **Timezone**: `Asia/Seoul` 선택
   - **Method**: `GET` 선택

3. Save 클릭

### 3. 보안 강화 (선택사항)
Vercel 환경 변수에 `CRON_SECRET` 추가:
1. Vercel Dashboard → Settings → Environment Variables
2. `CRON_SECRET` = `your-random-secret-key-123` (원하는 값으로 변경)
3. Redeploy

cron-job.org 설정:
1. Edit Job → Request method → Headers 추가
2. `Authorization: Bearer your-random-secret-key-123`

---

## 방법 2: EasyCron

### 1. 회원가입
- https://www.easycron.com 접속
- 무료 플랜 (월 100회 실행 가능)

### 2. Cron Job 생성
1. Create New Cron Job 클릭
2. 설정:
   - **URL**: `https://dawn-housing.vercel.app/api/cron/blog-auto-generate`
   - **Cron Expression**: 
     - 매시간: `0 * * * *`
     - 매일 9시: `0 9 * * *`
   - **Time Zone**: `Asia/Seoul`

---

## 방법 3: GitHub Actions (무료, 추천)

`.github/workflows/blog-cron.yml` 파일 생성:

```yaml
name: Blog Auto Generate

on:
  schedule:
    # 매시간 실행 (UTC 시간)
    - cron: '0 * * * *'
  workflow_dispatch: # 수동 실행 가능

jobs:
  generate-blog:
    runs-on: ubuntu-latest
    steps:
      - name: Call Blog Generate API
        run: |
          curl -X GET "https://dawn-housing.vercel.app/api/cron/blog-auto-generate" \
               -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### GitHub Secrets 설정:
1. GitHub Repository → Settings → Secrets and variables → Actions
2. New repository secret 클릭
3. Name: `CRON_SECRET`, Value: Vercel의 CRON_SECRET와 동일한 값

---

## 현재 동작 방식

1. Cron 서비스가 매시간 00분에 `/api/cron/blog-auto-generate` 호출
2. 서버는 현재 시간이 설정된 시간(예: 09:00)과 일치하는지 확인
3. 일치하면 블로그 자동 생성
4. 하루에 한 번만 실행되도록 중복 방지

## 관리자 페이지에서 설정

1. https://dawn-housing.vercel.app/admin 접속
2. AI 에이전트 탭 이동
3. "실행 시간" 옆 연필 아이콘 클릭
4. 원하는 시간 입력 (예: 14:30)
5. 다음날 해당 시간에 자동 실행됨

## 테스트

관리자 페이지에서 "지금 생성하기" 버튼으로 즉시 테스트 가능합니다.

