require('dotenv').config();

// Vercel 자동 배포 테스트
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieSession = require('cookie-session');
const { neon } = require('@neondatabase/serverless');
const cloudinary = require('cloudinary').v2;

const app = express();
const port = process.env.PORT || 7000;
const ADMIN_PASSWORD = 'bae1234!';

// Cloudinary 설정
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Neon 데이터베이스 연결
const sql = neon(process.env.DATABASE_URL);

// IP 주소 가져오기 헬퍼 함수
function getClientIp(req) {
    // Vercel, Cloudflare, Nginx 등의 프록시를 고려한 IP 추출
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           req.ip || 
           'unknown';
}

// 블로그 콘텐츠 파싱 헬퍼 함수 (JSON 문자열이나 이스케이프된 문자열을 HTML로 변환)
function parseContentForDisplay(content) {
    if (!content) return '';
    
    let processed = content;
    
    // JSON 형식으로 저장된 경우 파싱 시도 (예: {"title":"...", "content":"..."} 형태)
    try {
        const parsed = JSON.parse(content);
        if (parsed.content) {
            processed = parsed.content;
        }
    } catch (e) {
        // JSON이 아니면 일반 텍스트/HTML로 처리
    }
    
    // 이스케이프된 줄바꿈(\n) 제거 - HTML에서는 불필요
    processed = processed.replace(/\\n/g, '');
    
    // 이미 올바른 HTML 형식이면 그대로 반환
    if (processed.trim().startsWith('<') && processed.includes('</')) {
        // 연속된 공백만 정리
        processed = processed.replace(/\s+/g, ' ');
        return processed.trim();
    }
    
    // HTML이 아닌 경우 기본 변환
    processed = processed.replace(/\n\n+/g, '</p><p>');
    processed = processed.replace(/\n/g, '<br>');
    
    if (!processed.includes('<p>')) {
        processed = `<p>${processed}</p>`;
    }
    
    return processed;
}

// 데이터베이스 테이블 초기화 및 마이그레이션
async function initDatabase() {
  try {
    console.log('📦 데이터베이스 초기화 시작...');
    
    // 갤러리 테이블 생성
    await sql`
      CREATE TABLE IF NOT EXISTS gallery (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        public_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // 상품 테이블 생성
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        description TEXT,
        image TEXT NOT NULL,
        cloudinary_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // 블로그 포스트 테이블 생성
    await sql`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        thumbnail TEXT,
        author TEXT DEFAULT '새벽하우징',
        topic_id INTEGER,
        views INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published INTEGER DEFAULT 1
      )
    `;
    
    // 블로그 주제 테이블 생성
    await sql`
      CREATE TABLE IF NOT EXISTS blog_topics (
        id SERIAL PRIMARY KEY,
        topic TEXT NOT NULL,
        keywords TEXT,
        used BOOLEAN DEFAULT FALSE,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // 블로그 포스트 조회 기록 테이블 생성 (IP 기반 중복 방지)
    await sql`
      CREATE TABLE IF NOT EXISTS post_views (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, ip_address)
      )
    `;
    
    // 블로그 에이전트 설정 테이블 생성
    await sql`
      CREATE TABLE IF NOT EXISTS agent_config (
        id SERIAL PRIMARY KEY,
        is_enabled BOOLEAN DEFAULT TRUE,
        schedule_time VARCHAR(5) DEFAULT '09:00',
        last_run TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // 기본 설정이 없으면 추가
    const configCount = await sql`SELECT COUNT(*) as count FROM agent_config`;
    if (parseInt(configCount[0].count) === 0) {
      await sql`
        INSERT INTO agent_config (is_enabled, schedule_time)
        VALUES (true, '09:00')
      `;
      console.log('✅ 에이전트 기본 설정 생성 완료');
    }
    
    // 인덱스 생성 (조회 성능 향상)
    await sql`
      CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_post_views_ip ON post_views(ip_address)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_post_views_viewed_at ON post_views(viewed_at)
    `;
    
    console.log('✅ 테이블 생성 완료');
    
    // 마이그레이션: topic_id 컬럼 추가 (기존 테이블용)
    console.log('🔄 마이그레이션 실행 중...');
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
          END IF;
      END $$;
    `;
    
    // 마이그레이션: views 컬럼 추가 (조회수 추적)
    await sql`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'blog_posts' 
              AND column_name = 'views'
          ) THEN
              ALTER TABLE blog_posts 
              ADD COLUMN views INTEGER DEFAULT 0;
              
              RAISE NOTICE 'views 컬럼이 추가되었습니다.';
          END IF;
      END $$;
    `;
    
    // 기존 포스트의 조회수 초기화
    await sql`
      UPDATE blog_posts 
      SET views = 0 
      WHERE views IS NULL
    `;
    
    console.log('✅ 데이터베이스 초기화 및 마이그레이션 완료');
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 오류:', error);
    throw error;
  }
}

