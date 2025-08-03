/*
  # Add payment proof and history tracking

  1. Changes
    - Add payment_proof column to dim_cust table
    - Create history_log table for tracking changes
    - Add policies for the new table
*/

-- Add payment_proof column to dim_cust
ALTER TABLE dim_cust 
ADD COLUMN IF NOT EXISTS payment_proof jsonb DEFAULT NULL;

-- Create history log table
CREATE TABLE IF NOT EXISTS history_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES dim_cust(id),
  action text NOT NULL,
  changes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

-- Enable RLS on history_log
ALTER TABLE history_log ENABLE ROW LEVEL SECURITY;

-- Create policies for history_log
CREATE POLICY "Allow public read access on history_log"
  ON history_log
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access on history_log"
  ON history_log
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create trigger to log changes
CREATE OR REPLACE FUNCTION log_customer_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO history_log (customer_id, action, changes)
  VALUES (
    NEW.id,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'CREATE'
      WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
      ELSE TG_OP
    END,
    jsonb_build_object(
      'before', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
      'after', row_to_json(NEW)::jsonb
    )
  );
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for dim_cust
DROP TRIGGER IF EXISTS log_customer_changes_trigger ON dim_cust;

CREATE TRIGGER log_customer_changes_trigger
  AFTER INSERT OR UPDATE
  ON dim_cust
  FOR EACH ROW
  EXECUTE FUNCTION log_customer_changes();