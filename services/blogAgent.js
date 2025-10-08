require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { searchAndUploadImages } = require('./imageService');

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 이전 포스트 제목 리스트로부터 중복 방지 프롬프트 생성
 * @param {Array} previousTitles - 이전 포스트 제목 배열
 * @returns {string} 중복 방지 프롬프트
 */
function generateDuplicationAvoidancePrompt(previousTitles) {
    if (!previousTitles || previousTitles.length === 0) {
        return '';
    }

    return `\n\n다음 제목들과 내용이 중복되지 않도록 완전히 다른 관점과 내용으로 작성해주세요:\n${previousTitles.map((title, idx) => `${idx + 1}. ${title}`).join('\n')}`;
}

/**
 * HTML 콘텐츠에 이미지를 삽입
 * @param {string} content - HTML 콘텐츠
 * @param {Array} images - 이미지 정보 배열
 * @returns {string} 이미지가 삽입된 HTML 콘텐츠
 */
function insertImagesIntoContent(content, images) {
    if (!images || images.length === 0) {
        return content;
    }

    // HTML을 문단 단위로 분리
    const paragraphs = content.split('</p>').filter(p => p.trim());
    
    // 전체 문단 수 계산
    const totalParagraphs = paragraphs.length;
    
    // 이미지 삽입 위치 계산 (문단을 균등하게 분배)
    const imagePositions = [];
    const interval = Math.floor(totalParagraphs / (images.length + 1));
    
    for (let i = 0; i < images.length; i++) {
        imagePositions.push((i + 1) * interval);
    }

    // 이미지 삽입
    let result = '';
    let imageIndex = 0;

    paragraphs.forEach((paragraph, idx) => {
        // 문단 추가
        result += paragraph + '</p>\n';

        // 이미지 삽입 위치인지 확인
        if (imageIndex < images.length && imagePositions.includes(idx + 1)) {
            const img = images[imageIndex];
            result += `<figure style="margin: 2rem 0; text-align: center;">
    <img src="${img.url}" alt="${img.description || '블로그 이미지'}" style="max-width: 100%; height: auto; border-radius: 8px;">
    <figcaption style="margin-top: 0.5rem; font-size: 0.9rem; color: #666;">사진: ${img.photographer || 'Unsplash'} (${img.source || 'Unsplash'})</figcaption>
</figure>\n`;
            imageIndex++;
        }
    });

    return result;
}

/**
 * 주제로부터 키워드 추출 (간단한 버전)
 * @param {string} topic - 블로그 주제
 * @param {string} keywords - 저장된 키워드 (선택)
 * @returns {Array} 키워드 배열
 */
function extractKeywords(topic, keywords = null) {
    if (keywords) {
        return keywords.split(',').map(k => k.trim());
    }

    // 주제에서 키워드 추출 (간단한 로직)
    const commonWords = ['의', '를', '에', '은', '는', '이', '가', '와', '과', '로', '으로', '하는', '하기', '방법', '어떻게'];
    const words = topic.split(/\s+/).filter(word => 
        word.length > 1 && !commonWords.includes(word)
    );

    return words.slice(0, 3); // 최대 3개 키워드
}

/**
 * Gemini AI를 사용하여 블로그 콘텐츠 생성
 * @param {string} topic - 블로그 주제
 * @param {Array} previousTitles - 이전 포스트 제목 배열
 * @param {string} keywords - 이미지 검색용 키워드 (선택)
 * @returns {Promise<Object>} 생성된 블로그 포스트 데이터
 */
