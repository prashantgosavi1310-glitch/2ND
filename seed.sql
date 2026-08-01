-- =====================================================================
-- MessMate — Dev seed data (OPTIONAL)
-- Run manually against a local/dev database only. Never run against
-- production. Passwords below are bcrypt hashes of "Password123".
-- =====================================================================

-- Sample verified user
INSERT INTO users (
  full_name, college_name, roll_number, mobile, email,
  password_hash, email_verified
) VALUES (
  'Asha Patil', 'MET Institute of Engineering', 'MET2023CS041',
  '9876543210', 'asha.patil@example.com',
  '$2b$12$Cw0m8s1E4G9V1kQe0m5wgeQhXehXqf2m1B6b2M2c7Vb1KZk3wq6Xu', -- Password123
  TRUE
) ON CONFLICT (email) DO NOTHING;

-- Sample verified mess owner + listing
INSERT INTO messes (
  owner_name, mobile, email, password_hash,
  mess_name, address, city, pincode, veg_type, meals,
  monthly_fees, daily_food_price, security_deposit,
  capacity, available_seats, email_verified
) VALUES (
  'Suresh Sharma', '9123456780', 'suresh.sharma@example.com',
  '$2b$12$Cw0m8s1E4G9V1kQe0m5wgeQhXehXqf2m1B6b2M2c7Vb1KZk3wq6Xu', -- Password123
  'Sharma Tiffin Service', '12 MG Road, Nashik', 'Nashik', '422001',
  'both', ARRAY['breakfast','lunch','dinner'],
  3500.00, 130.00, 1000.00,
  40, 12, TRUE
) ON CONFLICT (email) DO NOTHING;
