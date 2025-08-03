import express from 'express';
import multer from 'multer';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.put('/:id', upload.single('image'), async (req, res) => {
  const carId = req.params.id;
  const {
    name, brand, type, seats, daily_rate, monthly_rate, deposit,
    quantity, transmission, fuel, colors, plates, updated_by, updated_time
  } = req.body;
  const image = req.file;

  console.log("➡️ Update Mobil ID:", carId);
  console.log("Form fields:", req.body);
  console.log("Uploaded file:", image);

  // Simulasi respons sukses
  return res.json({
    message: `Mobil dengan ID ${carId} berhasil diperbarui.`,
    data: {
      name, brand, type, seats, daily_rate, monthly_rate, deposit,
      quantity, transmission, fuel, colors, plates, updated_by, updated_time,
      image: image?.filename || "lama"
    }
  });
});

export default router;
