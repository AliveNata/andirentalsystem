/*
  # Create users and cars tables

  1. New Tables
    - `dim_user`
      - `id` (uuid, primary key)
      - `username` (text, unique)
      - `password` (text)
      - `level` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `dim_car`
      - `id` (uuid, primary key) 
      - `name` (text)
      - `brand` (text)
      - `type` (text)
      - `seats` (integer)
      - `transmission` (text)
      - `fuel` (text)
      - `daily_rate` (numeric)
      - `monthly_rate` (numeric)
      - `quantity` (integer)
      - `image` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create dim_user table
CREATE TABLE dim_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  level text NOT NULL CHECK (level IN ('superadmin', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create dim_car table
CREATE TABLE dim_car (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text NOT NULL,
  type text NOT NULL,
  seats integer NOT NULL,
  transmission text NOT NULL,
  fuel text NOT NULL,
  daily_rate numeric NOT NULL,
  monthly_rate numeric NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE dim_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_car ENABLE ROW LEVEL SECURITY;

-- Create policies for dim_user
CREATE POLICY "Superadmin can manage users"
  ON dim_user
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'level' = 'superadmin')
  WITH CHECK (auth.jwt() ->> 'level' = 'superadmin');

CREATE POLICY "Users can read own data"
  ON dim_user
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create policies for dim_car
CREATE POLICY "Admin and superadmin can manage cars"
  ON dim_car
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'level' IN ('admin', 'superadmin'))
  WITH CHECK (auth.jwt() ->> 'level' IN ('admin', 'superadmin'));

CREATE POLICY "Anyone can view cars"
  ON dim_car
  FOR SELECT
  TO public
  USING (true);

-- Insert default superadmin user
INSERT INTO dim_user (username, password, level)
VALUES ('andirental', crypt('admin123', gen_salt('bf')), 'superadmin');

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dim_user_updated_at
  BEFORE UPDATE ON dim_user
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dim_car_updated_at
  BEFORE UPDATE ON dim_car
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();