require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Neon 데이터베이스 연결
const sql = neon(process.env.DATABASE_URL);

/**
 * 초기 블로그 주제 데이터 임포트
 */
async function importInitialTopics() {
    try {
        console.log('📥 초기 블로그 주제 데이터를 가져옵니다...\n');

        // 초기 주제 데이터 (SQL 파일 대신 직접 정의)
        const topics = [
            { topic: '황토집의 건강상 이점과 실제 효과', keywords: '황토집, 건강, 효과' },
            { topic: '황토방 시공 과정과 주의사항', keywords: '황토방, 시공, 건축' },
            { topic: '전통 한옥과 현대식 황토집의 차이점', keywords: '한옥, 황토집, 전통' },
            { topic: '황토집에서 겨울나기 난방 관리법', keywords: '황토집, 난방, 겨울' },
            { topic: '황토 벽돌 vs 황토 미장 어떤 것이 좋을까', keywords: '황토, 벽돌, 미장' },
            { topic: '황토집 짓기 전 반드시 알아야 할 10가지', keywords: '황토집, 건축, 팁' },
            { topic: '황토집 습도 조절 원리와 방법', keywords: '황토집, 습도, 조절' },
            { topic: '황토 건축 비용과 예산 계획하기', keywords: '황토, 건축, 비용' },
            { topic: '황토집의 단열 성능과 에너지 효율', keywords: '황토집, 단열, 에너지' },
            { topic: '자연 소재를 활용한 친환경 주택 짓기', keywords: '친환경, 주택, 자연소재' },
            { topic: '황토집 유지보수와 관리 요령', keywords: '황토집, 유지보수, 관리' },
            { topic: '황토방 곰팡이 예방과 대처법', keywords: '황토방, 곰팡이, 예방' },
            { topic: '전원주택으로 황토집을 선택하는 이유', keywords: '전원주택, 황토집, 선택' },
            { topic: '황토집과 아토피 개선 실제 사례', keywords: '황토집, 아토피, 건강' },
            { topic: '황토 건축의 역사와 현대적 재해석', keywords: '황토, 건축, 역사' },
            { topic: '황토집 시공 업체 선정 기준과 체크리스트', keywords: '황토집, 업체, 선정' },
            { topic: '황토방 인테리어 아이디어와 꾸미기 팁', keywords: '황토방, 인테리어, 꾸미기' },
            { topic: '황토집 장단점 솔직 후기', keywords: '황토집, 장단점, 후기' },
            { topic: '소형 황토집 설계 아이디어', keywords: '소형, 황토집, 설계' },
            { topic: '황토집에 어울리는 가구와 소품', keywords: '황토집, 가구, 소품' },
            { topic: '황토 건축 자재 선택 가이드', keywords: '황토, 자재, 선택' },
            { topic: '전통 방식의 황토 시공법', keywords: '전통, 황토, 시공법' },
            { topic: '현대식 황토 건축 기술의 발전', keywords: '현대식, 황토, 기술' },
            { topic: '황토집에서 키우기 좋은 식물', keywords: '황토집, 식물, 키우기' },
            { topic: '황토집 환기 시스템과 공기 순환', keywords: '황토집, 환기, 공기순환' },
            { topic: '부동산 투자로서의 황토집 가치', keywords: '부동산, 황토집, 투자' },
            { topic: '전원생활을 위한 황토집 입지 선정', keywords: '전원생활, 황토집, 입지' },
            { topic: '황토집과 일반 주택의 비용 비교', keywords: '황토집, 일반주택, 비용' },
            { topic: '황토 리모델링으로 기존 집 개선하기', keywords: '황토, 리모델링, 개선' },
            { topic: '황토집 냄새와 실내 공기질 관리', keywords: '황토집, 냄새, 공기질' }
        ];

        // 기존 주제가 있는지 확인
        const existingCount = await sql`SELECT COUNT(*) as count FROM blog_topics`;
        const count = parseInt(existingCount[0].count);

        if (count > 0) {
            console.log(`⚠️ 이미 ${count}개의 주제가 존재합니다.`);
            console.log('기존 주제를 유지하고 새로운 주제만 추가합니다.\n');
        }

        // 주제를 하나씩 추가 (중복 확인)
        let addedCount = 0;
        let skippedCount = 0;

        for (const topicData of topics) {
            // 중복 확인
            const existing = await sql`
                SELECT id FROM blog_topics 
                WHERE topic = ${topicData.topic}
            `;

            if (existing.length > 0) {
                skippedCount++;
                continue;
            }

            // 새 주제 추가
            await sql`
                INSERT INTO blog_topics (topic, keywords)
                VALUES (${topicData.topic}, ${topicData.keywords})
            `;
            addedCount++;
        }

        console.log('✅ 주제 임포트 완료!');
        console.log(`   새로 추가: ${addedCount}개`);
        console.log(`   중복 스킵: ${skippedCount}개`);
        console.log(`   총 주제: ${count + addedCount}개\n`);

        // 최종 통계
        const finalCount = await sql`SELECT COUNT(*) as count FROM blog_topics`;
        const unusedCount = await sql`SELECT COUNT(*) as count FROM blog_topics WHERE used = FALSE`;

        console.log('📊 현재 블로그 주제 통계:');
        console.log(`   전체 주제: ${finalCount[0].count}개`);
        console.log(`   미사용 주제: ${unusedCount[0].count}개`);

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        process.exit(1);
    }
}

// 실행
importInitialTopics();

