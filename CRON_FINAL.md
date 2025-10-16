# 블로그 자동 생성 - 최종 설정 완료 ✅

## 🎯 현재 설정 (Vercel Cron)

### Vercel Cron
- **스케줄**: 매시간 00분 (`0 * * * *`)
- **설정 파일**: `vercel.json`
- **특징**: 
  - ✅ 정확한 시간 실행
  - ✅ Vercel 인프라 사용 (안정적)
  - ✅ 무료 플랜에서 사용 가능
  - ✅ AWS EventBridge 기반
- **로그 확인**: Vercel Dashboard → housing → Logs

## 📅 작동 방식

### 실행 흐름
```
매시간 00분
    ↓
Vercel Cron 실행
    ↓
API 호출: /api/cron/blog-auto-generate
    ↓
서버 체크:
  - 현재 시간 = 설정 시간(22:00)? ✓
  - 오늘 이미 실행? ✗
  - 미사용 주제 있음? ✓
    ↓
블로그 자동 생성! 🎉
```

### 중복 실행 방지
- 서버에서 `last_run` 체크로 하루 한 번만 생성
- 같은 날 여러 번 호출해도 첫 번째만 성공

## 🕐 현재 블로그 생성 시간

**매일 오후 10시 (22:00)** - 한국 시간

### 시간 변경 방법

**관리자 페이지에서:**
```
https://dawn-housing.vercel.app/admin
→ AI 에이전트 탭
→ 실행 시간 옆 연필 아이콘 클릭
→ 원하는 시간 입력 (예: 14:30)
→ 저장
```

## 📊 모니터링

### Vercel 로그 확인
```
https://vercel.com/dashboard
→ housing 프로젝트
→ Logs 탭
→ /api/cron/blog-auto-generate 검색
```

**확인 내용:**
- `[Vercel Cron] 체크 시간: XX:XX`
- `[Vercel Cron] 설정: { is_enabled: true, schedule_time: '22:00' }`
- 성공 시: `success: true`, `postId: XX`


## 🧪 수동 테스트

### 방법 1: 관리자 페이지
```
http://localhost:7000/admin
→ AI 에이전트 탭
→ "지금 생성하기" 버튼 클릭
```

### 방법 2: API 직접 호출
```bash
curl https://dawn-housing.vercel.app/api/cron/blog-auto-generate
```


## 📝 주제 관리

### 미사용 주제 확인
```bash
node scripts/check-blog-topics.js
```

### 주제 추가
관리자 페이지 → AI 에이전트 탭 → 주제 관리

### 모든 주제 리셋
관리자 페이지 → AI 에이전트 탭 → "모든 주제 리셋" 버튼

## 🔧 문제 해결

### 블로그가 생성되지 않는 경우

**1. 시간 확인**
- 현재 시간 = 설정 시간?
- 한국 시간 기준으로 확인

**2. 설정 확인**
```bash
# 데이터베이스 설정 확인
node check-status.js
```

**3. 주제 확인**
- 미사용 주제가 있는지 확인
- 없으면 주제 리셋 또는 추가

**4. Cron 실행 확인**
- Vercel Logs에서 API 호출 확인

**5. 수동 실행 테스트**
- API 직접 호출해서 에러 확인

## ✅ 현재 상태 (2025-10-13 22:02)

- ✅ Vercel Cron: 활성화 (매시간 실행)
- ✅ 블로그 생성 시간: 22:00
- ✅ 미사용 주제: 1개 ("황토란 무엇인가")
- ✅ 마지막 생성: 2025-10-13 22:02
  - 포스트 ID: 16
  - 제목: "황토집, 건강을 짓다: 자연이 주는 치유의 선물"

## 🚀 다음 실행 예정

**매일 오후 10시 (22:00)**

Vercel Cron이 매시간 체크하며, 22:00에 자동으로 블로그를 생성합니다.

---

## 참고 자료

- Vercel Cron 문서: https://vercel.com/docs/cron-jobs
- Cron 표현식: https://crontab.guru/