// 서버 시작 시 데이터베이스 초기화
initDatabase();

// 블로그 에이전트 스케줄러
const { 
    startScheduler, 
    getSchedulerStatus, 
    updateSchedulerConfig,
    runBlogGeneration,
    resetAllTopics 
} = require('./services/scheduler');

// 스케줄러 시작
setTimeout(() => {
    startScheduler(sql);
}, 2000); // 서버 시작 2초 후 스케줄러 시작

app.set('trust proxy', 1);
app.use(
  cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'your-secret-key'],
    maxAge: 24 * 60 * 60 * 1000,     // 24시간
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- 인증 미들웨어 ---
const authMiddleware = (req, res, next) => {
    console.log('인증 체크:', req.session.isAuthenticated);
    if (req.session.isAuthenticated) return next();
    res.redirect('/login');
};

// --- API 라우트 ---

// 갤러리 이미지 목록 API
app.get('/api/images', async (req, res) => {
    try {
        const rows = await sql`SELECT * FROM gallery ORDER BY created_at DESC`;
        res.json(rows);
    } catch (error) {
        console.error('갤러리 조회 오류:', error);
        res.json([]);
    }
});

// 갤러리 이미지 정보 저장 API
app.post('/api/images', authMiddleware, async (req, res) => {
    console.log('POST /api/images 요청 받음:', req.body);
    const { url, public_id } = req.body;
    
    try {
        await sql`INSERT INTO gallery (url, public_id) VALUES (${url}, ${public_id})`;
        console.log('갤러리 데이터베이스에 성공적으로 저장됨.');
        res.json({ success: true });
    } catch (error) {
        console.error('갤러리 저장 오류:', error);
        res.status(500).json({ success: false, error: 'Failed to save image data.' });
    }
});

// 갤러리 이미지 삭제 API
app.delete('/api/images/:public_id', authMiddleware, async (req, res) => {
    const public_id = decodeURIComponent(req.params.public_id);
    
    try {
        await sql`DELETE FROM gallery WHERE public_id = ${public_id}`;
        console.log('갤러리에서 성공적으로 삭제됨.');
        res.json({ success: true });
    } catch (error) {
        console.error('갤러리 삭제 오류:', error);
        res.status(500).json({ success: false, error: 'Failed to delete image.' });
    }
});

// 상품 추가 처리
app.post('/admin/product', authMiddleware, async (req, res) => {
    const { productName, productPrice, productDescription, productImage, cloudinaryId } = req.body;
    
    try {
        await sql`
            INSERT INTO products (name, price, description, image, cloudinary_id) 
            VALUES (${productName}, ${parseInt(productPrice, 10)}, ${productDescription}, ${productImage}, ${cloudinaryId})
        `;
        console.log('상품이 데이터베이스에 성공적으로 저장됨.');
        res.json({ success: true });
    } catch (error) {
        console.error('상품 저장 오류:', error);
        res.status(500).json({ success: false, error: 'Failed to save product.' });
    }
});

