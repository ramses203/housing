require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieSession = require('cookie-session');
const { neon } = require('@neondatabase/serverless');

const app = express();
const port = process.env.PORT || 7000;
const ADMIN_PASSWORD = 'bae1234!';

// Neon 데이터베이스 연결
const sql = neon(process.env.DATABASE_URL);

// 데이터베이스 테이블 초기화
async function initDatabase() {
  try {
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published INTEGER DEFAULT 1
      )
    `;
    
    console.log('데이터베이스 테이블 초기화 완료');
  } catch (error) {
    console.error('데이터베이스 초기화 오류:', error);
  }
}

// 서버 시작 시 데이터베이스 초기화
initDatabase();

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
        res.json(rows);
    } catch (error) {
        console.error('블로그 포스트 조회 오류:', error);
        res.json([]);
    }
});

// 특정 블로그 포스트 상세 조회 (공개)
app.get('/api/blog/posts/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const rows = await sql`SELECT * FROM blog_posts WHERE id = ${id} AND published = 1`;
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: '포스트를 찾을 수 없습니다.' });
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
        const result = await sql`DELETE FROM blog_posts WHERE id = ${id}`;
        
        if (result.rowCount > 0) {
            console.log('블로그 포스트 삭제 완료:', id);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: '포스트를 찾을 수 없습니다.' });
        }
    } catch (error) {
        console.error('블로그 포스트 삭제 오류:', error);
        res.status(500).json({ error: 'Failed to delete post.' });
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