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
 * HTML 콘텐츠를 정리 (불필요한 태그 및 속성 제거)
 * @param {string} content - HTML 콘텐츠
 * @returns {string} 정리된 HTML 콘텐츠
 */
function sanitizeHtmlContent(content) {
    if (!content) return '';
    
    let cleaned = content;
    
    // style 속성 제거
    cleaned = cleaned.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');
    
    // class 속성 제거
    cleaned = cleaned.replace(/\s*class\s*=\s*["'][^"']*["']/gi, '');
    
    // id 속성 제거
    cleaned = cleaned.replace(/\s*id\s*=\s*["'][^"']*["']/gi, '');
    
    // div 태그를 p 태그로 변환
    cleaned = cleaned.replace(/<div[^>]*>/gi, '<p>');
    cleaned = cleaned.replace(/<\/div>/gi, '</p>');
    
    // span 태그 제거 (내용은 유지)
    cleaned = cleaned.replace(/<span[^>]*>/gi, '');
    cleaned = cleaned.replace(/<\/span>/gi, '');
    
    // 연속된 공백 정리
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // 빈 태그 제거
    cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
    cleaned = cleaned.replace(/<strong>\s*<\/strong>/gi, '');
    cleaned = cleaned.replace(/<em>\s*<\/em>/gi, '');
    
    // 연속된 줄바꿈 정리
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return cleaned.trim();
}

/**
 * Gemini AI로 문단별 적절한 이미지 키워드 추천
 * @param {string} content - HTML 콘텐츠
 * @param {string} topic - 블로그 주제
 * @returns {Promise<Array>} 이미지 키워드 배열 [{position, keyword, description}]
 */
async function suggestImageKeywordsForContent(content, topic) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        // HTML 태그 제거하고 순수 텍스트만 추출
        const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        
        const prompt = `다음은 "${topic}"에 관한 블로그 포스트입니다.

블로그 내용:
${textContent}

이 블로그의 내용을 읽고, 중간중간에 삽입하면 좋을 이미지를 3-4개 추천해주세요.
각 이미지는 특정 문단의 내용과 잘 어울려야 하며, 실제로 검색 가능한 구체적인 키워드를 제공해주세요.

다음 JSON 형식으로만 응답해주세요:
{
  "suggestions": [
    {
      "keyword": "영어 검색 키워드 (예: modern house architecture)",
      "description": "어떤 문단 내용과 어울리는지 간단한 설명",
      "relatedText": "해당 이미지와 관련된 본문의 핵심 문구 (10-20자)"
    }
  ]
}

주의사항:
- keyword는 영어로 작성 (이미지 검색용)
- 각 이미지는 서로 다른 내용을 보완해야 함
- 3-4개만 추천 (너무 많으면 산만함)
- 부동산, 건축, 주거 관련 이미지 위주로`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // JSON 파싱
        const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const data = JSON.parse(jsonText);

        return data.suggestions || [];
    } catch (error) {
        console.error('❌ AI 이미지 추천 오류:', error.message);
        return [];
    }
}

/**
 * HTML 콘텐츠에 문맥에 맞는 이미지를 삽입
 * @param {string} content - HTML 콘텐츠
 * @param {Array} imageSuggestions - AI가 추천한 이미지 정보
 * @param {Array} uploadedImages - 업로드된 이미지 정보 배열
 * @returns {string} 이미지가 삽입된 HTML 콘텐츠
 */
function insertContextualImagesIntoContent(content, imageSuggestions, uploadedImages) {
    if (!uploadedImages || uploadedImages.length === 0) {
        return content;
    }

    let result = content;
    
    // 각 추천 이미지를 해당 문맥에 맞게 삽입
    imageSuggestions.forEach((suggestion, idx) => {
        if (idx >= uploadedImages.length) return;
        
        const img = uploadedImages[idx];
        const imageHtml = `

<figure style="margin: 2rem 0; text-align: center;">
    <img src="${img.url}" alt="${suggestion.description || img.description || '블로그 이미지'}" style="max-width: 100%; height: auto; border-radius: 8px;">
    <figcaption style="margin-top: 0.5rem; font-size: 0.9rem; color: #666;">${suggestion.description || ''}</figcaption>
</figure>

`;

        // 관련 텍스트 찾아서 그 뒤에 이미지 삽입
        if (suggestion.relatedText) {
            // HTML 태그를 고려하여 관련 텍스트 찾기
            const searchText = suggestion.relatedText.trim();
            const searchIndex = result.indexOf(searchText);
            
            if (searchIndex !== -1) {
                // 관련 텍스트 이후 첫 번째 </p> 태그 뒤에 삽입
                const afterText = result.substring(searchIndex);
                const closingPIndex = afterText.indexOf('</p>');
                
                if (closingPIndex !== -1) {
                    const insertPosition = searchIndex + closingPIndex + 4; // </p> 길이만큼 더함
                    result = result.substring(0, insertPosition) + imageHtml + result.substring(insertPosition);
                    return;
                }
            }
        }
        
        // 관련 텍스트를 못 찾았다면 균등하게 배치
        const paragraphs = result.split('</p>');
        const position = Math.floor((paragraphs.length / (imageSuggestions.length + 1)) * (idx + 1));
        
        if (position < paragraphs.length) {
            paragraphs[position] += '</p>' + imageHtml;
            result = paragraphs.join('</p>');
        }
    });

    return result;
}

