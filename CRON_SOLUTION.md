# 블로그 자동 생성 - 정확한 시간 실행 해결

## 🔍 문제: GitHub Actions Cron이 정각에 실행되지 않음

### 실제 실행 시간 분석
- Run #20: **8:20 PM** (20분)
- Run #19: **7:29 PM** (29분)
- Run #18: **6:29 PM** (29분)
- Run #17: **5:35 PM** (35분)
- Run #11: **12:44 PM** (44분)
- Run #10: **11:00 AM** ✅ (유일하게 정각!)

### 원인
GitHub Actions의 scheduled cron은 **정확한 시간 보장 안 함**:
- `0 * * * *` (매시간 00분) 설정해도 0~59분 사이 랜덤 실행
- GitHub 서버 부하에 따라 지연 발생
- 특히 매시 정각에는 더 많이 지연됨
- [공식 문서](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule):
  > "The schedule event can be delayed during periods of high loads"

## ✅ 해결 방법 1: Vercel Cron (추천, 가장 정확)

### 설정 완료
`vercel.json`에 추가됨:
```json
{
  "crons": [
    {
      "path": "/api/cron/blog-auto-generate",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### 특징
- ✅ **정확히 UTC 00:00 (한국 시간 09:00)** 실행
- ✅ Vercel 자체 스케줄러 사용 (안정적)
- ✅ 설정 후 자동 적용 (재배포 시)
- ✅ 무료 플랜에서도 사용 가능

### 활성화 방법
1. 이 커밋 푸시
2. Vercel 자동 재배포
3. Vercel Dashboard → Settings → Cron Jobs에서 확인

## ✅ 해결 방법 2: cron-job.org (외부 서비스)

### 설정 방법
1. https://cron-job.org 가입 (무료)
2. Create cronjob:
   - **Title**: 블로그 자동 생성
   - **URL**: `https://dawn-housing.vercel.app/api/cron/blog-auto-generate`
   - **Schedule**: 매일 00:00 (UTC)
   - **Timezone**: UTC
3. Save

### 특징
- ✅ 정확한 시간 실행
- ✅ 무료
- ✅ 웹 UI로 쉽게 관리
- ❌ 외부 의존성

## 📊 현재 상태

### Cron 실행 방법 (3가지)
1. **Vercel Cron** ← 이제 추가됨 (가장 정확)
2. **GitHub Actions** ← 이미 실행 중 (정각 아님)
3. **cron-job.org** ← 필요시 추가 가능

### 중복 실행 방지
서버 로직(`app.js`)에서 자동으로 처리:
- 하루에 한 번만 실행 (last_run 체크)
- 여러 cron이 동시 실행해도 문제 없음
- 설정 시간이 아니면 자동으로 스킵

## 🎯 추천 방법

**Vercel Cron 사용 (현재 설정)**
- 정확한 시간 실행
- 별도 설정 불필요
- Vercel과 통합되어 안정적

GitHub Actions는 백업용으로 유지해도 됩니다.

## 📅 다음 실행

**내일 (10월 14일) 오전 09:00 (한국 시간)**
- Vercel Cron이 UTC 00:00에 정확히 실행
- 서버가 한국 시간 09시임을 확인
- 블로그 자동 생성

## 🧪 즉시 테스트

수동 실행으로 즉시 확인:
```
http://localhost:7000/admin
→ AI 에이전트 탭
→ "지금 생성하기" 버튼 클릭
```

또는 API 직접 호출:
```bash
curl https://dawn-housing.vercel.app/api/cron/blog-auto-generate
```

