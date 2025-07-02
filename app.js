require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieSession = require('cookie-session');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 7000;
const ADMIN_PASSWORD = 'bae1234!';

// PostgreSQL 연결 설정
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
});

// 데이터베이스 테이블 초기화
async function initDatabase() {
  const client = await pool.connect();
  try {
    // 갤러리 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS gallery (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        public_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 상품 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        description TEXT,
        image TEXT NOT NULL,
        cloudinary_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('데이터베이스 테이블 초기화 완료');
  } catch (error) {
    console.error('데이터베이스 초기화 오류:', error);
  } finally {
    client.release();
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
    const client = await pool.connect();
    try {
        const { rows } = await client.query('SELECT * FROM gallery ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('갤러리 조회 오류:', error);
        res.json([]);
    } finally {
        client.release();
    }
});

// 갤러리 이미지 정보 저장 API
app.post('/api/images', authMiddleware, async (req, res) => {
    console.log('POST /api/images 요청 받음:', req.body);
    const { url, public_id } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query(
            'INSERT INTO gallery (url, public_id) VALUES ($1, $2)',
            [url, public_id]
        );
        console.log('갤러리 데이터베이스에 성공적으로 저장됨.');
        res.json({ success: true });
    } catch (error) {
        console.error('갤러리 저장 오류:', error);
        res.status(500).json({ success: false, error: 'Failed to save image data.' });
    } finally {
        client.release();
    }
});

// 갤러리 이미지 삭제 API
app.delete('/api/images/:public_id', authMiddleware, async (req, res) => {
    const public_id = decodeURIComponent(req.params.public_id);
    
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM gallery WHERE public_id = $1', [public_id]);
        console.log('갤러리에서 성공적으로 삭제됨.');
        res.json({ success: true });
    } catch (error) {
        console.error('갤러리 삭제 오류:', error);
        res.status(500).json({ success: false, error: 'Failed to delete image.' });
    } finally {
        client.release();
    }
});

// 상품 추가 처리
app.post('/admin/product', authMiddleware, async (req, res) => {
    const { productName, productPrice, productDescription, productImage, cloudinaryId } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query(
            'INSERT INTO products (name, price, description, image, cloudinary_id) VALUES ($1, $2, $3, $4, $5)',
            [productName, parseInt(productPrice, 10), productDescription, productImage, cloudinaryId]
        );
        console.log('상품이 데이터베이스에 성공적으로 저장됨.');
        res.json({ success: true });
    } catch (error) {
        console.error('상품 저장 오류:', error);
        res.status(500).json({ success: false, error: 'Failed to save product.' });
    } finally {
        client.release();
    }
});

// 상품 삭제 API
app.delete('/api/products/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    
    const client = await pool.connect();
    try {
        const result = await client.query('DELETE FROM products WHERE id = $1', [id]);
        if (result.rowCount > 0) {
            console.log('상품이 성공적으로 삭제됨.');
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: '상품을 찾을 수 없습니다.' });
        }
    } catch (error) {
        console.error('상품 삭제 오류:', error);
        res.status(500).json({ success: false, error: 'Failed to delete product.' });
    } finally {
        client.release();
    }
});

// 상품 목록 API
app.get('/api/products', async (req, res) => {
    const client = await pool.connect();
    try {
        const { rows } = await client.query('SELECT * FROM products ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('상품 조회 오류:', error);
        res.json([]);
    } finally {
        client.release();
    }
});

// --- 페이지 라우트 ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin.html', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.post('/login', (req, res) => {
    console.log('로그인 시도:', req.body);
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.isAuthenticated = true;
        res.redirect('/admin');
    } else {
        res.redirect('/login');
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