async function generateBlogPost(topic, previousTitles = [], keywords = null) {
    try {
        // Gemini 모델 선택
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

        // 중복 방지 프롬프트 생성
        const duplicationAvoidance = generateDuplicationAvoidancePrompt(previousTitles);

        // 프롬프트 구성
        const prompt = `당신은 전문 블로그 작가입니다. 다음 주제로 한국어 블로그 포스트를 작성해주세요.

주제: ${topic}

요구사항:
1. 흥미롭고 SEO 최적화된 제목을 생성하세요 (40자 이내)
2. 본문은 2000-3000자 분량으로 작성하세요
3. HTML 형식으로 작성하세요 (<p>, <h2>, <h3>, <ul>, <li>, <strong>, <em> 태그 사용)
4. 독자에게 실용적이고 유익한 정보를 제공하세요
5. 자연스럽고 친근한 어조로 작성하세요
6. 문단을 적절히 나누어 가독성을 높이세요
7. 부동산, 황토집, 건축 관련 전문 지식을 활용하세요
${duplicationAvoidance}

다음 JSON 형식으로만 응답해주세요:
{
  "title": "블로그 제목",
  "content": "HTML 형식의 본문 내용",
  "summary": "100자 이내의 요약"
}`;

        // Gemini API 호출
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // JSON 파싱 시도
        let blogData;
        try {
            // Markdown 코드 블록 제거
            const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            blogData = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('JSON 파싱 오류, 텍스트 그대로 사용:', parseError.message);
            // 파싱 실패시 기본 구조 생성
            blogData = {
                title: topic,
                content: `<p>${text.replace(/\n/g, '</p>\n<p>')}</p>`,
                summary: text.substring(0, 100)
            };
        }

        // 이미지 검색 키워드 추출
        const imageKeywords = extractKeywords(topic, keywords);
        console.log(`이미지 검색 키워드: ${imageKeywords.join(', ')}`);

        // 이미지 검색 및 업로드 (2-3개)
        const imageCount = Math.min(imageKeywords.length, 3);
        let uploadedImages = [];

        for (let i = 0; i < imageCount; i++) {
            const keyword = imageKeywords[i];
            const images = await searchAndUploadImages(keyword, 1);
            if (images.length > 0) {
                uploadedImages.push(images[0]);
            }
        }

        console.log(`업로드된 이미지 개수: ${uploadedImages.length}`);

        // 콘텐츠에 이미지 삽입
        if (uploadedImages.length > 0) {
            blogData.content = insertImagesIntoContent(blogData.content, uploadedImages);
        }

        // 썸네일 설정 (첫 번째 이미지)
        blogData.thumbnail = uploadedImages.length > 0 ? uploadedImages[0].url : null;

        return blogData;
    } catch (error) {
        console.error('블로그 포스트 생성 오류:', error.message);
        throw error;
    }
}

/**
 * 특정 주제로 블로그 포스트 생성 (DB 저장 포함)
 * @param {Object} sql - Neon SQL 클라이언트
 * @param {Object} topic - 주제 객체 {id, topic, keywords}
 * @returns {Promise<Object>} 생성된 포스트 정보
 */
async function createBlogPostFromTopic(sql, topic) {
    try {
        console.log(`블로그 포스트 생성 시작: ${topic.topic}`);

        // 최근 10개 포스트 제목 조회 (중복 방지용)
        const recentPosts = await sql`
            SELECT title FROM blog_posts 
            ORDER BY created_at DESC 
            LIMIT 10
        `;
        const previousTitles = recentPosts.map(post => post.title);

        // 블로그 포스트 생성
        const blogData = await generateBlogPost(topic.topic, previousTitles, topic.keywords);

        // DB에 저장
        const result = await sql`
            INSERT INTO blog_posts (title, content, thumbnail, topic_id, author)
            VALUES (${blogData.title}, ${blogData.content}, ${blogData.thumbnail}, ${topic.id}, '새벽하우징')
            RETURNING id
        `;

        const postId = result[0].id;

        // 주제를 사용됨으로 표시
        await sql`
            UPDATE blog_topics 
            SET used = TRUE, used_at = CURRENT_TIMESTAMP 
            WHERE id = ${topic.id}
        `;

        console.log(`블로그 포스트 생성 완료: ID ${postId}`);

        return {
            success: true,
            postId: postId,
            title: blogData.title,
            topic: topic.topic
        };
    } catch (error) {
        console.error('블로그 포스트 생성 및 저장 오류:', error.message);
        throw error;
    }
}

module.exports = {
    generateBlogPost,
    createBlogPostFromTopic,
    extractKeywords,
    insertImagesIntoContent
};