/**
 * HTML 콘텐츠에 이미지를 삽입 (레거시 함수 - 하위 호환성 유지)
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
        // Gemini 모델 선택 (2025년 10월 기준 안정 버전)
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash'
        });

        // 중복 방지 프롬프트 생성
        const duplicationAvoidance = generateDuplicationAvoidancePrompt(previousTitles);

        // 프롬프트 구성
        const prompt = `당신은 전문 블로그 작가입니다. 다음 주제로 한국어 블로그 포스트를 작성해주세요.

주제: ${topic}

요구사항:
1. 흥미롭고 SEO 최적화된 제목을 생성하세요 (40자 이내)
2. 본문은 2000-3000자 분량으로 작성하세요
3. HTML 형식으로 작성하되, 깔끔하고 단순한 태그만 사용하세요
4. 사용 가능한 HTML 태그: <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>
5. 불필요한 div, span, style 속성, class 등은 절대 사용하지 마세요
6. 독자에게 실용적이고 유익한 정보를 제공하세요
7. 자연스럽고 친근한 어조로 작성하세요
8. 문단을 적절히 나누어 가독성을 높이세요
9. 부동산, 황토집, 건축 관련 전문 지식을 활용하세요
${duplicationAvoidance}

다음 JSON 형식으로만 응답해주세요:
{
  "title": "블로그 제목",
  "content": "HTML 형식의 본문 내용 (p, h2, h3, ul, li, strong, em 태그만 사용)",
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
            
            // HTML 콘텐츠 정리
            if (blogData.content) {
                blogData.content = sanitizeHtmlContent(blogData.content);
            }
        } catch (parseError) {
            console.error('JSON 파싱 오류, 텍스트 그대로 사용:', parseError.message);
            // 파싱 실패시 기본 구조 생성
            blogData = {
                title: topic,
                content: sanitizeHtmlContent(`<p>${text.replace(/\n/g, '</p>\n<p>')}</p>`),
                summary: text.substring(0, 100)
            };
        }

        // 환경 변수 확인
        const hasUnsplashKey = !!process.env.UNSPLASH_ACCESS_KEY;
        const hasPexelsKey = !!process.env.PEXELS_API_KEY;
        const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);
        
        console.log(`🔑 API 키 상태:`, {
            unsplash: hasUnsplashKey ? '✅' : '❌',
            pexels: hasPexelsKey ? '✅' : '❌',
            cloudinary: hasCloudinary ? '✅' : '❌'
        });

        let uploadedImages = [];
        let imageSuggestions = [];

        // API 키가 모두 설정되어 있으면 AI 기반 이미지 추천 사용
        if ((hasUnsplashKey || hasPexelsKey) && hasCloudinary) {
            console.log('🤖 AI가 블로그 내용을 분석하여 적절한 이미지 추천 중...');
            
            // AI가 콘텐츠를 분석하여 이미지 키워드 추천
            imageSuggestions = await suggestImageKeywordsForContent(blogData.content, topic);
            
            if (imageSuggestions.length > 0) {
                console.log(`📸 AI 추천 이미지: ${imageSuggestions.length}개`);
                imageSuggestions.forEach((suggestion, idx) => {
                    console.log(`  ${idx + 1}. "${suggestion.keyword}" - ${suggestion.description}`);
                });

                // 추천된 키워드로 이미지 검색 및 업로드
                for (let i = 0; i < imageSuggestions.length; i++) {
                    const suggestion = imageSuggestions[i];
                    console.log(`  🔍 검색 ${i + 1}/${imageSuggestions.length}: "${suggestion.keyword}"`);
                    
                    try {
                        const images = await searchAndUploadImages(suggestion.keyword, 1);
                        if (images.length > 0) {
                            uploadedImages.push(images[0]);
                            console.log(`  ✅ 이미지 업로드 성공`);
                        } else {
                            console.log(`  ⚠️ 이미지를 찾지 못했습니다.`);
                        }
                    } catch (error) {
                        console.error(`  ❌ 이미지 검색/업로드 실패:`, error.message);
                    }
                }
            } else {
                console.warn('⚠️ AI 이미지 추천 실패, 기본 키워드로 대체합니다.');
                
                // 기본 키워드 추출 방식으로 대체
                const imageKeywords = extractKeywords(topic, keywords);
                console.log(`📸 기본 키워드: ${imageKeywords.join(', ')}`);
                
                for (let i = 0; i < Math.min(imageKeywords.length, 3); i++) {
                    try {
                        const images = await searchAndUploadImages(imageKeywords[i], 1);
                        if (images.length > 0) {
                            uploadedImages.push(images[0]);
                        }
                    } catch (error) {
                        console.error(`  ❌ 이미지 검색 실패:`, error.message);
                    }
                }
            }
        } else {
            if (!hasUnsplashKey && !hasPexelsKey) {
                console.warn('⚠️ 이미지 검색 API 키가 설정되지 않았습니다. 이미지 없이 블로그를 생성합니다.');
            } else if (!hasCloudinary) {
                console.warn('⚠️ Cloudinary 설정이 없습니다. 이미지 없이 블로그를 생성합니다.');
            }
        }

        console.log(`📊 최종 업로드된 이미지 개수: ${uploadedImages.length}`);

        // 콘텐츠에 이미지 삽입
        if (uploadedImages.length > 0) {
            if (imageSuggestions.length > 0) {
                // AI 추천 기반으로 문맥에 맞게 삽입
                console.log('✨ 문맥에 맞는 위치에 이미지 삽입 중...');
                blogData.content = insertContextualImagesIntoContent(blogData.content, imageSuggestions, uploadedImages);
            } else {
                // 기존 방식으로 균등하게 삽입
                console.log('📍 균등하게 이미지 배치 중...');
                blogData.content = insertImagesIntoContent(blogData.content, uploadedImages);
            }
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
    insertImagesIntoContent,
    insertContextualImagesIntoContent,
    suggestImageKeywordsForContent,
    sanitizeHtmlContent
};

