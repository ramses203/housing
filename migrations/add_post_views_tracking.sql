-- 블로그 포스트 조회 기록 테이블 생성
-- 실행일: 2025-10-09
-- 목적: IP 기반 중복 조회 방지

-- 조회 기록 테이블 생성
CREATE TABLE IF NOT EXISTS post_views (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, ip_address)
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_ip ON post_views(ip_address);
CREATE INDEX IF NOT EXISTS idx_post_views_viewed_at ON post_views(viewed_at);

