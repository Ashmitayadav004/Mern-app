CREATE TABLE IF NOT EXISTS media_recycle_bin (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_id VARCHAR(100) NOT NULL,
  source_module VARCHAR(80) NOT NULL,
  source_label VARCHAR(120) NOT NULL,
  parent_type VARCHAR(50) NOT NULL,
  parent_id VARCHAR(100) NOT NULL,
  parent_label VARCHAR(500),
  name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  data TEXT NOT NULL,
  size INTEGER,
  caption TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_by UUID REFERENCES users(id),
  deleted_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_recycle_deleted_at ON media_recycle_bin(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_recycle_parent ON media_recycle_bin(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_media_recycle_source ON media_recycle_bin(source_module);
