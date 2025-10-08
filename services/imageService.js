require('dotenv').config();
const axios = require('axios');
const cloudinary = require('cloudinary').v2;

// Cloudinary 설정
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Unsplash API를 사용하여 키워드에 맞는 이미지 검색
 * @param {string} keyword - 검색 키워드
 * @param {number} count - 가져올 이미지 개수 (기본: 1)
 * @returns {Promise<Array>} 이미지 URL 배열
 */
async function searchUnsplashImages(keyword, count = 1) {
    try {
        const accessKey = process.env.UNSPLASH_ACCESS_KEY;
        if (!accessKey) {
            throw new Error('UNSPLASH_ACCESS_KEY가 설정되지 않았습니다.');
        }

        const response = await axios.get('https://api.unsplash.com/search/photos', {
            params: {
                query: keyword,
                per_page: count,
                orientation: 'landscape'
            },
            headers: {
                'Authorization': `Client-ID ${accessKey}`
            }
        });

        if (response.data.results && response.data.results.length > 0) {
            return response.data.results.map(img => ({
                url: img.urls.regular,
                description: img.alt_description || keyword,
                photographer: img.user.name,
                source: 'unsplash'
            }));
        }

        return [];
    } catch (error) {
        console.error('Unsplash 이미지 검색 오류:', error.message);
        return [];
    }
}

/**
 * Pexels API를 사용하여 키워드에 맞는 이미지 검색 (백업)
 * @param {string} keyword - 검색 키워드
 * @param {number} count - 가져올 이미지 개수 (기본: 1)
 * @returns {Promise<Array>} 이미지 URL 배열
 */
async function searchPexelsImages(keyword, count = 1) {
    try {
        const apiKey = process.env.PEXELS_API_KEY;
        if (!apiKey) {
            throw new Error('PEXELS_API_KEY가 설정되지 않았습니다.');
        }

        const response = await axios.get('https://api.pexels.com/v1/search', {
            params: {
                query: keyword,
                per_page: count,
                orientation: 'landscape'
            },
            headers: {
                'Authorization': apiKey
            }
        });

        if (response.data.photos && response.data.photos.length > 0) {
            return response.data.photos.map(img => ({
                url: img.src.large,
                description: keyword,
                photographer: img.photographer,
                source: 'pexels'
            }));
        }

        return [];
    } catch (error) {
        console.error('Pexels 이미지 검색 오류:', error.message);
        return [];
    }
}

/**
 * 키워드로 이미지 검색 (Unsplash 우선, 실패시 Pexels)
 * @param {string} keyword - 검색 키워드
 * @param {number} count - 가져올 이미지 개수 (기본: 1)
 * @returns {Promise<Array>} 이미지 정보 배열
 */
async function searchImages(keyword, count = 1) {
    // 먼저 Unsplash 시도
    let images = await searchUnsplashImages(keyword, count);
    
    // Unsplash 실패시 Pexels 시도
    if (images.length === 0) {
        console.log('Unsplash 검색 실패, Pexels로 시도합니다.');
        images = await searchPexelsImages(keyword, count);
    }

    return images;
}

/**
 * URL로부터 이미지를 다운로드하여 Cloudinary에 업로드
 * @param {string} imageUrl - 이미지 URL
 * @param {string} folder - Cloudinary 폴더명 (기본: 'blog-images')
 * @returns {Promise<Object>} Cloudinary 업로드 결과
 */
async function uploadImageToCloudinary(imageUrl, folder = 'blog-images') {
    try {
        const result = await cloudinary.uploader.upload(imageUrl, {
            folder: folder,
            resource_type: 'image'
        });

        return {
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height
        };
    } catch (error) {
        console.error('Cloudinary 업로드 오류:', error.message);
        throw error;
    }
}

/**
 * 키워드로 이미지를 검색하고 Cloudinary에 업로드
 * @param {string} keyword - 검색 키워드
 * @param {number} count - 업로드할 이미지 개수 (기본: 1)
 * @returns {Promise<Array>} 업로드된 이미지 정보 배열
 */
async function searchAndUploadImages(keyword, count = 1) {
    try {
        // 이미지 검색
        const images = await searchImages(keyword, count);
        
        if (images.length === 0) {
            console.warn(`키워드 "${keyword}"에 대한 이미지를 찾을 수 없습니다.`);
            return [];
        }

        // Cloudinary에 업로드
        const uploadPromises = images.map(async (img) => {
            try {
                const uploaded = await uploadImageToCloudinary(img.url);
                return {
                    ...uploaded,
                    description: img.description,
                    photographer: img.photographer,
                    source: img.source
                };
            } catch (error) {
                console.error(`이미지 업로드 실패: ${img.url}`, error.message);
                return null;
            }
        });

        const results = await Promise.all(uploadPromises);
        return results.filter(result => result !== null);
    } catch (error) {
        console.error('이미지 검색 및 업로드 오류:', error.message);
        return [];
    }
}

module.exports = {
    searchImages,
    searchUnsplashImages,
    searchPexelsImages,
    uploadImageToCloudinary,
    searchAndUploadImages
};

