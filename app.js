const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');

const app = express();
const port = 7000;
const ADMIN_PASSWORD = 'admin'; // 실제 운영 시에는 환경 변수 등으로 관리해야 합니다.

// 세션 설정
app.use(session({
    secret: 'your-secret-key', // 실제 운영 시에는 복잡하고 긴 키로 변경하세요.
    resave: false,
    saveUninitialized: true,
}));

// 폼 데이터 처리를 위한 미들웨어
app.use(express.urlencoded({ extended: true }));

// Multer 설정: 이미지를 public/images 폴더에 저장
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 상품 이미지 저장을 위한 Multer 설정
const productStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/products');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const uploadProduct = multer({ storage: productStorage });

app.use(express.static('public'));

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
    const productImage = req.file ? `images/products/${req.file.filename}` : '';

    const newProduct = {
        id: Date.now(),
        name: productName,
        price: parseInt(productPrice, 10), // 숫자로 변환하여 저장
        description: productDescription,
        image: productImage
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
    const imagesDir = path.join(__dirname, 'public', 'images');
    fs.readdir(imagesDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: '서버 오류' });
        }
        const imageFiles = files.filter(file => !/^\./.test(file) && /\.(jpg|jpeg|png|gif)$/i.test(file));
        res.json(imageFiles);
    });
});

// 이미지 삭제 API (인증 필요)
app.delete('/api/images/:filename', authMiddleware, (req, res) => {
    const { filename } = req.params;

    // 경로 조작 공격 방지
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ success: false, error: '잘못된 파일 이름입니다.' });
    }

    const imagePath = path.join(__dirname, 'public', 'images', filename);

    fs.unlink(imagePath, (err) => {
        if (err) {
            console.error('이미지 삭제 오류:', err);
            return res.status(500).json({ success: false, error: '이미지를 삭제하는 중 오류가 발생했습니다.' });
        }
        res.json({ success: true });
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

        // 연결된 이미지 파일 삭제
        if (productToDelete.image) {
            const imagePath = path.join(__dirname, 'public', productToDelete.image);
            fs.unlink(imagePath, (unlinkErr) => {
                if (unlinkErr) console.error('상품 이미지 삭제 중 오류:', unlinkErr);
            });
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