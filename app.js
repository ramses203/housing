const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const port = process.env.PORT || 7000;
const ADMIN_PASSWORD = 'admin'; // 실제 운영 시에는 환경 변수 등으로 관리해야 합니다.

// Cloudinary 설정
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
    api_key: process.env.CLOUDINARY_API_KEY || 'your-api-key',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'your-api-secret'
});

// 세션 설정
app.use(session({
    secret: 'your-secret-key', // 실제 운영 시에는 복잡하고 긴 키로 변경하세요.
    resave: false,
    saveUninitialized: true,
}));

// 폼 데이터 처리를 위한 미들웨어
app.use(express.urlencoded({ extended: true }));

// Cloudinary를 사용한 갤러리 이미지 저장 설정
const galleryStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'housing-gallery',
        format: async (req, file) => 'png',
        public_id: (req, file) => Date.now() + '-gallery'
    }
});
const upload = multer({ storage: galleryStorage });

// Cloudinary를 사용한 상품 이미지 저장 설정
const productStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'housing-products',
        format: async (req, file) => 'png',
        public_id: (req, file) => Date.now() + '-product'
    }
});
const uploadProduct = multer({ storage: productStorage });

// 정적 파일 제공 (CSS, JS, 이미지 등)
app.use(express.static(path.join(__dirname, 'public')));

// 로그인 확인 미들웨어
const authMiddleware = (req, res, next) => {
    if (req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/login');
};

// 루트 경로: 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 로그인 페이지
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 로그인 처리
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.isAuthenticated = true;
        res.redirect('/admin');
    } else {
        res.redirect('/login');
    }
});

// 로그아웃 처리
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if(err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

// 상품 추가 처리 (인증 필요)
app.post('/admin/product', authMiddleware, uploadProduct.single('productImage'), (req, res) => {
    const { productName, productDescription, productPrice } = req.body;
    const productImage = req.file ? req.file.path : ''; // Cloudinary URL 사용

    const newProduct = {
        id: Date.now(),
        name: productName,
        price: parseInt(productPrice, 10),
        description: productDescription,
        image: productImage,
        cloudinary_id: req.file ? req.file.filename : null // 삭제를 위한 Cloudinary ID 저장
    };

    const productsFilePath = path.join(__dirname, 'data', 'products.json');
    fs.readFile(productsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('상품을 추가하는 중 오류가 발생했습니다.');
        }
        const products = JSON.parse(data);
        products.push(newProduct);
        fs.writeFile(productsFilePath, JSON.stringify(products, null, 2), (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('상품을 저장하는 중 오류가 발생했습니다.');
            }
            res.redirect('/admin');
        });
    });
});

// 관리자 페이지 (인증 필요)
app.get('/admin', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 이미지 업로드 처리 (인증 필요)
app.post('/upload', authMiddleware, upload.array('images', 100), (req, res) => {
    console.log('업로드된 파일들:', req.files);
    res.redirect('/admin');
});

// 갤러리 이미지 목록 API
app.get('/api/images', (req, res) => {
    cloudinary.search
        .expression('folder:housing-gallery')
        .sort_by([['created_at', 'desc']])
        .max_results(50)
        .execute()
        .then(result => {
            const images = result.resources.map(image => ({
                url: image.secure_url,
                public_id: image.public_id
            }));
            res.json(images);
        })
        .catch(error => {
            console.error('Cloudinary 이미지 조회 오류:', error);
            res.status(500).json({ error: '서버 오류' });
        });
});

// 이미지 삭제 API (인증 필요)
app.delete('/api/images/:public_id', authMiddleware, (req, res) => {
    const { public_id } = req.params;
    
    // Cloudinary public_id 형식 확인 (보안을 위해)
    if (!public_id || public_id.includes('..')) {
        return res.status(400).json({ success: false, error: '잘못된 이미지 ID입니다.' });
    }

    cloudinary.uploader.destroy(public_id)
        .then(result => {
            if (result.result === 'ok') {
                res.json({ success: true });
            } else {
                res.status(400).json({ success: false, error: '이미지 삭제에 실패했습니다.' });
            }
        })
        .catch(error => {
            console.error('Cloudinary 이미지 삭제 오류:', error);
            res.status(500).json({ success: false, error: '이미지를 삭제하는 중 오류가 발생했습니다.' });
        });
});

// 상품 삭제 API (인증 필요)
app.delete('/api/products/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const productsFilePath = path.join(__dirname, 'data', 'products.json');

    fs.readFile(productsFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ success: false, error: '상품 데이터를 읽는 중 오류 발생' });
        }

        let products = JSON.parse(data);
        const productToDelete = products.find(p => p.id == id);

        if (!productToDelete) {
            return res.status(404).json({ success: false, error: '상품을 찾을 수 없습니다.' });
        }

        // Cloudinary에서 연결된 이미지 삭제
        if (productToDelete.cloudinary_id) {
            cloudinary.uploader.destroy(productToDelete.cloudinary_id)
                .then(result => console.log('상품 이미지 삭제 완료:', result))
                .catch(error => console.error('상품 이미지 삭제 중 오류:', error));
        }
        
        // 목록에서 상품 제거
        const updatedProducts = products.filter(p => p.id != id);

        fs.writeFile(productsFilePath, JSON.stringify(updatedProducts, null, 2), (writeErr) => {
            if (writeErr) {
                return res.status(500).json({ success: false, error: '상품 데이터를 저장하는 중 오류 발생' });
            }
            res.json({ success: true });
        });
    });
});

// 상품 목록 API
app.get('/api/products', (req, res) => {
    const productsFilePath = path.join(__dirname, 'data', 'products.json');
    fs.readFile(productsFilePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') { // 파일이 없는 경우
                return res.json([]);
            }
            console.error(err);
            return res.status(500).json({ error: '서버 오류' });
        }
        res.json(JSON.parse(data));
    });
});

app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
}); 