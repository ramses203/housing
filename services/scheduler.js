require('dotenv').config();
const cron = require('node-cron');
const { createBlogPostFromTopic } = require('./blogAgent');

// 스케줄러 상태
let schedulerState = {
    isEnabled: process.env.BLOG_AUTO_ENABLED === 'true',
    scheduleTime: process.env.BLOG_SCHEDULE_TIME || '09:00',
    lastRun: null,
    nextRun: null,
    isRunning: false,
    cronJob: null
};

/**
 * 다음 미사용 주제 가져오기
 * @param {Object} sql - Neon SQL 클라이언트
 * @returns {Promise<Object|null>} 주제 객체 또는 null
 */
async function getNextUnusedTopic(sql) {
    try {
        const topics = await sql`
            SELECT * FROM blog_topics 
            WHERE used = FALSE 
            ORDER BY created_at ASC 
            LIMIT 1
        `;

        return topics.length > 0 ? topics[0] : null;
    } catch (error) {
        console.error('미사용 주제 조회 오류:', error.message);
        return null;
    }
}

/**
 * 모든 주제를 미사용 상태로 리셋
 * @param {Object} sql - Neon SQL 클라이언트
 * @returns {Promise<number>} 리셋된 주제 개수
 */
async function resetAllTopics(sql) {
    try {
        const result = await sql`
            UPDATE blog_topics 
            SET used = FALSE, used_at = NULL 
            WHERE used = TRUE
        `;
        
        console.log(`${result.count || 0}개의 주제가 리셋되었습니다.`);
        return result.count || 0;
    } catch (error) {
        console.error('주제 리셋 오류:', error.message);
        return 0;
    }
}

/**
 * 블로그 포스트 자동 생성 실행
 * @param {Object} sql - Neon SQL 클라이언트
 * @returns {Promise<Object>} 실행 결과
 */
async function runBlogGeneration(sql) {
    if (schedulerState.isRunning) {
        console.log('이미 블로그 생성이 진행 중입니다.');
        return { success: false, message: '이미 진행 중입니다.' };
    }

    schedulerState.isRunning = true;
    schedulerState.lastRun = new Date();

    try {
        console.log('[자동 블로그 생성] 시작:', new Date().toLocaleString('ko-KR'));

        // 미사용 주제 가져오기
        const topic = await getNextUnusedTopic(sql);

        // 주제가 없으면 중단
        if (!topic) {
            console.log('⚠️ 사용 가능한 주제가 없습니다. 블로그 생성을 건너뜁니다.');
            return {
                success: false,
                message: '사용 가능한 주제가 없습니다. 새로운 주제를 추가해주세요.'
            };
        }

        // 블로그 포스트 생성
        const result = await createBlogPostFromTopic(sql, topic);

        console.log('[자동 블로그 생성] 완료:', result.title);

        return {
            success: true,
            postId: result.postId,
            title: result.title,
            topic: result.topic
        };
    } catch (error) {
        console.error('[자동 블로그 생성] 오류:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        schedulerState.isRunning = false;
    }
}

/**
 * 크론 스케줄 표현식 생성
 * @param {string} timeString - 시간 문자열 (예: "09:00")
 * @returns {string} 크론 표현식
 */
function createCronExpression(timeString) {
    const [hour, minute] = timeString.split(':');
    // 매일 특정 시간에 실행 (분 시 * * *)
    return `${minute} ${hour} * * *`;
}

/**
 * 스케줄러 시작
 * @param {Object} sql - Neon SQL 클라이언트
 */
function startScheduler(sql) {
    if (schedulerState.cronJob) {
        console.log('스케줄러가 이미 실행 중입니다.');
        return;
    }

    if (!schedulerState.isEnabled) {
        console.log('자동 블로그 생성이 비활성화되어 있습니다.');
        return;
    }

    const cronExpression = createCronExpression(schedulerState.scheduleTime);
    console.log(`스케줄러 시작: 매일 ${schedulerState.scheduleTime}에 실행 (크론: ${cronExpression})`);

    schedulerState.cronJob = cron.schedule(cronExpression, async () => {
        await runBlogGeneration(sql);
    }, {
        scheduled: true,
        timezone: "Asia/Seoul"
    });

    // 다음 실행 시간 계산
    const now = new Date();
    const [hour, minute] = schedulerState.scheduleTime.split(':');
    const nextRun = new Date(now);
    nextRun.setHours(parseInt(hour), parseInt(minute), 0, 0);
    
    if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
    }
    
    schedulerState.nextRun = nextRun;

    console.log(`다음 실행 예정: ${nextRun.toLocaleString('ko-KR')}`);
}

/**
 * 스케줄러 중지
 */
function stopScheduler() {
    if (schedulerState.cronJob) {
        schedulerState.cronJob.stop();
        schedulerState.cronJob = null;
        schedulerState.nextRun = null;
        console.log('스케줄러가 중지되었습니다.');
    }
}

/**
 * 스케줄러 재시작
 * @param {Object} sql - Neon SQL 클라이언트
 */
function restartScheduler(sql) {
    stopScheduler();
    startScheduler(sql);
}

/**
 * 스케줄러 설정 업데이트
 * @param {Object} config - 설정 객체 {isEnabled, scheduleTime}
 * @param {Object} sql - Neon SQL 클라이언트
 */
function updateSchedulerConfig(config, sql) {
    if (config.isEnabled !== undefined) {
        schedulerState.isEnabled = config.isEnabled;
    }
    
    if (config.scheduleTime !== undefined) {
        schedulerState.scheduleTime = config.scheduleTime;
    }

    // 스케줄러 재시작
    if (schedulerState.isEnabled) {
        restartScheduler(sql);
    } else {
        stopScheduler();
    }
}

/**
 * 스케줄러 상태 조회
 * @returns {Object} 스케줄러 상태 정보
 */
function getSchedulerStatus() {
    return {
        isEnabled: schedulerState.isEnabled,
        scheduleTime: schedulerState.scheduleTime,
        lastRun: schedulerState.lastRun,
        nextRun: schedulerState.nextRun,
        isRunning: schedulerState.isRunning,
        isScheduled: schedulerState.cronJob !== null
    };
}

module.exports = {
    startScheduler,
    stopScheduler,
    restartScheduler,
    updateSchedulerConfig,
    getSchedulerStatus,
    runBlogGeneration,
    getNextUnusedTopic,
    resetAllTopics
};

