require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

/**
 * 데이터베이스 마이그레이션 실행
 * blog_posts 테이블에 topic_id 컬럼 추가
 */
async function runMigration() {
    const sql = neon(process.env.DATABASE_URL);

    try {
        console.log('🚀 마이그레이션 시작...');
        console.log('데이터베이스 연결 중...');

        // topic_id 컬럼 추가 (이미 존재하면 무시)
        await sql`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'blog_posts' 
                    AND column_name = 'topic_id'
                ) THEN
                    ALTER TABLE blog_posts 
                    ADD COLUMN topic_id INTEGER;
                    
                    RAISE NOTICE 'topic_id 컬럼이 추가되었습니다.';
                ELSE
                    RAISE NOTICE 'topic_id 컬럼이 이미 존재합니다.';
                END IF;
            END $$;
        `;

        console.log('✅ 마이그레이션 완료!');
        console.log('blog_posts 테이블에 topic_id 컬럼이 추가되었습니다.');

        // 현재 테이블 구조 확인
        const columns = await sql`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'blog_posts'
            ORDER BY ordinal_position;
        `;

        console.log('\n📋 현재 blog_posts 테이블 구조:');
        columns.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });

    } catch (error) {
        console.error('❌ 마이그레이션 실패:', error.message);
        console.error('상세 오류:', error);
        process.exit(1);
    }
}

// 스크립트 직접 실행시
if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('\n✨ 마이그레이션이 성공적으로 완료되었습니다.');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 예상치 못한 오류:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };

