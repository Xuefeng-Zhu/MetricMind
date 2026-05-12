-- Migration: Create alerts and alert_notifications tables
-- Requirements: 23.1 (alert configuration with metric, condition, notification preference)

-- Alert condition type enum
CREATE TYPE alert_condition_type AS ENUM ('threshold_above', 'threshold_below', 'anomaly');

-- Alert notification type enum
CREATE TYPE alert_notification_type AS ENUM ('in_app');

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  condition_type alert_condition_type NOT NULL,
  threshold_value FLOAT,
  notification_type alert_notification_type NOT NULL DEFAULT 'in_app',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for alert management
CREATE INDEX idx_alerts_workspace_id ON alerts(workspace_id);
CREATE INDEX idx_alerts_metric_id ON alerts(metric_id);
CREATE INDEX idx_alerts_enabled ON alerts(workspace_id, enabled) WHERE enabled = true;

COMMENT ON TABLE alerts IS 'Alert configurations for metric threshold and anomaly monitoring';
COMMENT ON COLUMN alerts.condition_type IS 'Type of alert condition: threshold_above, threshold_below, or anomaly';
COMMENT ON COLUMN alerts.threshold_value IS 'Threshold value for threshold-based alerts (nullable for anomaly type)';

CREATE TABLE alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_value FLOAT NOT NULL,
  threshold FLOAT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for notification queries
CREATE INDEX idx_alert_notifications_alert_id ON alert_notifications(alert_id);
CREATE INDEX idx_alert_notifications_workspace_id ON alert_notifications(workspace_id);
CREATE INDEX idx_alert_notifications_unread ON alert_notifications(workspace_id, read) WHERE read = false;
CREATE INDEX idx_alert_notifications_fired_at ON alert_notifications(fired_at DESC);

COMMENT ON TABLE alert_notifications IS 'Fired alert notifications visible to users in-app';
COMMENT ON COLUMN alert_notifications.metric_value IS 'The metric value that triggered the alert';
COMMENT ON COLUMN alert_notifications.threshold IS 'The threshold value that was breached';
