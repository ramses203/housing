const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieSession = require('cookie-session');
const cloudinary = require('cloudinary').v2;

const app = express();
const port = process.env.PORT || 7000;
const ADMIN_PASSWORD = 'admin';
const isProd = process.env.NODE_ENV === 'production';
const GALLERY_FILE_PATH = isProd ? '/tmp/gallery.json' : path.join(__dirname, 'data', 'gallery.json');
const PRODUCTS_FILE_PATH = isProd ? '/tmp/products.json' : path.join(__dirname, 'data', 'products.json');

// Cloudinary 설정
let cloudinaryOptions = { secure: true };
const url = process.env.CLOUDINARY_URL;
let parsedOk = false;
if (url) {
    const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (match) {
        const [ , apiKey, apiSecret, cloudName] = match;
        // placeholder 값인지 확인
        if (!apiKey.startsWith('CLOUDINARY_') && !apiSecret.startsWith('CLOUDINARY_') && !cloudName.startsWith('CLOUDINARY_')) {
            cloudinaryOptions = { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true };
            parsedOk = true;
        } else {
            console.warn('CLOUDINARY_URL 에 placeholder 값이 포함되어 있어 무시합니다.');
        }
    } else {
        console.warn('CLOUDINARY_URL 형식이 올바르지 않습니다.');
    }
}

if (!parsedOk) {
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        cloudinaryOptions = {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true
        };
    } else { 
        console.error('Cloudinary 환경변수가 올바르게 설정되지 않았습니다');
    }
}

cloudinary.config(cloudinaryOptions);
console.log('Cloudinary 최종 설정:', cloudinaryOptions);

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
app.use(express.json()); // JSON 요청 본문을 처리하기 위해 추가

// --- 인증 미들웨어 ---
const authMiddleware = (req, res, next) => {
    console.log('인증 체크:', req.session.isAuthenticated);
    if (req.session.isAuthenticated) return next();
    res.redirect('/login');
};

// --- API 라우트 ---

// 갤러리 이미지 목록 API
app.get('/api/images', (req, res) => {
    fs.readFile(GALLERY_FILE_PATH, 'utf8', (err, data) => {
        if (err) {
            // 프로덕션에서 /tmp 파일이 없으면 초기 빈 배열 생성
            if (isProd && err.code === 'ENOENT') return res.json([]);
            return res.json([]);
        }
        res.json(JSON.parse(data));
    });
});

// 갤러리 이미지 정보 저장 API ㄴ
app.post('/api/images', authMiddleware, (req, res) => {
    console.log('POST /api/images 요청 받음:', req.body); // 요청 본문 로깅
    const newImage = { url: req.body.url, public_id: req.body.public_id };
    fs.readFile(GALLERY_FILE_PATH, 'utf8', (err, data) => {
        const images = (err || !data) ? [] : JSON.parse(data);
        images.push(newImage);
        fs.writeFile(GALLERY_FILE_PATH, JSON.stringify(images, null, 2), (writeErr) => {
            if (writeErr) {
                console.error('갤러리 파일 쓰기 오류:', writeErr);
                return res.status(500).json({ success: false, error: 'Failed to save image data.' });
            }
            console.log('갤러리 파일에 성공적으로 저장됨.');
            res.json({ success: true });
        });
    });
});

// 갤러리 이미지 삭제 API
app.delete('/api/images/:public_id', authMiddleware, (req, res) => {
    const public_id = decodeURIComponent(req.params.public_id);
    cloudinary.uploader.destroy(public_id, (error, result) => {
        if (error) return res.status(500).json({ success: false, error: 'Cloudinary 삭제 실패' });
        fs.readFile(GALLERY_FILE_PATH, 'utf8', (err, data) => {
            if (err) return res.json({ success: true }); // 파일이 없어도 성공으로 간주
            const images = JSON.parse(data).filter(img => img.public_id !== public_id);
            fs.writeFile(GALLERY_FILE_PATH, JSON.stringify(images, null, 2), () => res.json({ success: true }));
        });
    });
});

// 상품 추가 처리
app.post('/admin/product', authMiddleware, (req, res) => {
    const { productName, productPrice, productDescription, productImage, cloudinaryId } = req.body;
    const newProduct = {
        id: Date.now(),
        name: productName,
        price: parseInt(productPrice, 10),
        description: productDescription,
        image: productImage,
        cloudinary_id: cloudinaryId
    };
    fs.readFile(PRODUCTS_FILE_PATH, 'utf8', (err, data) => {
        const products = (err || !data) ? [] : JSON.parse(data);
        products.push(newProduct);
        fs.writeFile(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2), () => res.json({ success: true }));
    });
});

// 상품 삭제 API (기존 로직과 거의 동일, Cloudinary ID를 사용)
app.delete('/api/products/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    fs.readFile(PRODUCTS_FILE_PATH, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ success: false, error: '상품 데이터 읽기 실패' });
        let products = JSON.parse(data);
        const productToDelete = products.find(p => p.id == id);
        if (!productToDelete) return res.status(404).json({ success: false, error: '상품 없음' });
        if (productToDelete.cloudinary_id) {
            cloudinary.uploader.destroy(productToDelete.cloudinary_id);
        }
        const updatedProducts = products.filter(p => p.id != id);
        fs.writeFile(PRODUCTS_FILE_PATH, JSON.stringify(updatedProducts, null, 2), (writeErr) => {
            if (writeErr) return res.status(500).json({ success: false, error: '상품 데이터 쓰기 실패' });
            res.json({ success: true });
        });
    });
});

// 상품 목록 API
app.get('/api/products', (req, res) => {
    fs.readFile(PRODUCTS_FILE_PATH, 'utf8', (err, data) => {
        if (err) return res.json([]);
        res.json(JSON.parse(data));
    });
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