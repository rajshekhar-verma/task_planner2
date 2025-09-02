/*
  # Fix invoice foreign key constraint

  1. Changes
    - Drop the existing foreign key constraint on invoices.created_by that references profiles table
    - Add new foreign key constraint that references users table instead
    - This aligns the database schema with the application's user management logic

  2. Security
    - Maintains referential integrity by ensuring created_by references valid users
    - No changes to RLS policies needed
*/

-- Drop the existing foreign key constraint that references profiles
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;

-- Add new foreign key constraint that references users table
ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;