// 상품 삭제 API
app.delete('/api/products/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await sql`DELETE FROM products WHERE id = ${id}`;
        if (result.rowCount > 0) {
            console.log('상품이 성공적으로 삭제됨.');
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: '상품을 찾을 수 없습니다.' });
        }
    } catch (error) {
        console.error('상품 삭제 오류:', error);
        res.status(500).json({ success: false, error: 'Failed to delete product.' });
    }
});

// 상품 목록 API
app.get('/api/products', async (req, res) => {
    try {
        const rows = await sql`SELECT * FROM products ORDER BY created_at DESC`;
        res.json(rows);
    } catch (error) {
        console.error('상품 조회 오류:', error);
        res.json([]);
    }
});

// --- 블로그 API ---

// 블로그 포스트 목록 조회 (공개)
app.get('/api/blog/posts', async (req, res) => {
    try {
        const rows = await sql`SELECT * FROM blog_posts WHERE published = 1 ORDER BY created_at DESC`;
        
        // 각 포스트의 content 파싱 (목록에서는 요약만 필요할 수 있으므로 선택적)
        const processedRows = rows.map(post => ({
            ...post,
            // 목록에서는 전체 content를 파싱하지 않고 미리보기만 제공
            // 필요시 content를 파싱하려면 주석 해제
            // content: parseContentForDisplay(post.content)
        }));
        
        res.json(processedRows);
    } catch (error) {
        console.error('블로그 포스트 조회 오류:', error);
        res.json([]);
    }
});

// 특정 블로그 포스트 상세 조회 (공개) + 조회수 증가 (IP 기반 중복 방지)
app.get('/api/blog/posts/:id', async (req, res) => {
    const { id } = req.params;
    const clientIp = getClientIp(req);
    
    try {
        // 포스트 조회
        const rows = await sql`SELECT * FROM blog_posts WHERE id = ${id} AND published = 1`;
        if (rows.length === 0) {
            return res.status(404).json({ error: '포스트를 찾을 수 없습니다.' });
        }
        
        const post = rows[0];
        
        // content 파싱 (JSON 형식이거나 이스케이프된 경우 처리)
        post.content = parseContentForDisplay(post.content);
        
        // IP 기반 조회 기록 확인 및 추가 (중복 방지)
        try {
            // INSERT ... ON CONFLICT DO NOTHING을 사용하여 중복 방지
            const viewResult = await sql`
                INSERT INTO post_views (post_id, ip_address)
                VALUES (${id}, ${clientIp})
                ON CONFLICT (post_id, ip_address) DO NOTHING
                RETURNING id
            `;
            
            // 새로운 조회 기록이 추가된 경우에만 조회수 증가
            if (viewResult.length > 0) {
                await sql`
                    UPDATE blog_posts 
                    SET views = COALESCE(views, 0) + 1 
                    WHERE id = ${id}
                `;
                
                // 업데이트된 조회수를 다시 조회하고 content 파싱
                const updatedRows = await sql`SELECT * FROM blog_posts WHERE id = ${id} AND published = 1`;
                const updatedPost = updatedRows[0];
                updatedPost.content = parseContentForDisplay(updatedPost.content);
                res.json(updatedPost);
            } else {
                // 이미 조회한 IP인 경우 기존 데이터 반환
                res.json(post);
            }
        } catch (viewError) {
            console.error('조회 기록 저장 오류:', viewError);
            // 조회 기록 저장 실패해도 포스트는 반환
            res.json(post);
        }
    } catch (error) {
        console.error('블로그 포스트 조회 오류:', error);
        res.status(500).json({ error: 'Failed to fetch post.' });
    }
});

// 블로그 포스트 작성 (관리자 전용)
app.post('/api/blog/posts', authMiddleware, async (req, res) => {
    const { title, content, thumbnail, author } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    }
    
    try {
        const result = await sql`
            INSERT INTO blog_posts (title, content, thumbnail, author) 
            VALUES (${title}, ${content}, ${thumbnail || null}, ${author || '새벽하우징'})
            RETURNING id
        `;
        console.log('블로그 포스트 저장 완료:', result[0].id);
        res.json({ success: true, id: result[0].id });
    } catch (error) {
        console.error('블로그 포스트 저장 오류:', error);
        res.status(500).json({ error: 'Failed to save post.' });
    }
});

