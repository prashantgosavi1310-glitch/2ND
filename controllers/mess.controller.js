// =====================================================================
// Mess controller — POST /api/mess/register
// Writes the mess row, its gallery photos, and its weekly menu inside
// one transaction: if any insert fails, everything rolls back and any
// files multer already wrote to disk are deleted.
// =====================================================================
import { query, getClient } from "../config/database.js";
import { hashPassword } from "../utils/password.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { cleanupUploadedFiles, relativeUploadPath } from "../middleware/upload.js";
import { consumeVerifiedOtp } from "../services/otp.service.js";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MEALS = ["breakfast", "lunch", "dinner"];

function normalizeMeals(rawMeals) {
  if (!rawMeals) return [];
  return Array.isArray(rawMeals) ? rawMeals : [rawMeals];
}

function buildWeeklyMenuRows(body) {
  const rows = [];
  for (const day of DAYS) {
    const values = MEALS.map((meal) => (body[`menu-${day}-${meal}`] || "").trim());
    const [breakfast, lunch, dinner] = values;
    if (breakfast || lunch || dinner) {
      rows.push({ day, breakfast: breakfast || null, lunch: lunch || null, dinner: dinner || null });
    }
  }
  return rows;
}

export async function registerMess(req, res) {
  const files = req.files;
  const body = req.body;

  try {
    const {
      ownerName, mobile, email, password,
      messName, address, city, pincode, mapLink,
      vegType, monthlyFees, dailyFoodPrice, securityDeposit,
      capacity, availableSeats,
    } = body;

    const emailVerified = await consumeVerifiedOtp(email);
    if (!emailVerified) {
      cleanupUploadedFiles(files);
      return errorResponse(res, 401, "Please verify your email before registering.");
    }

    const existing = await query(
      `SELECT id FROM messes WHERE email = $1 OR mobile = $2`,
      [email, mobile]
    );
    if (existing.rows.length > 0) {
      cleanupUploadedFiles(files);
      return errorResponse(res, 409, "That email or mobile number is already registered.");
    }

    const passwordHash = await hashPassword(password);
    const meals = normalizeMeals(body.meals);
    const menuRows = buildWeeklyMenuRows(body);

    const ownerPhotoPath = files?.ownerPhoto?.[0] ? relativeUploadPath(files.ownerPhoto[0]) : null;
    const kitchenPhotoPath = files?.kitchenPhoto?.[0] ? relativeUploadPath(files.kitchenPhoto[0]) : null;
    const diningPhotoPath = files?.diningPhoto?.[0] ? relativeUploadPath(files.diningPhoto[0]) : null;
    const messPhotoFiles = files?.messPhotos || [];

    const client = await getClient();
    try {
      await client.query("BEGIN");

      const messResult = await client.query(
        `INSERT INTO messes (
           owner_name, mobile, email, password_hash, owner_photo_path,
           mess_name, address, city, pincode, map_link, veg_type, meals,
           monthly_fees, daily_food_price, security_deposit,
           capacity, available_seats, kitchen_photo_path, dining_photo_path,
           email_verified
         ) VALUES (
           $1,$2,$3,$4,$5,
           $6,$7,$8,$9,$10,$11,$12,
           $13,$14,$15,
           $16,$17,$18,$19,
           TRUE
         )
         RETURNING id, owner_name, mess_name, email, mobile, city, created_at`,
        [
          ownerName, mobile, email, passwordHash, ownerPhotoPath,
          messName, address, city, pincode, mapLink || null, vegType || "veg", meals,
          monthlyFees, dailyFoodPrice || null, securityDeposit || null,
          capacity, availableSeats, kitchenPhotoPath, diningPhotoPath,
        ]
      );
      const mess = messResult.rows[0];

      for (const file of messPhotoFiles) {
        await client.query(
          `INSERT INTO mess_photos (mess_id, photo_path) VALUES ($1, $2)`,
          [mess.id, relativeUploadPath(file)]
        );
      }

      for (const row of menuRows) {
        await client.query(
          `INSERT INTO weekly_menu (mess_id, day_of_week, breakfast, lunch, dinner)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (mess_id, day_of_week)
           DO UPDATE SET breakfast = EXCLUDED.breakfast, lunch = EXCLUDED.lunch, dinner = EXCLUDED.dinner`,
          [mess.id, row.day, row.breakfast, row.lunch, row.dinner]
        );
      }

      await client.query("COMMIT");
      return successResponse(res, 201, "Registration successful.", { mess });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    cleanupUploadedFiles(files);
    if (err.code === "23505") {
      return errorResponse(res, 409, "That email or mobile number is already registered.");
    }
    console.error("[mess.registerMess]", err.message);
    return errorResponse(res, 500, "Something went wrong on our end. Please try again shortly.");
  }
}
