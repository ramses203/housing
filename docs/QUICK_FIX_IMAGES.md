# 🖼️ 블로그 이미지 표시 안되는 문제 해결

## 문제 상황
블로그 자동 생성은 되지만 이미지가 포함되지 않음

## 원인
Vercel 배포 환경에 이미지 검색 API 키가 설정되지 않음

---

## 🚀 빠른 해결 방법

### 1단계: API 키 발급 (5분)

#### Unsplash API 키 발급 (권장)
1. https://unsplash.com/developers 접속
2. "Register as a developer" 클릭
3. 이메일로 가입
4. "Your apps" → "New Application" 클릭
5. 약관 동의 후 앱 이름 입력 (예: "새벽하우징 블로그")
6. **Access Key** 복사 (예: `abc123def456...`)

#### Cloudinary 설정 확인
이미 설정되어 있을 가능성이 높음 (갤러리 이미지 업로드가 작동하므로)

1. https://cloudinary.com/console 접속
2. Dashboard에서 확인:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

---

### 2단계: Vercel에 환경 변수 추가 (3분)

1. https://vercel.com/dashboard 접속
2. `housing` 프로젝트 클릭
3. 상단 메뉴에서 **Settings** 클릭
4. 왼쪽 메뉴에서 **Environment Variables** 클릭

5. 다음 환경 변수들을 하나씩 추가:

   #### Unsplash 설정
   ```
   Name: UNSPLASH_ACCESS_KEY
   Value: (1단계에서 복사한 Access Key 붙여넣기)
   Environments: Production ✅ Preview ✅ Development ✅
   ```

   #### Cloudinary 설정 (이미 있으면 스킵)
   ```
   Name: CLOUDINARY_CLOUD_NAME
   Value: (Cloudinary Cloud Name)
   Environments: Production ✅ Preview ✅ Development ✅
   ```

   ```
   Name: CLOUDINARY_API_KEY
   Value: (Cloudinary API Key)
   Environments: Production ✅ Preview ✅ Development ✅
   ```

   ```
   Name: CLOUDINARY_API_SECRET
   Value: (Cloudinary API Secret)
   Environments: Production ✅ Preview ✅ Development ✅
   ```

6. 각 환경 변수마다 **Save** 클릭

---

### 3단계: 재배포 (1분)

환경 변수를 추가한 후 반드시 재배포해야 합니다.

#### 방법 A: Git Push (자동 재배포)
```bash
git add .
git commit -m "Add environment variables documentation"
git push
```

#### 방법 B: Vercel 대시보드에서 수동 재배포
1. Vercel Dashboard → `housing` 프로젝트
2. **Deployments** 탭
3. 최신 배포 옆 `...` 메뉴 → **Redeploy**
4. **Redeploy** 버튼 클릭

재배포 완료까지 약 1-2분 소요

---

### 4단계: 테스트 (2분)

1. https://dawn-housing.vercel.app/admin 접속
2. AI 에이전트 탭
3. "지금 생성하기" 버튼 클릭
4. 약 1-2분 대기
5. 블로그 관리 탭에서 새 포스트 확인
6. 포스트를 열어 이미지가 포함되었는지 확인

---

## ✅ 예상 결과

이미지가 포함된 블로그 포스트:

```
제목: 황토집의 장점

[본문 시작]
황토집은 건강에 좋습니다...

[이미지 1: 황토집 외관 사진]
사진: Photographer Name (Unsplash)

중간 내용...

[이미지 2: 황토 재료 사진]
사진: Photographer Name (Unsplash)

더 많은 내용...

[이미지 3: 건강한 생활 이미지]
사진: Photographer Name (Unsplash)
```

---

## 🔍 확인 방법

### Vercel 함수 로그에서 확인

1. Vercel Dashboard → Deployments
2. 최신 배포 클릭
3. **Functions** 로그 확인

**성공 시 로그**:
```
📸 이미지 검색 키워드: 황토집, 건강, 효과
🔑 API 키 상태: {
  unsplash: '✅',
  pexels: '❌',
  cloudinary: '✅'
}
🔍 3개의 이미지 검색 시작...
  검색 1/3: "황토집"
  ✅ 이미지 업로드 성공: https://res.cloudinary.com/...
  검색 2/3: "건강"
  ✅ 이미지 업로드 성공: https://res.cloudinary.com/...
  검색 3/3: "효과"
  ✅ 이미지 업로드 성공: https://res.cloudinary.com/...
📊 최종 업로드된 이미지 개수: 3
```

**실패 시 로그**:
```
🔑 API 키 상태: {
  unsplash: '❌',
  pexels: '❌',
  cloudinary: '✅'
}
⚠️ 이미지 검색 API 키가 설정되지 않았습니다.
```

---

## 💡 추가 팁

### 더 나은 이미지 품질을 위해

1. **키워드 최적화**: 주제 추가 시 명확한 키워드 입력
   ```
   주제: 황토집의 건강 효능
   키워드: 황토집, 전통가옥, 웰빙, 건강한집
   ```

2. **Pexels 백업 추가** (선택사항):
   - Unsplash에서 이미지를 못 찾으면 자동으로 Pexels에서 검색
   - https://www.pexels.com/api/ 에서 API 키 발급
   - Vercel에 `PEXELS_API_KEY` 환경 변수 추가

3. **영어 키워드 병행**:
   ```
   키워드: 황토집, earth house, 건강, health
   ```

---

## ❓ 문제가 계속되면

1. 환경 변수 철자 확인
2. Vercel 재배포 확인
3. 함수 로그에서 에러 메시지 확인
4. Unsplash/Cloudinary 계정 상태 확인

더 자세한 내용은 `docs/ENVIRONMENT_SETUP.md` 참고