// 블로그 포스트 수정 (관리자 전용)
app.put('/api/blog/posts/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { title, content, thumbnail, published } = req.body;
    
    try {
        const result = await sql`
            UPDATE blog_posts 
            SET title = ${title}, 
                content = ${content}, 
                thumbnail = ${thumbnail || null}, 
                published = ${published !== undefined ? published : 1}, 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ${id}
        `;
        
        if (result.rowCount > 0) {
            console.log('블로그 포스트 수정 완료:', id);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: '포스트를 찾을 수 없습니다.' });
        }
    } catch (error) {
        console.error('블로그 포스트 수정 오류:', error);
        res.status(500).json({ error: 'Failed to update post.' });
    }
});

// 블로그 포스트 삭제 (관리자 전용)
app.delete('/api/blog/posts/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    
    try {
        console.log('블로그 포스트 삭제 시작:', id);
        
        // 먼저 포스트 데이터를 가져옴 (이미지 URL 추출용)
        const posts = await sql`SELECT * FROM blog_posts WHERE id = ${id}`;
        
        if (posts.length === 0) {
            console.log('포스트를 찾을 수 없음:', id);
            return res.status(404).json({ error: '포스트를 찾을 수 없습니다.' });
        }
        
        const post = posts[0];
        console.log('포스트 데이터:', { 
            id: post.id, 
            title: post.title, 
            thumbnail: post.thumbnail,
            contentLength: post.content ? post.content.length : 0 
        });
        
        const imagePublicIds = [];
        
        // 썸네일 이미지의 public_id 추출 (더 강력한 정규식)
        if (post.thumbnail) {
            console.log('썸네일 URL:', post.thumbnail);
            // Cloudinary URL 형식: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/image_name.ext
            const thumbnailMatch = post.thumbnail.match(/\/upload\/(?:v\d+\/)?(.*?)(?:\.[^.\/]+)?$/);
            if (thumbnailMatch) {
                const publicId = thumbnailMatch[1].replace(/\.[^.]+$/, ''); // 확장자 제거
                imagePublicIds.push(publicId);
                console.log('썸네일 public_id 추출:', publicId);
            } else {
                console.log('썸네일 public_id 추출 실패');
            }
        }
        
        // 본문 내용에서 Cloudinary 이미지 URL 추출 (더 강력한 정규식)
        if (post.content) {
            console.log('본문 내용 검색 시작...');
            // src="https://res.cloudinary.com/..." 형태를 찾음
            const cloudinaryRegex = /https?:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/(?:v\d+\/)?(.*?)(?:\.[^.\/\s"'<>]+)?(?=["'\s<>])/g;
            let match;
            let matchCount = 0;
            while ((match = cloudinaryRegex.exec(post.content)) !== null) {
                matchCount++;
                const publicId = match[1].replace(/\.[^.]+$/, ''); // 확장자 제거
                imagePublicIds.push(publicId);
                console.log(`본문 이미지 ${matchCount} public_id 추출:`, publicId);
            }
            console.log(`본문에서 총 ${matchCount}개 이미지 찾음`);
        }
        
        console.log('총 추출된 public_ids:', imagePublicIds);
        console.log('Cloudinary 설정 상태:', {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '설정됨' : '없음',
            api_key: process.env.CLOUDINARY_API_KEY ? '설정됨' : '없음',
            api_secret: process.env.CLOUDINARY_API_SECRET ? '설정됨' : '없음'
        });
        
        // Cloudinary에서 이미지들 삭제
        if (imagePublicIds.length > 0) {
            console.log(`${imagePublicIds.length}개 이미지 삭제 시작...`);
            const deletePromises = imagePublicIds.map(publicId => {
                console.log('삭제 시도:', publicId);
                return cloudinary.uploader.destroy(publicId)
                    .then(result => {
                        console.log(`✅ Cloudinary 이미지 삭제 성공: ${publicId}`, result);
                        return result;
                    })
                    .catch(err => {
                        console.error(`❌ Cloudinary 이미지 삭제 실패: ${publicId}`, err);
                        // 이미지 삭제 실패해도 계속 진행
                        return null;
                    });
            });
            
            await Promise.all(deletePromises);
        } else {
            console.log('삭제할 이미지가 없음');
        }
        
        // 데이터베이스에서 포스트 삭제
        await sql`DELETE FROM blog_posts WHERE id = ${id}`;
        
        console.log('✅ 블로그 포스트 삭제 완료:', id, `(이미지 ${imagePublicIds.length}개 삭제 시도)`);
        res.json({ success: true, deletedImages: imagePublicIds.length });
    } catch (error) {
        console.error('블로그 포스트 삭제 오류:', error);
        res.status(500).json({ error: 'Failed to delete post.' });
    }
});

// --- 블로그 에이전트 API ---

// 주제 목록 조회
app.get('/api/blog/topics', authMiddleware, async (req, res) => {
    try {
        const topics = await sql`SELECT * FROM blog_topics ORDER BY created_at DESC`;
        console.log('주제 목록 조회 결과:', JSON.stringify(topics, null, 2));
        res.json(topics);
    } catch (error) {
        console.error('주제 조회 오류:', error);
        res.status(500).json({ error: 'Failed to fetch topics.' });
    }
});

// 주제 추가
app.post('/api/blog/topics', authMiddleware, async (req, res) => {
    const { topic, keywords } = req.body;
    
    if (!topic) {
        return res.status(400).json({ error: '주제는 필수입니다.' });
    }
    
    try {
        const result = await sql`
            INSERT INTO blog_topics (topic, keywords)
            VALUES (${topic}, ${keywords || null})
            RETURNING id
        `;
        console.log('주제 추가 완료:', result[0].id);
        res.json({ success: true, id: result[0].id });
    } catch (error) {
        console.error('주제 추가 오류:', error);
        res.status(500).json({ error: 'Failed to add topic.' });
    }
});

// 주제 삭제
app.delete('/api/blog/topics/:id', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    
    try {
        console.log('주제 삭제 시도:', id, typeof id);
        
        // ID 유효성 검사
        if (isNaN(id)) {
            return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
        }
        
        // 먼저 주제가 존재하는지 확인
        const existingTopic = await sql`SELECT * FROM blog_topics WHERE id = ${id}`;
        console.log('기존 주제 조회 결과:', existingTopic);
        
        if (existingTopic.length === 0) {
            return res.status(404).json({ error: '주제를 찾을 수 없습니다.' });
        }
        
        // 삭제 실행 (주제가 존재하는 것을 확인했으므로 삭제 진행)
        await sql`DELETE FROM blog_topics WHERE id = ${id}`;
        
        // 삭제 후 재확인
        const checkDeleted = await sql`SELECT * FROM blog_topics WHERE id = ${id}`;
        
        if (checkDeleted.length === 0) {
            console.log('주제 삭제 완료:', id);
            res.json({ success: true });
        } else {
            console.log('삭제 실패 - 주제가 여전히 존재함:', id);
            res.status(500).json({ 
                error: '삭제에 실패했습니다.', 
                debug: {
                    id: id,
                    message: '삭제 후에도 주제가 존재합니다.'
                }
            });
        }
    } catch (error) {
        console.error('주제 삭제 오류 상세:', error);
        res.status(500).json({ error: 'Failed to delete topic.', details: error.message });
    }
});

