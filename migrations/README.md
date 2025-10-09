# 데이터베이스 마이그레이션

## 개요
이 디렉토리에는 데이터베이스 스키마 변경을 위한 마이그레이션 스크립트가 포함되어 있습니다.

## 마이그레이션 목록

### 1. add_topic_id_to_blog_posts (2025-10-09)
**목적**: AI 에이전트 블로그 자동 생성 기능 지원

**변경 사항**:
- `blog_posts` 테이블에 `topic_id INTEGER` 컬럼 추가
- AI 에이전트가 어떤 주제로 블로그를 생성했는지 추적 가능

**실행 방법**:

#### 방법 1: Node.js 스크립트 실행 (권장)
```bash
npm run migrate
```

#### 방법 2: SQL 파일 직접 실행
```bash
# PostgreSQL 클라이언트 사용
psql $DATABASE_URL -f migrations/add_topic_id_to_blog_posts.sql
```

#### 방법 3: 자동 마이그레이션 (서버 시작 시)
서버를 시작하면 `app.js`의 `initDatabase()` 함수가 자동으로 마이그레이션을 실행합니다.

```bash
npm start
```

## 마이그레이션 확인

마이그레이션이 성공적으로 적용되었는지 확인하려면:

```sql
-- blog_posts 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'blog_posts'
ORDER BY ordinal_position;
```

또는 Node.js 스크립트 실행 시 자동으로 테이블 구조를 출력합니다.

## 배포 환경 마이그레이션

### Vercel 배포 시
Vercel에 배포하면 서버 시작 시 자동으로 마이그레이션이 실행됩니다.

**확인 방법**:
1. Vercel 대시보드에서 프로젝트 선택
2. "Deployments" 탭에서 최신 배포 선택
3. "Functions" 로그에서 마이그레이션 메시지 확인:
   ```
   📦 데이터베이스 초기화 시작...
   ✅ 테이블 생성 완료
   🔄 마이그레이션 실행 중...
   ✅ 데이터베이스 초기화 및 마이그레이션 완료
   ```

### 수동 마이그레이션이 필요한 경우
로컬에서 Neon 데이터베이스에 직접 연결하여 마이그레이션:

```bash
# .env 파일에 DATABASE_URL 설정 확인
npm run migrate
```

## 문제 해결

### "topic_id 컬럼이 이미 존재합니다" 메시지
정상입니다. 마이그레이션이 이미 적용되어 있다는 의미입니다.

### "relation 'blog_posts' does not exist" 오류
`blog_posts` 테이블이 생성되지 않았습니다. `npm start`로 서버를 시작하여 테이블을 먼저 생성하세요.

### 권한 오류
데이터베이스 사용자에게 ALTER TABLE 권한이 있는지 확인하세요.

## 주의사항

- 마이그레이션은 안전하게 설계되어 여러 번 실행해도 문제없습니다 (idempotent)
- 기존 데이터는 보존됩니다
- `topic_id`는 NULL 허용 컬럼으로 추가되므로 기존 포스트에는 영향이 없습니다

