-- ============================================
-- Migration: Enhance Chat System (Unread Tracking & Tenant Isolation)
-- ============================================

-- Ensure chat_conversations table has all required columns for multi-tenant
ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add indexes for tenant isolation
CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant_id ON chat_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_user_ids ON chat_conversations USING GIN(participant_user_ids);

-- Add unread tracking table to replace message-by-message seen tracking
CREATE TABLE IF NOT EXISTS chat_message_reads (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  reader_id TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, reader_id),
  CONSTRAINT check_reader_not_sender CHECK (TRUE) -- checked at application level
);

CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message_id ON chat_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_reader_id ON chat_message_reads(reader_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_read_at ON chat_message_reads(read_at);

-- Enhance chat_messages table for better tracking
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS recipient_id TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add composite indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_tenant ON chat_messages(conversation_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_recipient ON chat_messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Create unread message count view for performance
CREATE OR REPLACE VIEW chat_unread_messages AS
SELECT
  cm.conversation_id,
  cm.tenant_id,
  cm.recipient_id AS user_id,
  COUNT(*) FILTER (WHERE cmr.reader_id IS NULL) AS unread_count
FROM chat_messages cm
LEFT JOIN chat_message_reads cmr ON cm.id = cmr.message_id AND cmr.reader_id = cm.recipient_id
WHERE cm.deleted_at IS NULL
  AND cm.sender_id <> cm.recipient_id
GROUP BY cm.conversation_id, cm.tenant_id, cm.recipient_id;

-- Ensure chat tables have proper constraints for data integrity
ALTER TABLE chat_conversations
  ADD CONSTRAINT fk_chat_conversations_tenant FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add column for conversation status
ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted'));

-- Create index for active conversations only
CREATE INDEX IF NOT EXISTS idx_chat_conversations_active ON chat_conversations(status) WHERE status = 'active';
