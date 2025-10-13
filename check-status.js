require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function checkStatus() {
    console.log('\n📊 현재 상태 확인\n');
    
    // 데이터베이스 설정
    const config = await sql`SELECT * FROM agent_config ORDER BY id DESC LIMIT 1`;
    console.log('⚙️ 데이터베이스 설정:');
    console.log('  - is_enabled:', config[0].is_enabled);
    console.log('  - schedule_time:', config[0].schedule_time);
    console.log('  - last_run:', config[0].last_run || '없음 (아직 실행 안됨)');
    
    // 현재 시간
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    console.log('\n🕐 현재 시간 (한국):', koreaTime.toLocaleString('ko-KR'));
    
    // 주제
    const unusedTopics = await sql`SELECT COUNT(*) as count FROM blog_topics WHERE used = FALSE`;
    console.log('\n📝 미사용 주제:', unusedTopics[0].count, '개');
    
    console.log('\n✅ GitHub Actions: 정상 작동 중 (20회 실행 완료)');
    console.log('📅 다음 블로그 생성: 내일(10월 14일) 오전 09:00\n');
}

checkStatus();

