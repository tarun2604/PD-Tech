/*
  # Add Notifications Table

  1. New Table
    - `notifications`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `scheduled_at` (timestamp)
      - `created_by` (uuid, references employees)
      - `assigned_to` (uuid, references employees)
      - `is_delivered` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on the table
    - Add policies for head and employee access
*/

-- Create notifications table
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  created_by uuid REFERENCES employees(id),
  assigned_to uuid REFERENCES employees(id),
  is_delivered boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies for notifications table
CREATE POLICY "Employees can view their own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM employees
      WHERE id = auth.uid() AND role IN ('head', 'admin', 'e.head')
    )
  );

CREATE POLICY "Employees can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Employees can update their own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM employees
      WHERE id = auth.uid() AND role IN ('head', 'admin', 'e.head')
    )
  );

CREATE POLICY "Employees can delete their own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM employees
      WHERE id = auth.uid() AND role IN ('head', 'admin', 'e.head')
    )
  ); 