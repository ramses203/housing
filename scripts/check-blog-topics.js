require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

// Neon 데이터베이스 연결
const sql = neon(process.env.DATABASE_URL);

/**
 * 블로그 주제 통계 확인
 */
async function checkBlogTopics() {
    try {
        console.log('📊 블로그 주제 통계를 확인합니다...\n');

        // 전체 주제 개수
        const totalResult = await sql`SELECT COUNT(*) as count FROM blog_topics`;
        const total = parseInt(totalResult[0].count);

        // 사용된 주제 개수
        const usedResult = await sql`SELECT COUNT(*) as count FROM blog_topics WHERE used = TRUE`;
        const used = parseInt(usedResult[0].count);

        // 미사용 주제 개수
        const unused = total - used;

        console.log('┌─────────────────────────────────┐');
        console.log('│   블로그 주제 통계              │');
        console.log('├─────────────────────────────────┤');
        console.log(`│ 전체 주제:      ${String(total).padStart(4)} 개    │`);
        console.log(`│ 사용된 주제:    ${String(used).padStart(4)} 개    │`);
        console.log(`│ 미사용 주제:    ${String(unused).padStart(4)} 개    │`);
        console.log('└─────────────────────────────────┘\n');

        // 최근 추가된 주제 5개
        const recentTopics = await sql`
            SELECT id, topic, keywords, used, created_at 
            FROM blog_topics 
            ORDER BY created_at DESC 
            LIMIT 5
        `;

        if (recentTopics.length > 0) {
            console.log('📝 최근 추가된 주제 (최대 5개):');
            console.log('─'.repeat(80));
            recentTopics.forEach((topic, idx) => {
                const status = topic.used ? '✅ 사용됨' : '⏳ 대기중';
                const date = new Date(topic.created_at).toLocaleDateString('ko-KR');
                console.log(`${idx + 1}. [${status}] ${topic.topic}`);
                console.log(`   키워드: ${topic.keywords || '없음'} | 등록일: ${date}`);
            });
            console.log('─'.repeat(80));
        }

        // 미사용 주제 목록
        const unusedTopics = await sql`
            SELECT id, topic, keywords 
            FROM blog_topics 
            WHERE used = FALSE 
            ORDER BY created_at ASC
        `;

        if (unusedTopics.length > 0) {
            console.log(`\n⏳ 미사용 주제 목록 (${unusedTopics.length}개):`);
            console.log('─'.repeat(80));
            unusedTopics.forEach((topic, idx) => {
                console.log(`${idx + 1}. ${topic.topic}`);
                if (topic.keywords) {
                    console.log(`   키워드: ${topic.keywords}`);
                }
            });
            console.log('─'.repeat(80));
        } else {
            console.log('\n⚠️ 미사용 주제가 없습니다. 새로운 주제를 추가해주세요!');
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        process.exit(1);
    }
}

// 실행
checkBlogTopics();

