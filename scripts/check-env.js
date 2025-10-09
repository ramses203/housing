require('dotenv').config();

/**
 * 환경 변수 확인 스크립트
 * 배포 환경에서 필요한 모든 환경 변수가 설정되어 있는지 확인
 */

console.log('🔍 환경 변수 확인 중...\n');

const requiredEnvVars = {
    '데이터베이스': {
        'DATABASE_URL': process.env.DATABASE_URL
    },
    '세션': {
        'SESSION_SECRET': process.env.SESSION_SECRET
    },
    'Gemini AI (필수)': {
        'GEMINI_API_KEY': process.env.GEMINI_API_KEY
    },
    '이미지 검색 (하나 이상 필요)': {
        'UNSPLASH_ACCESS_KEY': process.env.UNSPLASH_ACCESS_KEY,
        'PEXELS_API_KEY': process.env.PEXELS_API_KEY
    },
    '이미지 업로드 (필수)': {
        'CLOUDINARY_CLOUD_NAME': process.env.CLOUDINARY_CLOUD_NAME,
        'CLOUDINARY_API_KEY': process.env.CLOUDINARY_API_KEY,
        'CLOUDINARY_API_SECRET': process.env.CLOUDINARY_API_SECRET
    },
    '블로그 자동 생성 (선택)': {
        'BLOG_AUTO_ENABLED': process.env.BLOG_AUTO_ENABLED,
        'BLOG_SCHEDULE_TIME': process.env.BLOG_SCHEDULE_TIME
    }
};

let hasErrors = false;
let hasWarnings = false;

Object.entries(requiredEnvVars).forEach(([category, vars]) => {
    console.log(`📂 ${category}`);
    
    Object.entries(vars).forEach(([key, value]) => {
        const isSet = !!value;
        const status = isSet ? '✅' : '❌';
        const displayValue = isSet ? (value.length > 50 ? value.substring(0, 50) + '...' : '***설정됨***') : '설정 안됨';
        
        console.log(`  ${status} ${key}: ${displayValue}`);
        
        // 필수 환경 변수 체크
        if (!isSet) {
            if (category.includes('필수')) {
                hasErrors = true;
            } else if (category.includes('하나 이상')) {
                // 이미지 검색 API는 하나라도 있으면 OK
                const imageSearchKeys = ['UNSPLASH_ACCESS_KEY', 'PEXELS_API_KEY'];
                const hasAnyImageSearchKey = imageSearchKeys.some(k => !!process.env[k]);
                if (!hasAnyImageSearchKey && key === imageSearchKeys[imageSearchKeys.length - 1]) {
                    hasWarnings = true;
                }
            }
        }
    });
    
    console.log('');
});

// 이미지 검색 API 특별 체크
const hasUnsplash = !!process.env.UNSPLASH_ACCESS_KEY;
const hasPexels = !!process.env.PEXELS_API_KEY;
const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && 
                         process.env.CLOUDINARY_API_KEY && 
                         process.env.CLOUDINARY_API_SECRET);

console.log('📊 종합 상태\n');

if (hasUnsplash || hasPexels) {
    console.log('✅ 이미지 검색 API: 사용 가능');
} else {
    console.log('⚠️  이미지 검색 API: 설정 안됨 (블로그에 이미지가 없을 수 있습니다)');
    hasWarnings = true;
}

if (hasCloudinary) {
    console.log('✅ 이미지 업로드: 사용 가능');
} else {
    console.log('❌ 이미지 업로드: 설정 안됨 (Cloudinary 필수)');
    hasErrors = true;
}

if (process.env.GEMINI_API_KEY) {
    console.log('✅ AI 블로그 생성: 사용 가능');
} else {
    console.log('❌ AI 블로그 생성: 설정 안됨 (Gemini API 필수)');
    hasErrors = true;
}

console.log('');

if (hasErrors) {
    console.log('❌ 오류: 필수 환경 변수가 설정되지 않았습니다.');
    console.log('   Vercel 대시보드에서 환경 변수를 설정해주세요.');
    console.log('   https://vercel.com/dashboard → 프로젝트 선택 → Settings → Environment Variables');
    process.exit(1);
} else if (hasWarnings) {
    console.log('⚠️  경고: 일부 선택적 환경 변수가 설정되지 않았습니다.');
    console.log('   기능이 제한될 수 있습니다.');
    process.exit(0);
} else {
    console.log('✅ 모든 환경 변수가 올바르게 설정되었습니다!');
    process.exit(0);
}

