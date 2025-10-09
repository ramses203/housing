-- 블로그 포스트 테이블에 조회수 컬럼 추가
-- 실행일: 2025-10-09
-- 목적: 블로그 포스트 조회수 추적 기능

-- 1. views 컬럼이 존재하는지 확인하고 없으면 추가
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'blog_posts' 
        AND column_name = 'views'
    ) THEN
        ALTER TABLE blog_posts 
        ADD COLUMN views INTEGER DEFAULT 0;
        
        RAISE NOTICE 'views 컬럼이 추가되었습니다.';
    ELSE
        RAISE NOTICE 'views 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- 2. 기존 포스트의 조회수를 0으로 초기화
UPDATE blog_posts 
SET views = 0 
WHERE views IS NULL;

