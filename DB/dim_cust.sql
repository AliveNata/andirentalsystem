/*
  # Create customer dimension table

  1. New Tables
    - `dim_cust`
      - `id` (uuid, primary key)
      - `booking_code` (text, unique)
      - `email` (text)
      - `rental_duration` (text)
      - `car_type` (text)
      - `needs_driver` (boolean)
      - `needs_delivery` (boolean)
      - `start_date` (date)
      - `start_time` (time)
      - `end_date` (date)
      - `purpose` (text)
      - `identity_type` (text)
      - `name` (text)
      - `whatsapp` (text)
      - `address` (text)
      - `company_address` (text, nullable)
      - `documents` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `dim_cust` table
    - Add policies for authenticated users to read and insert data
*/

CREATE TABLE dim_cust (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code text UNIQUE NOT NULL,
  email text NOT NULL,
  rental_duration text NOT NULL,
  car_type text NOT NULL,
  needs_driver boolean NOT NULL DEFAULT false,
  needs_delivery boolean NOT NULL DEFAULT false,
  start_date date NOT NULL,
  start_time time NOT NULL,
  end_date date NOT NULL,
  purpose text NOT NULL,
  identity_type text NOT NULL,
  name text NOT NULL,
  whatsapp text NOT NULL,
  address text NOT NULL,
  company_address text,
  documents jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE dim_cust ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read dim_cust"
  ON dim_cust
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert into dim_cust"
  ON dim_cust
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dim_cust_updated_at
  BEFORE UPDATE ON dim_cust
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();