// 주제 리셋 (모든 주제를 미사용으로)
app.post('/api/blog/topics/reset', authMiddleware, async (req, res) => {
    try {
        const count = await resetAllTopics(sql);
        res.json({ success: true, resetCount: count });
    } catch (error) {
        console.error('주제 리셋 오류:', error);
        res.status(500).json({ error: 'Failed to reset topics.' });
    }
});

// 블로그 자동 생성 (수동 트리거)
app.post('/api/blog/auto-generate', authMiddleware, async (req, res) => {
    try {
        const result = await runBlogGeneration(sql);
        res.json(result);
    } catch (error) {
        console.error('블로그 자동 생성 오류:', error);
        res.status(500).json({ error: 'Failed to generate blog post.' });
    }
});

// Vercel Cron을 위한 엔드포인트 (매시간 실행, 설정된 시간에만 블로그 생성)
app.get('/api/cron/blog-auto-generate', async (req, res) => {
    // Vercel Cron의 요청인지 확인
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    
    // 프로덕션에서는 CRON_SECRET 검증
    if (process.env.NODE_ENV === 'production' && cronSecret) {
        if (authHeader !== `Bearer ${cronSecret}`) {
            console.log('권한 없는 Cron 요청 차단');
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }
    
    try {
        // 현재 시간 (한국 시간)
        const now = new Date();
        const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentHour = koreaTime.getHours();
        const currentMinute = koreaTime.getMinutes();
        const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        
        console.log('[Vercel Cron] 체크 시간:', currentTime);
        
        // 데이터베이스에서 설정 가져오기
        const config = await sql`SELECT * FROM agent_config ORDER BY id DESC LIMIT 1`;
        
        if (config.length === 0) {
            console.log('[Vercel Cron] 설정이 없습니다.');
            return res.json({ success: false, message: '설정이 없습니다.' });
        }
        
        const { is_enabled, schedule_time, last_run } = config[0];
        
        console.log('[Vercel Cron] 설정:', { is_enabled, schedule_time, last_run });
        
        // 비활성화 상태면 실행하지 않음
        if (!is_enabled) {
            console.log('[Vercel Cron] 에이전트가 비활성화되어 있습니다.');
            return res.json({ success: false, message: '에이전트 비활성화 상태' });
        }
        
        // 설정된 시간과 분 비교 (±10분 허용)
        const [scheduleHour, scheduleMinute] = schedule_time.split(':').map(v => parseInt(v));
        const scheduleTotalMinutes = scheduleHour * 60 + scheduleMinute;
        const currentTotalMinutes = currentHour * 60 + currentMinute;
        const minuteDiff = Math.abs(currentTotalMinutes - scheduleTotalMinutes);
        
        // 설정된 시간의 ±10분 이내가 아니면 실행하지 않음
        if (minuteDiff > 10) {
            console.log(`[Vercel Cron] 실행 시간이 아닙니다. (현재: ${currentTime}, 설정: ${schedule_time}, 차이: ${minuteDiff}분)`);
            return res.json({ success: false, message: '실행 시간 아님', currentTime, scheduleTime: schedule_time, minuteDiff });
        }
        
        // 오늘 이미 실행했는지 확인
        if (last_run) {
            const lastRunDate = new Date(last_run);
            const lastRunKorea = new Date(lastRunDate.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const today = koreaTime.toDateString();
            const lastRunDay = lastRunKorea.toDateString();
            
            if (today === lastRunDay) {
                console.log('[Vercel Cron] 오늘 이미 실행했습니다:', lastRunDate);
                return res.json({ success: false, message: '오늘 이미 실행됨', lastRun: last_run });
            }
        }
        
        // 블로그 생성 실행
        console.log('[Vercel Cron] 블로그 자동 생성 시작:', currentTime);
        const result = await runBlogGeneration(sql);
        
        // 마지막 실행 시간 업데이트
        await sql`
            UPDATE agent_config 
            SET last_run = CURRENT_TIMESTAMP 
            WHERE id = ${config[0].id}
        `;
        
        console.log('[Vercel Cron] 블로그 자동 생성 완료:', result);
        res.json({ success: true, result, executedAt: currentTime });
    } catch (error) {
        console.error('[Vercel Cron] 블로그 자동 생성 오류:', error);
        res.status(500).json({ error: 'Failed to generate blog post.', details: error.message });
    }
});

// 에이전트 상태 조회
app.get('/api/blog/agent-status', authMiddleware, async (req, res) => {
    try {
        // 데이터베이스에서 설정 가져오기
        const config = await sql`SELECT * FROM agent_config ORDER BY id DESC LIMIT 1`;
        
        let agentConfig = {
            isEnabled: true,
            scheduleTime: '09:00',
            lastRun: null
        };
        
        if (config.length > 0) {
            agentConfig = {
                isEnabled: config[0].is_enabled,
                scheduleTime: config[0].schedule_time,
                lastRun: config[0].last_run
            };
        }
        
        // 미사용 주제 개수 조회
        const unusedTopics = await sql`SELECT COUNT(*) as count FROM blog_topics WHERE used = FALSE`;
        const totalTopics = await sql`SELECT COUNT(*) as count FROM blog_topics`;
        
        res.json({
            ...agentConfig,
            unusedTopicsCount: parseInt(unusedTopics[0].count),
            totalTopicsCount: parseInt(totalTopics[0].count),
            isScheduled: true // Vercel Cron이 항상 실행 중
        });
    } catch (error) {
        console.error('에이전트 상태 조회 오류:', error);
        res.status(500).json({ error: 'Failed to fetch agent status.' });
    }
});

// 에이전트 설정 업데이트
app.put('/api/blog/agent-config', authMiddleware, async (req, res) => {
    const { isEnabled, scheduleTime } = req.body;
    
    try {
        // 데이터베이스에서 기존 설정 가져오기
        const config = await sql`SELECT * FROM agent_config ORDER BY id DESC LIMIT 1`;
        
        if (config.length > 0) {
            // 업데이트
            const updateFields = [];
            const params = [];
            
            if (isEnabled !== undefined) {
                updateFields.push('is_enabled = $1');
                params.push(isEnabled);
            }
            
            if (scheduleTime !== undefined) {
                updateFields.push(params.length > 0 ? `schedule_time = $${params.length + 1}` : 'schedule_time = $1');
                params.push(scheduleTime);
            }
            
            updateFields.push(params.length > 0 ? `updated_at = CURRENT_TIMESTAMP` : 'updated_at = CURRENT_TIMESTAMP');
            
            if (isEnabled !== undefined && scheduleTime !== undefined) {
                await sql`
                    UPDATE agent_config 
                    SET is_enabled = ${isEnabled}, 
                        schedule_time = ${scheduleTime},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${config[0].id}
                `;
            } else if (isEnabled !== undefined) {
                await sql`
                    UPDATE agent_config 
                    SET is_enabled = ${isEnabled},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${config[0].id}
                `;
            } else if (scheduleTime !== undefined) {
                await sql`
                    UPDATE agent_config 
                    SET schedule_time = ${scheduleTime},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${config[0].id}
                `;
            }
        } else {
            // 새로 생성
            await sql`
                INSERT INTO agent_config (is_enabled, schedule_time)
                VALUES (${isEnabled ?? true}, ${scheduleTime ?? '09:00'})
            `;
        }
        
        // 업데이트된 설정 반환
        const updatedConfig = await sql`SELECT * FROM agent_config ORDER BY id DESC LIMIT 1`;
        
        res.json({ 
            success: true, 
            status: {
                isEnabled: updatedConfig[0].is_enabled,
                scheduleTime: updatedConfig[0].schedule_time,
                lastRun: updatedConfig[0].last_run
            }
        });
    } catch (error) {
        console.error('에이전트 설정 업데이트 오류:', error);
        res.status(500).json({ error: 'Failed to update agent config.' });
    }
});

// --- 페이지 라우트 ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin.html', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.post('/login', (req, res) => {
    console.log('로그인 시도:', req.body);
    console.log('입력된 비밀번호:', req.body.password);
    console.log('올바른 비밀번호:', ADMIN_PASSWORD);
    console.log('비밀번호 일치 여부:', req.body.password === ADMIN_PASSWORD);
    
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.isAuthenticated = true;
        console.log('로그인 성공! 세션 설정:', req.session);
        res.redirect('/admin');
    } else {
        console.log('로그인 실패 - 비밀번호 불일치');
        res.redirect('/login?error=1');
    }
});
app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

// public 폴더의 정적 파일을 라우트 핸들러 뒤에서 제공합니다.
app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
}); 