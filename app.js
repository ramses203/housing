const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cloudinary = require('cloudinary').v2;

const app = express();
const port = process.env.PORT || 7000;
const ADMIN_PASSWORD = 'admin';

// Cloudinary 설정
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use(session({ secret: 'your-secret-key', resave: false, saveUninitialized: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // JSON 요청 본문을 처리하기 위해 추가
app.use(express.static(path.join(__dirname, 'public')));

// --- 인증 미들웨어 ---
const authMiddleware = (req, res, next) => {
    if (req.session.isAuthenticated) return next();
    res.redirect('/login');
};

// --- API 라우트 ---

// 갤러리 이미지 목록 API
app.get('/api/images', (req, res) => {
    fs.readFile(path.join(__dirname, 'data', 'gallery.json'), 'utf8', (err, data) => {
        if (err) return res.json([]);
        res.json(JSON.parse(data));
    });
});

// 갤러리 이미지 정보 저장 API
app.post('/api/images', authMiddleware, (req, res) => {
    const newImage = { url: req.body.url, public_id: req.body.public_id };
    const galleryFilePath = path.join(__dirname, 'data', 'gallery.json');
    fs.readFile(galleryFilePath, 'utf8', (err, data) => {
        const images = (err || !data) ? [] : JSON.parse(data);
        images.push(newImage);
        fs.writeFile(galleryFilePath, JSON.stringify(images, null, 2), () => res.json({ success: true }));
    });
});

// 갤러리 이미지 삭제 API
app.delete('/api/images/:public_id', authMiddleware, (req, res) => {
    const public_id = decodeURIComponent(req.params.public_id);
    cloudinary.uploader.destroy(public_id, (error, result) => {
        if (error) return res.status(500).json({ success: false, error: 'Cloudinary 삭제 실패' });
        const galleryFilePath = path.join(__dirname, 'data', 'gallery.json');
        fs.readFile(galleryFilePath, 'utf8', (err, data) => {
            if (err) return res.json({ success: true }); // 파일이 없어도 성공으로 간주
            const images = JSON.parse(data).filter(img => img.public_id !== public_id);
            fs.writeFile(galleryFilePath, JSON.stringify(images, null, 2), () => res.json({ success: true }));
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
    const productsFilePath = path.join(__dirname, 'data', 'products.json');
    fs.readFile(productsFilePath, 'utf8', (err, data) => {
        const products = (err || !data) ? [] : JSON.parse(data);
        products.push(newProduct);
        fs.writeFile(productsFilePath, JSON.stringify(products, null, 2), () => res.json({ success: true }));
    });
});

// 상품 삭제 API (기존 로직과 거의 동일, Cloudinary ID를 사용)
app.delete('/api/products/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const productsFilePath = path.join(__dirname, 'data', 'products.json');
    fs.readFile(productsFilePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ success: false, error: '상품 데이터 읽기 실패' });
        let products = JSON.parse(data);
        const productToDelete = products.find(p => p.id == id);
        if (!productToDelete) return res.status(404).json({ success: false, error: '상품 없음' });
        if (productToDelete.cloudinary_id) {
            cloudinary.uploader.destroy(productToDelete.cloudinary_id);
        }
        const updatedProducts = products.filter(p => p.id != id);
        fs.writeFile(productsFilePath, JSON.stringify(updatedProducts, null, 2), (writeErr) => {
            if (writeErr) return res.status(500).json({ success: false, error: '상품 데이터 쓰기 실패' });
            res.json({ success: true });
        });
    });
});


// 상품 목록 API
app.get('/api/products', (req, res) => {
    fs.readFile(path.join(__dirname, 'data', 'products.json'), 'utf8', (err, data) => {
        if (err) return res.json([]);
        res.json(JSON.parse(data));
    });
});

// --- 페이지 라우트 ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.post('/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.isAuthenticated = true;
        res.redirect('/admin');
    } else {
        res.redirect('/login');
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
}); 