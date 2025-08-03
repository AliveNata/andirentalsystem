/*
  # Update RLS policies for dim_cust table

  1. Changes
    - Drop existing RLS policies
    - Create new public access policies for both SELECT and INSERT operations
    - Ensure trigger for updated_at exists
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read dim_cust" ON dim_cust;
DROP POLICY IF EXISTS "Allow authenticated users to insert into dim_cust" ON dim_cust;
DROP POLICY IF EXISTS "Allow public read access" ON dim_cust;
DROP POLICY IF EXISTS "Allow public insert access" ON dim_cust;

-- Create new policies for public access
CREATE POLICY "Allow public read access"
  ON dim_cust
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access"
  ON dim_cust
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS update_dim_cust_updated_at ON dim_cust;

CREATE TRIGGER update_dim_cust_updated_at
  BEFORE UPDATE ON dim_cust
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();