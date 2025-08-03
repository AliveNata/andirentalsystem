/*
  # Add delete reason tracking

  1. Changes
    - Add deleted and delete_reason columns to dim_cust table
    - Update history log trigger to handle deletions
*/

-- Add deletion tracking columns
ALTER TABLE dim_cust 
ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS delete_reason text DEFAULT NULL;

-- Update trigger function to handle soft deletes
CREATE OR REPLACE FUNCTION log_customer_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO history_log (customer_id, action, changes)
  VALUES (
    CASE 
      WHEN TG_OP = 'UPDATE' AND NEW.deleted = true THEN OLD.id
      ELSE NEW.id
    END,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'CREATE'
      WHEN TG_OP = 'UPDATE' AND NEW.deleted = true THEN 'DELETE'
      WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
      ELSE TG_OP
    END,
    jsonb_build_object(
      'before', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
      'after', row_to_json(NEW)::jsonb,
      'reason', CASE WHEN TG_OP = 'UPDATE' AND NEW.deleted = true THEN NEW.delete_reason ELSE NULL END
    )
  );
  RETURN NEW;
END;
$$ language 'plpgsql';