-- 블로그 포스트 테이블에 topic_id 컬럼 추가
-- 실행일: 2025-10-09
-- 목적: AI 에이전트 블로그 자동 생성 기능 지원

-- 1. topic_id 컬럼이 존재하는지 확인하고 없으면 추가
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
    ELSE
        RAISE NOTICE 'topic_id 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- 2. 필요시 외래키 제약조건 추가 (선택사항)
-- ALTER TABLE blog_posts 
-- ADD CONSTRAINT fk_blog_posts_topic 
-- FOREIGN KEY (topic_id) 
-- REFERENCES blog_topics(id) 
-- ON DELETE SET NULL;

