// index.js
const express = require('express');
const session = require('express-session');
const pool = require('./db');
require('dotenv').config();
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { generateInvoiceEmail } = require('./project/src/components/emailTemplates/invoiceTemplate.cjs');


// const upload = multer({ dest: 'uploads/' })


const app = express();

const deleteFileIfExists = (filename) => {
  if (!filename) return;
  const filePath = path.join(__dirname, 'uploads', filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Deleted file: ${filePath}`);
  }
};

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/preview/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
  }

  res.sendFile(filePath);
});


app.use('/uploads', express.static('uploads'));

app.use(session({
  secret: 'andi_rental_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: 'lax' },
}));

app.get('/', (req, res) => {
  res.send('Andi Rental API is running.');
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM dim_user WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
    req.session.user = { id: user.id, username: user.username, level: user.level };
    res.json({
      success: true,
      id: user.id,
      username: user.username,
      level: user.level
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.get('/api/me', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.status(401).json({ loggedIn: false });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // ⬅️ AMBIL ekstensi dari file asli (.jpg / .pdf)
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext; // ⬅️ GABUNGKAN
    cb(null, uniqueName);
  }
});


const upload = multer({ storage });

// POST /cars
app.post('/api/cars', upload.fields([
  { name: 'image', maxCount: 4 }
]), async (req, res) => {
  try {
    const {
      name, brand, type, transmission, fuel,
      seats, daily_rate, monthly_rate, deposit, quantity, user_id
    } = req.body;

    // Parse manual jika datang dalam bentuk string
    // const colors = JSON.parse(req.body.colors || '[]');
    // const plates = JSON.parse(req.body.plates || '[]');

    // ✅ Parse dan validasi colors & plates
    const colors = JSON.parse(req.body.colors || '[]');
    const plates = JSON.parse(req.body.plates || '[]');

    if (!Array.isArray(colors)) {
      throw new Error('colors harus array!');
    }
    if (!Array.isArray(plates)) {
      throw new Error('plates harus array!');
    }

    if (!user_id) {
      return res.status(400).json({ message: 'user_id wajib dikirim' });
    }

    const imageFiles = req.files?.image?.map(file => file.filename) || [];

    // ✅ Logging seperti di PUT
    console.log('BODY:', req.body);
    console.log('FILES:', req.files);
    console.log('colors:', colors);
    console.log('plates:', plates);
    console.log('user_id:', user_id);

    const result = await pool.query(`
      INSERT INTO dim_car (
        name, brand, type, transmission, fuel,
        seats, daily_rate, monthly_rate, deposit, quantity, image, colors, plates, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      name, brand, type, transmission, fuel,
      Number(seats), Number(daily_rate), Number(monthly_rate),
      Number(deposit), Number(quantity),
      JSON.stringify(imageFiles),
      JSON.stringify(colors || []),
      JSON.stringify(plates || []),
      req.body.created_by
    ]);
    
    const insertedCar = result.rows[0];

    if (!user_id) {
      return res.status(400).json({ error: 'User ID wajib diisi.' });
    }
    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      insertedCar.id,
      'car',
      'CREATE',
      JSON.stringify({ after: insertedCar, before: null }),
      req.body.user_id,
      'Manajemen Mobil'
    ]);

    res.status(201).json(insertedCar);

  } catch (err) {
    console.error('ERROR POST /api/cars:', err);
    res.status(500).json({ success: false });
  }
});

// PUT /cars/:id
// app.put('/api/cars/:id', async (req, res) => {
app.put('/api/cars/:id', upload.array('image'), async (req, res) => {
  try {
    const id = req.params.id;

    // ✅ Parse dan validasi colors & plates
    const colors = JSON.parse(req.body.colors || '[]');
    const plates = JSON.parse(req.body.plates || '[]');
    
    if (!Array.isArray(colors)) {
      throw new Error('colors harus array!');
    }
    if (!Array.isArray(plates)) {
      throw new Error('plates harus array!');
    }

    // ✅ Logging untuk debug
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);
    console.log("colors:", colors);
    console.log("plates:", plates);

    // ✅ Ambil data lama sebelum update
    const beforeResult = await pool.query('SELECT * FROM dim_car WHERE id = $1', [id]);
    const before = beforeResult.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Data mobil tidak ditemukan.' });
    }

    // ✅ Simpan gambar
    const imageFiles = req.files?.map(file => file.filename) || [];
    const image = imageFiles.length > 0 ? JSON.stringify(imageFiles) : before.image;

    // ✅ Update ke database
    await pool.query(`
      UPDATE dim_car SET
        name = $1,
        brand = $2,
        type = $3,
        transmission = $4,
        fuel = $5,
        seats = $6,
        daily_rate = $7,
        monthly_rate = $8,
        deposit = $9,
        quantity = $10,
        image = $11,
        colors = $12,
        plates = $13,
        updated_at = NOW(),
        updated_by = $14
      WHERE id = $15
    `, [
      req.body.name,
      req.body.brand,
      req.body.type,
      req.body.transmission,
      req.body.fuel,
      Number(req.body.seats),
      Number(req.body.daily_rate),
      Number(req.body.monthly_rate),
      Number(req.body.deposit),
      Number(req.body.quantity),
      image,
      JSON.stringify(colors),
      JSON.stringify(plates),
      req.body.updated_by,
      id
    ]);
    

    // 3. Simpan log aktivitas
    const user_id = req.body.user_id || req.headers['x-user-id'] || req.body.updated_by;
    const after = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID wajib diisi.' });
    }

    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'car',
      'UPDATE',
      JSON.stringify({ before, after }),
      user_id,
      'Manajemen Mobil'
    ]);

    res.status(200).json({ message: 'Data mobil berhasil diperbarui.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal memperbarui data mobil.' });
  }
});


// DELETE /cars/:id
app.delete('/cars/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id, username } = req.body;

  console.log("DELETE user_id:", user_id);
  console.log("DELETE username:", username);

  try {
    const result = await pool.query('SELECT * FROM dim_car WHERE id = $1', [id]);
    const before = result.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Mobil tidak ditemukan.' });
    }

    await pool.query('DELETE FROM dim_car WHERE id = $1', [id]);

    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'car',
      'DELETE',
      JSON.stringify({
        before,
        reason: `Dihapus oleh ${username || 'unknown'}`
      }),
      user_id, 
      'Manajemen Mobil'
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('ERROR DELETE /cars/:id', err);
    res.status(500).json({ success: false });
  }
});

// GET /cars
app.get('/cars', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dim_car ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// GET /cars/:id
app.get('/cars/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM dim_car WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Mobil tidak ditemukan.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR GET /cars/:id:', err);
    res.status(500).json({ message: 'Gagal mengambil data mobil.' });
  }
});

// POST /api/customer
app.post('/api/customer', upload.fields([
  { name: 'ktpFile', maxCount: 1 },
  { name: 'simFile', maxCount: 1 },
  { name: 'kkFile', maxCount: 1 },
  { name: 'workOrStudentIdFile', maxCount: 1 },
  { name: 'parentKtpFile', maxCount: 1 },
  { name: 'spouseKtpFile', maxCount: 1 },
  { name: 'personalIdFile', maxCount: 1 },
  { name: 'marriageDocFile', maxCount: 1 },
  { name: 'picKtpFile', maxCount: 1 },
  { name: 'picKkFile', maxCount: 1 },
  { name: 'companyNpwpFile', maxCount: 1 },
  { name: 'companySiupFile', maxCount: 1 },
  { name: 'companyNibFile', maxCount: 1 },
  { name: 'companyPhotoFile', maxCount: 1 },
  { name: 'passportFile', maxCount: 1 },
  { name: 'kitasKitapFile', maxCount: 1 },
  { name: 'visaFile', maxCount: 1 },
  { name: 'ticketFile', maxCount: 1 },
  { name: 'ticketHotelFile', maxCount: 1 },
  { name: 'housePhotoFile', maxCount: 1 },
  { name: 'workIdFile', maxCount: 1 },
  { name: 'verificationVideoFile', maxCount: 1 },
  { name: 'optionalRequirementFile', maxCount: 1 },
]), async (req, res) => {
  try {
    const {
      booking_code,
      email,
      rental_duration,
      car_type,
      needs_driver,
      needs_delivery,
      needs_pickup,
      driver_fee,
      delivery_fee,
      pickup_fee,
      deposit,
      discount,
      grand_total,
      start_date,
      start_time,
      end_date,
      purpose,
      identity_type,
      name,
      whatsapp,
      address,
      company_address,
      range_rent,
      username
    } = req.body;

       // 👇 DI SINI tempat kode dokumen!
       const documents = {};
       for (const key in req.files) {
         if (req.files[key][0]) {
           documents[key] = req.files[key][0].filename;
         }
       }
       
       console.log('=== DATA YANG DITERIMA ===');
       console.log('Body:', req.body);
       console.log('Files:', req.files);
       console.log('Documents:', documents);
       console.log('===========================');

       const result = await pool.query(`
        INSERT INTO dim_cust (
          email, identity_type, name,
          whatsapp, address, company_address,
          documents, created_at, created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9
        ) RETURNING *
      `, [
        // booking_code,
        email,
        // rental_duration,
        // car_type,
        // needs_driver === 'true',
        // needs_delivery === 'true',
        // start_date,
        // start_time,
        // end_date,
        // purpose,
        identity_type,
        name,
        whatsapp,
        address,
        company_address,
        // Number(range_rent),
        JSON.stringify(documents || {}),
        new Date(),
        username || 'system'
      ]);

      const insertedCustomer = result.rows[0];

      // const parsedRangeRent = isNaN(Number(range_rent)) ? 0 : Number(range_rent);
      // const parsedGrandTotal = isNaN(Number(grand_total)) ? 0 : Number(grand_total);
      // const parsedStartTime = start_time && start_time.trim() !== '' ? start_time : null;
      // const parsedDeposit = isNaN(Number(deposit)) ? 0 : Number(deposit);
      // const parsedDiscount = isNaN(Number(discount)) ? 0 : Number(discount);
      // const parsedTripFee = isNaN(Number(trip_fee)) ? 0 : Number(trip_fee);
      // const parsedDriverFee = isNaN(Number(driver_fee)) ? 0 : Number(driver_fee);
      // const parsedDeliveryFee = isNaN(Number(delivery_fee)) ? 0 : Number(delivery_fee);
      // const parsedPickupFee = isNaN(Number(pickup_fee)) ? 0 : Number(pickup_fee);

      // console.log({
      //   range_rent,
      //   parsedRangeRent,
      //   grand_total,
      //   parsedGrandTotal
      // });

      // Inserted to fact_transaction
      // await pool.query(`
      //   INSERT INTO fact_transaction (
      //     booking_code, email, rental_duration, range_rent, car_type, needs_trip, needs_driver,
      //     needs_delivery, needs_pickup, start_date, start_time, end_date, grand_total,
      //     deposit, discount, trip_fee, driver_fee, delivery_fee, pickup_fee, purpose,
      //     identity_type, name, whatsapp, address, company_address,
      //     created_at, created_by
      //   ) VALUES (
      //     $1, $2, $3, $4, $5, $6, $7
      //     $8, $9, $10, $11, $12, $13
      //     $13, $14, $15, $16, $17, $18, $19, $20,
      //     $20, $21, $22, $23, $24, $25,
      //     $26, $27
      //   )
      // `, [
      //   booking_code,
      //   email,
      //   rental_duration,
      //   parsedRangeRent,
      //   car_type,
      //   needs_trip === 'true',
      //   needs_driver === 'true',
      //   needs_delivery === 'true',
      //   needs_pickup === 'true',
      //   start_date,
      //   parsedStartTime,
      //   end_date,
      //   parsedGrandTotal,
      //   parsedDeposit,
      //   parsedDiscount,
      //   parsedTripFee,
      //   parsedDriverFee,
      //   parsedDeliveryFee,
      //   parsedPickupFee,
      //   purpose,
      //   identity_type,
      //   name,
      //   whatsapp,
      //   address,
      //   company_address,
      //   new Date(),
      //   username || 'system'
      // ]);
      
      // ambil user_id dari frontend (misal lewat header / body)
      const user_id = req.body.user_id || req.headers['x-user-id'];

      if (!user_id) {
        return res.status(400).json({ error: 'User ID wajib diisi.' });
      }
  
      await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5::uuid, $6)
    `, [
      insertedCustomer.id,
      'customer',
      'CREATE',
      JSON.stringify({ after: insertedCustomer, before: null, created_by: username }),
      user_id,
      'Form Booking'
    ]);

    res.status(201).json(insertedCustomer);
      
  } catch (err) {
    console.error('ERROR POST /api/customer:', err);
    res.status(500).json({ message: 'Gagal menyimpan data.', error: err.message });
  }
});



// GET /api/car-types
app.get('/api/car-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT brand, name FROM dim_car ORDER BY brand, name');
    console.log('Brand + name + result:', result.rows);

    const carTypes = result.rows.map(row => ({
      label: `${row.brand} ${row.name}`,
      value: `${row.brand} ${row.name}`,
    }));
    res.json(carTypes);
  } catch (err) {
    console.error('ERROR GET /api/car-types:', err);
    res.status(500).json({ success: false });
  }
});

// GET /api/car-rates
app.get('/api/car-rates', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT brand, name, daily_rate, monthly_rate FROM dim_car ORDER BY brand, name');
    console.log('Brand + name + daily & monthly rate result:', result.rows);

    const carRates = result.rows.map(row => ({
      label: `${row.brand} ${row.name}`,
      value: `${row.brand} ${row.name}`,
      daily_rate: row.daily_rate,
      monthly_rate: row.monthly_rate,
    }));
    res.json(carRates);
  } catch (err) {
    console.error('ERROR GET /api/car-types:', err);
    res.status(500).json({ success: false });
  }
});

// GET /api/customer
app.get('/api/customer', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM dim_cust WHERE deleted = false ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ message: 'Gagal mengambil data customer.' });
  }
});

app.put('/api/customer/:id', upload.fields([
  { name: 'ktpFile', maxCount: 1 },
  { name: 'simFile', maxCount: 1 },
  { name: 'kkFile', maxCount: 1 },
  { name: 'workOrStudentIdFile', maxCount: 1 },
  { name: 'parentKtpFile', maxCount: 1 },
  { name: 'spouseKtpFile', maxCount: 1 },
  { name: 'personalIdFile', maxCount: 1 },
  { name: 'marriageDocFile', maxCount: 1 },
  { name: 'picKtpFile', maxCount: 1 },
  { name: 'picKkFile', maxCount: 1 },
  { name: 'companyNpwpFile', maxCount: 1 },
  { name: 'companySiupFile', maxCount: 1 },
  { name: 'companyNibFile', maxCount: 1 },
  { name: 'companyPhotoFile', maxCount: 1 },
  { name: 'passportFile', maxCount: 1 },
  { name: 'kitasKitapFile', maxCount: 1 },
  { name: 'visaFile', maxCount: 1 },
  { name: 'ticketFile', maxCount: 1 },
  { name: 'ticketHotelFile', maxCount: 1 },
  { name: 'housePhotoFile', maxCount: 1 },
  { name: 'workIdFile', maxCount: 1 },
  { name: 'verificationVideoFile', maxCount: 1 },
  { name: 'optionalRequirementFile', maxCount: 1 },
]), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, email, whatsapp, address, identity_type,
      company_address, username, user_id
    } = req.body;

    const documents = {};
    for (const key in req.files) {
      if (req.files[key][0]) {
        documents[key] = req.files[key][0].filename;
      }
    }

    // Ambil data sebelum update untuk log
    const beforeResult = await pool.query('SELECT * FROM dim_cust WHERE id = $1', [id]);
    const before = beforeResult.rows[0];

    if (!before) return res.status(404).json({ message: 'Customer tidak ditemukan.' });

    // Gabungkan dokumen lama & baru
    const updatedDocuments = { ...before.documents, ...documents };

    await pool.query(`
      UPDATE dim_cust SET
        name = $1,
        email = $2,
        whatsapp = $3,
        address = $4,
        identity_type = $5,
        company_address = $6,
        documents = $7,
        updated_by = $8,
        updated_at = NOW()
      WHERE id = $9
    `, [
      name,
      email,
      whatsapp,
      address,
      identity_type,
      company_address,
      JSON.stringify(updatedDocuments),
      username || 'system',
      id
    ]);

    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'customer',
      'UPDATE',
      JSON.stringify({ before, after: { name, email, whatsapp, address, identity_type, company_address, documents: updatedDocuments }, updated_by: username }),
      user_id || 'system',
      'Customer Database'
    ]);

    res.json({ message: 'Data customer berhasil diperbarui.' });
  } catch (err) {
    console.error('ERROR PUT /api/customer/:id', err);
    res.status(500).json({ message: 'Gagal mengupdate customer.' });
  }
});


// GET /api/customer/:id
app.get('/api/customer/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM dim_cust WHERE id = $1 AND deleted = false',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer tidak ditemukan.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching customer by ID:', err);
    res.status(500).json({ message: 'Gagal mengambil data customer.' });
  }
});

// GET /api/customer/history/:id
app.get('/api/customer/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(`
      SELECT * FROM history_log_v1
      WHERE log_id = $1 AND entity = 'customer'
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    // Hitung total histori untuk pagination
    const totalResult = await pool.query(`
      SELECT COUNT(*) FROM history_log_v1
      WHERE log_id = $1 AND entity = 'customer'
    `, [id]);

    const total = parseInt(totalResult.rows[0].count);

    res.json({
      history: result.rows,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (err) {
    console.error('Error fetching customer history:', err);
    res.status(500).json({ message: 'Gagal ambil log histori.' });
  }
});


// PUT /api/customer/delete/:id
app.put('/api/customer/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, user_id, username } = req.body;

    const beforeResult = await pool.query('SELECT * FROM dim_cust WHERE id = $1', [id]);
    const before = beforeResult.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Customer tidak ditemukan.' });
    }

    await pool.query(`
      UPDATE dim_cust 
      SET deleted = true, delete_reason = $1, updated_at = NOW(), updated_by = $2
      WHERE id = $3
    `, [reason, username, id]);

    await pool.query(`
      INSERT INTO history_log_v1 (log_id, entity, action, changes, user_id, page)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'customer',
      'DELETE',
      JSON.stringify({
  before: {
    name: before.name,
    email: before.email,
    whatsapp: before.whatsapp,
    address: before.address,
    identity_type: before.identity_type,
  },
  after: {
    reason: reason
  },
  deleted_by: `Dihapus oleh ${username}`
}),
      user_id || 'system', 
      'Customer Database'
    ]);

    res.json({ message: 'Data customer berhasil dihapus (soft delete).' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ message: 'Gagal menghapus data customer.' });
  }
}); 

// PUT /api/customer/upload-payment/:id
app.put('/api/customer/upload-payment/:id', upload.fields([
  { name: 'deposit', maxCount: 1 },
  { name: 'dp', maxCount: 1 },
  { name: 'full', maxCount: 1 }
]), async (req, res) => {
  console.log('>>> MASUK /api/customer/upload-payment/', req.params.id);
  try {
    const { id } = req.params;
    const { user_id, username, isLunas } = req.body;

    const depositFile = req.files?.deposit?.[0];
    const dpFile = req.files?.dp?.[0];
    const fullFile = req.files?.full?.[0];


    const lunas = isLunas === 'true';

    // ✅ Ambil data before dari fact_transaction
    const beforeResult = await pool.query('SELECT * FROM fact_transaction WHERE booking_code = (SELECT booking_code FROM dim_cust WHERE id = $1)', [id]);
    const before = beforeResult.rows[0];

    if (!before) {
  return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
}

  if (req.body.deleteDeposit === 'true') {
  deleteFileIfExists(before?.deposit_payment?.filename);
}
if (req.body.deleteDp === 'true') {
  deleteFileIfExists(before?.down_payment?.filename);
}
if (req.body.deleteFull === 'true') {
  deleteFileIfExists(before?.full_payment?.filename);
}

// Jika upload file baru, hapus file lama sebelumnya
if (depositFile) {
  deleteFileIfExists(before?.deposit_payment?.filename);
}
if (dpFile) {
  deleteFileIfExists(before?.down_payment?.filename);
}
if (fullFile) {
  deleteFileIfExists(before?.full_payment?.filename);
}

const depositData =
  req.body.deleteDeposit === 'true' ? null :
  depositFile ? {
    filename: depositFile.filename,
    mimetype: depositFile.mimetype,
  } : before?.deposit_payment;

const dpData =
  req.body.deleteDp === 'true' ? null :
  dpFile ? {
    filename: dpFile.filename,
    mimetype: dpFile.mimetype,
  } : before?.down_payment;

const fullData =
  req.body.deleteFull === 'true' ? null :
  fullFile ? {
    filename: fullFile.filename,
    mimetype: fullFile.mimetype,
  } : before?.full_payment;

    // ✅ Update data ke fact_transaction
    const result = await pool.query(`
      UPDATE fact_transaction
      SET deposit_payment = $1,
          down_payment = $2,
          full_payment = $3,
          lunas = $4,
          updated_by = $5,
          updated_at = NOW()
      WHERE booking_code = (SELECT booking_code FROM dim_cust WHERE id = $6)
      RETURNING *
    `, [
      depositData,
      dpData,
      fullData,
      lunas,
      username,
      id
    ]);

    const after = result.rows[0];

    // ✅ Simpan ke history_log_v1
    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'transaction',
      'UPDATE',
      JSON.stringify({ before, after, reason: `Upload pembayaran oleh ${username}` }),
      user_id,
      'Upload Bukti Pembayaran'
    ]);

    res.json({ message: 'Bukti pembayaran berhasil disimpan ke faktur transaksi.' });

  } catch (err) {
    console.error('❌ Upload payment error:', err);
    res.status(500).json({ message: 'Gagal upload bukti pembayaran.' });
  }
});

// GET all bank list form dim_table
async function getAllBanks() {
  const result = await pool.query(`
    SELECT bank_name, logo_url, account_number, account_holder_name 
    FROM dim_bank
  `);

  return result.rows.map(row => ({
    logoUrl: row.logo_url,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    accountHolder: row.account_holder_name
  }));
}


// post /api/send-confirmation-email
app.post('/api/send-confirmation-email', async (req, res) => {
  const { 
    to,
    customerName,
    bookingCode,
    carType,
    startDate,
    startTime,
    endDate,
    deposit,
    discount,
    needsTrip,
    needsDriver,
    needsDelivery,
    needsPickup,
    rentalCost,
    tripFee,
    driverFee,
    deliveryFee,
    pickupFee,
    grandTotal
   } = req.body;

   

  try {

      const result = await pool.query(
      'SELECT invoice_logs FROM fact_transaction WHERE booking_code = $1',
      [bookingCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    let invoiceLogs = result.rows[0].invoice_logs || [];
    const now = new Date();
    const lastSent = invoiceLogs.slice(-1)[0];

    // ⛔ BLOKIR JIKA INVOICE BARU SAJA DIKIRIM < 10 MENIT
    if (lastSent && new Date(lastSent) > new Date(now.getTime() - 10 * 60000)) {
      return res.status(429).json({ error: 'Invoice baru saja dikirim. Silakan tunggu 10 menit.' });
    }

    // 1. Buat transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'andirentalmobilbi@gmail.com',
        pass: 'nxvt jqzi bmvq ytzb', // App Password Gmail
      },
    });

    // 2. Buat subject dan html email
    const bankList = await getAllBanks();
    const subject = `Konfirmasi Booking "${bookingCode}" Anda - Andi Rental Mobil`;

    const logoResult = await pool.query(`
      SELECT url_image FROM dim_web_config WHERE description = 'Logo' LIMIT 1
    `);
    const logoUrl = logoResult.rows[0]?.url_image || 'https://default/logo.png';

    const html = generateInvoiceEmail({
      customerName,
      bookingCode,
      carType,
      startDate,
      startTime,
      endDate,
      deposit,
      discount,
      needsTrip,
      needsDriver,
      needsDelivery,
      needsPickup,
      rentalCost,
      tripFee,
      driverFee,
      deliveryFee,
      pickupFee,
      grandTotal,
      bankList,
      logoUrl
    });

    const filePath = path.join(__dirname, 'public', 'terms_and_conditions.pdf');
    if (!fs.existsSync(filePath)) {
    console.log("❌ PDF belum ada!");
  } else {
    console.log("✅ PDF ditemukan!");
  }

    // 3. Kirim email
    await transporter.sendMail({
      from: '"Andi Rental Mobil" <noreply@andirentalmobil.com>',
      to,
      subject,
      html,
      attachments: [
        {
          filename: 'Syarat-dan-Ketentuan-Andi-Rental-Mobil.pdf',
          path: filePath,
          contentType: 'application/pdf'
        }
      ]
    });

    // ✅ SIMPAN LOG INVOICE KIRIM
    invoiceLogs.push(now.toISOString());

    await pool.query(
      'UPDATE fact_transaction SET invoice_logs = $1 WHERE booking_code = $2',
      [JSON.stringify(invoiceLogs), bookingCode]
    );

    res.status(200).json({ message: 'Invoice berhasil dikirim!' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ message: 'Invoice mengirim email.' });
  }
});


app.post('/api/send-receipt-email', async (req, res) => {
  const {
    to,
    customerName,
    bookingCode,
    carType,
    startDate,
    startTime,
    endDate,
    grandTotal,
  } = req.body;

  try {
    const htmlPath = path.join(__dirname, 'templates', 'receipt-template.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Inject data ke dalam HTML
  const safeStartTime = startTime ? `${startTime} WIB` : '-';


   html = html
  .replace(/\[CUSTOMER_NAME\]/g, customerName)
  .replace(/<div[^>]*id="customerName"[^>]*>.*?<\/div>/i, `<div id="customerName">${customerName}</div>`)
  .replace(/<div[^>]*id="customerNameDetail"[^>]*>.*?<\/div>/i, `<div id="customerNameDetail">${customerName}</div>`)
  .replace(/<div[^>]*id="customerSignature"[^>]*>.*?<\/div>/i, `<div id="customerSignature">${customerName}</div>`)
  .replace(/<div[^>]*id="bookingCode"[^>]*>.*?<\/div>/i, `<div id="bookingCode">${bookingCode}</div>`)
  .replace(/<div[^>]*id="carType"[^>]*>.*?<\/div>/i, `<div id="carType">${carType}</div>`)
  .replace(/<div[^>]*id="rentalPeriod"[^>]*>.*?<\/div>/i, `<div id="rentalPeriod">${startDate} - ${endDate}</div>`)
  .replace(/<div[^>]*id="startTime"[^>]*>.*?<\/div>/i, `<div id="startTime">${safeStartTime}</div>`)
  .replace(/<div[^>]*id="grandTotal"[^>]*>.*?<\/div>/i, `<div id="grandTotal">Rp ${parseInt(grandTotal).toLocaleString('id-ID')}</div>`)
  .replace(/<div[^>]*id="currentDate"[^>]*>.*?<\/div>/i, `<div id="currentDate">${new Date().toLocaleDateString('id-ID')}</div>`)
  .replace(/<p[^>]*id="receipt-date"[^>]*>.*?<\/p>/i,
           `<p id="receipt-date">${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`);

  // Ambil gambar "Lunas" dan "Tanda Tangan" dari DB
    const configResult = await pool.query(`
      SELECT description, url_image FROM dim_web_config 
      WHERE description IN ('Logo', 'Lunas', 'Tanda Tangan')
    `);
    const configImages = {};
    configResult.rows.forEach(row => {
      configImages[row.description] = row.url_image;
    });

    const logoUrl = configImages['Logo'] || '';
    const lunasUrl = configImages['Lunas'] || '';
    const signatureUrl = configImages['Tanda Tangan'] || '';

    // Ganti placeholder <img> src di HTML
    html = html
      .replace(/<img[^>]+id="logoImage"[^>]*>/i,
              `<img id="logoImage" src="${logoUrl}" alt="Logo" style="width: 32px; height: 32px; border-radius: 4px; background-color: rgba(255,255,255,0.2); object-fit: contain;" />`)
      .replace(/<img[^>]+id="lunasStamp"[^>]*>/i,
              `<img id="lunasStamp" src="${lunasUrl}" alt="LUNAS" style="margin-top: 10px; max-width: 120px; transform: rotate(-10deg); opacity: 0.7;" />`)
      .replace(/<img[^>]+id="signatureImage"[^>]*>/i,
              `<img id="signatureImage" src="${signatureUrl}" alt="Tanda Tangan" style="height: 60px; margin-bottom: 10px;" />`);

    // fs.writeFileSync('./final-receipt-debug.html', html);
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'andirentalmobilbi@gmail.com',
        pass: 'nxvt jqzi bmvq ytzb',
      },
    });

    await transporter.sendMail({
      from: '"Andi Rental Mobil" <noreply@andirentalmobil.com>',
      to,
      subject: `Receipt Pembayaran - ${bookingCode}`,
      html
    });

    res.status(200).json({ message: 'Receipt berhasil dikirim' });
  } catch (err) {
    console.error('❌ Kirim receipt gagal:', err);
    res.status(500).json({ message: 'Gagal mengirim receipt' });
  }
});

//app post api/employees
app.post('/api/employees', async (req, res) => {
  const { username, full_name, level, password, user_id } = req.body;
  if (!user_id) return res.status(400).json({ message: 'User ID tidak ditemukan.' });

  const validLevels = ['admin', 'manajemen'];
  const normalizedLevel = level?.toLowerCase();
  if (!validLevels.includes(normalizedLevel)) {
    return res.status(400).json({ message: 'Level tidak valid' });
  }

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      'INSERT INTO dim_user (username, full_name, level, password) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, full_name, normalizedLevel, hashedPassword]
    );

    const insertedUser = result.rows[0];

    // Simpan log ke history_log_v1
await pool.query(`
  INSERT INTO history_log_v1 (
    log_id, entity, action, changes, user_id, page
  ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
`, [
  insertedUser.id, // ✅ ID dari user yang baru ditambahkan
  'employee',
  'CREATE',
  JSON.stringify({
    after: {
      username: insertedUser.username,
      full_name: insertedUser.full_name,
      level: insertedUser.level
    },
    before: null
  }),
  req.body.user_id, // pastikan ini UUID valid
  'Manajemen Karyawan'
]);

    res.status(201).json({ message: 'Data karyawan berhasil ditambahkan!' });
  } catch (error) {
    console.error('Error adding employee:', error);
    
    if (error.code === '23505') {
    return res.status(409).json({ message: 'Username sudah digunakan. Gunakan username lain.' });
  }
    res.status(500).json({ message: 'Gagal menambahkan data karyawan.' });
  }
});


//app get api/employees
app.get('/api/employees', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, full_name, level, created_at FROM dim_user ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// app put /api/employees/:id
app.put('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const { full_name, level, password, user_id, username } = req.body;

  try {
    const beforeResult = await pool.query('SELECT * FROM dim_user WHERE id = $1', [id]);
    const before = beforeResult.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (full_name) {
      fields.push(`full_name = $${index++}`);
      values.push(full_name);
    }

    if (level) {
      fields.push(`level = $${index++}`);
      values.push(level);
    }

    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      fields.push(`password = $${index++}`);
      values.push(hashedPassword);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Tidak ada field yang diupdate.' });
    }

    values.push(id); // id untuk where condition

    const updateQuery = `
      UPDATE dim_user
      SET ${fields.join(', ')}
      WHERE id = $${index}
    `;

    await pool.query(updateQuery, values);

    // Catat ke log histori
    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'employee',
      'UPDATE',
      JSON.stringify({ before, after: { full_name, level, updated_by: username }, reason: password ? 'Reset password' : 'Edit data' }),
      user_id,
      'Manajemen Karyawan'
    ]);

    res.json({ message: 'Data karyawan berhasil diupdate!' });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ message: 'Gagal mengupdate data karyawan.' });
  }
});

// app delete /api/employees/:id
app.delete('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id, username } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: 'user_id tidak boleh kosong.' });
  }

  try {
    const result = await pool.query('SELECT * FROM dim_user WHERE id = $1', [id]);
    const before = result.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    }

    await pool.query('DELETE FROM dim_user WHERE id = $1', [id]);

    // Simpan ke history_log_v1
    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'employee',
      'DELETE',
      JSON.stringify({ before, reason: `Dihapus oleh ${username || 'unknown'}` }),
      user_id,
      'Manajemen Karyawan'
    ]);

    res.json({ message: 'Data karyawan berhasil dihapus!' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ message: 'Gagal menghapus data karyawan.' });
  }
});


app.listen(process.env.PORT, () => {
  console.log(`API running at http://localhost:${process.env.PORT}`);
});

// GET Activity Log
app.get('/history-logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        h.id,
        h.log_id,
        h.entity,
        h.action,
        h.changes,
        h.page,
        h.created_at,
        h.user_id,
        u.username -- ambil username dari join
      FROM history_log_v1 h
      LEFT JOIN dim_user u ON h.user_id = u.id
      ORDER BY h.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ message: 'Gagal mengambil log aktifitas.' });
  }
});


app.get('/api/transaction', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM fact_transaction WHERE deleted = false OR deleted IS NULL ORDER BY updated_at DESC`);

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

    const transactions = result.rows.map(row => ({
      ...row,
      deposit_payment_url: row.deposit_payment?.filename || null,
      down_payment_url: row.down_payment?.filename || null,
      full_payment_url: row.full_payment?.filename || null,
      }));

    res.json(transactions);
  } catch (err) {
    console.error('❌ Error GET /api/transaction:', err);
    res.status(500).json({ message: 'Gagal ambil data transaksi' });
  }
});

app.post('/api/transaction', upload.fields([
  { name: 'ktpFile', maxCount: 1 },
  { name: 'simFile', maxCount: 1 },
  { name: 'kkFile', maxCount: 1 },
  { name: 'workOrStudentIdFile', maxCount: 1 },
  { name: 'parentKtpFile', maxCount: 1 },
  { name: 'spouseKtpFile', maxCount: 1 },
  { name: 'personalIdFile', maxCount: 1 },
  { name: 'marriageDocFile', maxCount: 1 },
  { name: 'picKtpFile', maxCount: 1 },
  { name: 'picKkFile', maxCount: 1 },
  { name: 'companyNpwpFile', maxCount: 1 },
  { name: 'companySiupFile', maxCount: 1 },
  { name: 'companyNibFile', maxCount: 1 },
  { name: 'companyPhotoFile', maxCount: 1 },
  { name: 'passportFile', maxCount: 1 },
  { name: 'kitasKitapFile', maxCount: 1 },
  { name: 'visaFile', maxCount: 1 },
  { name: 'ticketFile', maxCount: 1 },
  { name: 'ticketHotelFile', maxCount: 1 },
  { name: 'housePhotoFile', maxCount: 1 },
  { name: 'workIdFile', maxCount: 1 },
  { name: 'verificationVideoFile', maxCount: 1 },
  { name: 'optionalRequirementFile', maxCount: 1 },
]), async (req, res) => {
  const {
    booking_code,
    email,
    rental_duration,
    range_rent,
    car_type,
    deposit,
    discount,
    needs_trip,
    needs_driver,
    needs_delivery,
    needs_pickup,
    trip_fee,
    driver_fee,
    delivery_fee,
    pickup_fee,
    start_date,
    start_time,
    end_date,
    grand_total,
    identity_type,
    name,
    whatsapp,
    address,
    company_address,
    purpose
  } = req.body;


  const username = req.body.username || 'system';
  const parsedRangeRent = isNaN(Number(range_rent)) ? 0 : Number(range_rent);
  const parsedGrandTotal = isNaN(Number(grand_total)) ? 0 : Number(grand_total);
  const parsedStartTime = start_time && start_time.trim() !== '' ? start_time : null;
  const parsedDeposit = isNaN(Number(deposit)) ? 0 : Number(deposit);
  const parsedDiscount = isNaN(Number(discount)) ? 0 : Number(discount);
  const parsedTripFee = isNaN(Number(trip_fee)) ? 0 : Number(trip_fee);
  const parsedDriverFee = isNaN(Number(driver_fee)) ? 0 : Number(driver_fee);
  const parsedDeliveryFee = isNaN(Number(delivery_fee)) ? 0 : Number(delivery_fee);
  const parsedPickupFee = isNaN(Number(pickup_fee)) ? 0 : Number(pickup_fee);  
  const parsedNeedsTrip     = req.body.needs_trip === 'true' || req.body.needs_trip === true;
  const parsedNeedsDriver   = req.body.needs_driver === 'true' || req.body.needs_driver === true;
  const parsedNeedsDelivery = req.body.needs_delivery === 'true' || req.body.needs_delivery === true;
  const parsedNeedsPickup   = req.body.needs_pickup === 'true' || req.body.needs_pickup === true;


  console.log('🧪 Parsed Boolean:', {
  parsedNeedsTrip,
  parsedNeedsDriver,
  parsedNeedsDelivery,
  parsedNeedsPickup
});

  try {
    const result = await pool.query(`
        INSERT INTO fact_transaction (
          booking_code, email, rental_duration, range_rent, car_type, needs_trip, needs_driver,
          needs_delivery, needs_pickup, start_date, start_time, end_date, grand_total,
          deposit, discount, trip_fee, driver_fee, delivery_fee, pickup_fee, purpose,
          identity_type, name, whatsapp, address, company_address,
          created_at, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25,
          $26, $27
        ) RETURNING *;
      `, [
        booking_code,
        email,
        rental_duration,
        parsedRangeRent,
        car_type,
        parsedNeedsTrip,
        parsedNeedsDriver,
        parsedNeedsDelivery,
        parsedNeedsPickup,
        start_date,
        parsedStartTime,
        end_date,
        parsedGrandTotal,
        parsedDeposit,
        parsedDiscount,
        parsedTripFee,
        parsedDriverFee,
        parsedDeliveryFee,
        parsedPickupFee,
        purpose,
        identity_type,
        name,
        whatsapp,
        address,
        company_address,
        new Date(),
        username || 'system'
      ]);

      console.log('📤 Inserted transaction:', result.rows[0]);

      const insertedTransaction = result.rows[0];

      const user_id = req.body.user_id || req.headers['x-user-id'];

      if (!user_id) {
        return res.status(400).json({ error: 'User ID wajib diisi.' });
      }

await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5::uuid, $6)
    `, [
      insertedTransaction.id,
      'transaction',
      'CREATE',
      JSON.stringify({ after: insertedTransaction, before: null, created_by: username }),
      user_id,
      'Form Booking'
    ]);

    res.status(201).json(insertedTransaction);
  } catch (err) {
    console.error('ERROR POST /api/transaction:', err);
    res.status(500).json({ error: err.message });
  }
});


// PUT Transaction
app.put('/api/transaction/upload-payment/:id', upload.fields([
  { name: 'deposit', maxCount: 1 },
  { name: 'dp', maxCount: 1 },
  { name: 'full', maxCount: 1 }
]), async (req, res) => {
  console.log('>>> PUT /api/transaction/upload-payment/', req.params.id);
  try {
    const { id } = req.params;
    const { user_id, username, isLunas } = req.body;

    const depositFile = req.files?.deposit?.[0];
    const dpFile = req.files?.dp?.[0];
    const fullFile = req.files?.full?.[0];

    const lunas = isLunas === 'true';

    // Ambil data sebelum update
    const beforeResult = await pool.query(
      `SELECT * FROM fact_transaction WHERE id = $1`,
      [id]
    );
    const before = beforeResult.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    }

    console.log('Previous file:', before?.deposit_payment?.filename);
    console.log('Updating file:', depositFile?.filename);

    // Hapus file lama kalau dihapus atau upload baru
    if (req.body.deleteDeposit === 'true' || depositFile) {
      deleteFileIfExists(before?.deposit_payment?.filename);
    }
    if (req.body.deleteDp === 'true' || dpFile) {
      deleteFileIfExists(before?.down_payment?.filename);
    }
    if (req.body.deleteFull === 'true' || fullFile) {
      deleteFileIfExists(before?.full_payment?.filename);
    }

    const depositData =
      req.body.deleteDeposit === 'true' ? null :
      depositFile ? {
        filename: depositFile.filename,
        mimetype: depositFile.mimetype,
      } : before?.deposit_payment;

    const dpData =
      req.body.deleteDp === 'true' ? null :
      dpFile ? {
        filename: dpFile.filename,
        mimetype: dpFile.mimetype,
      } : before?.down_payment;

    const fullData =
      req.body.deleteFull === 'true' ? null :
      fullFile ? {
        filename: fullFile.filename,
        mimetype: fullFile.mimetype,
      } : before?.full_payment;

    const result = await pool.query(`
      UPDATE fact_transaction
      SET deposit_payment = $1,
          down_payment = $2,
          full_payment = $3,
          lunas = $4,
          updated_by = $5,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [
      depositData,
      dpData,
      fullData,
      lunas,
      username,
      id
    ]);

    const after = result.rows[0];

    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'transaction',
      'UPDATE',
      JSON.stringify({ before, after, reason: `Upload pembayaran oleh ${username}` }),
      user_id,
      'Upload Pembayaran Manual'
    ]);

    res.json({ message: 'Upload bukti pembayaran berhasil' });

  } catch (err) {
    console.error('❌ ERROR PUT /api/transaction/upload-payment/:id', err);
    res.status(500).json({ message: 'Gagal upload bukti pembayaran.' });
  }
});

// GET trx history
app.get('/api/transaction/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(`
      SELECT * FROM history_log_v1
      WHERE log_id = $1 AND entity = 'transaction'
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const totalResult = await pool.query(`
      SELECT COUNT(*) FROM history_log_v1
      WHERE log_id = $1 AND entity = 'transaction'
    `, [id]);

    const total = parseInt(totalResult.rows[0].count);

    res.json({
      history: result.rows,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (err) {
    console.error('Error fetching transaction history:', err);
    res.status(500).json({ message: 'Gagal ambil log histori transaksi.' });
  }
});

// PUT /api/transaction/delete/:id
app.put('/api/transaction/delete/:id', async (req, res) => {
  const { id } = req.params;
  const { reason, user_id, username } = req.body;

  try {
    const beforeResult = await pool.query(`SELECT * FROM fact_transaction WHERE id = $1`, [id]);
    const before = beforeResult.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    }

    await pool.query(`
      UPDATE fact_transaction
      SET deleted = true, delete_reason = $1, updated_at = NOW(), updated_by = $2
      WHERE id = $3
    `, [reason, username, id]);

    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'transaction',
      'DELETE',
      JSON.stringify({ reason, before, deleted_by: `Dihapus oleh ${username}` }),
      user_id,
      'Data Transaksi'
    ]);

    res.json({ message: 'Transaksi berhasil dihapus.' });
  } catch (err) {
    console.error('❌ Error DELETE /api/transaction/delete/:id', err);
    res.status(500).json({ message: 'Gagal menghapus transaksi.' });
  }
});

// CHeck Booking Code Exists
app.get('/api/transaction/check-booking-code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await pool.query(
      'SELECT COUNT(*) FROM fact_transaction WHERE booking_code = $1',
      [code]
    );
    const count = parseInt(result.rows[0].count, 10);
    res.json({ exists: count > 0 });
  } catch (err) {
    console.error('Error checking booking code:', err);
    res.status(500).json({ message: 'Gagal mengecek booking code.' });
  }
});


// POST From Reorder 
app.post('/api/fact_transaction', async (req, res) => {
  try {
    const {
      booking_code,
      email,
      rental_duration,
      range_rent,
      car_type,
      needs_trip,
      needs_driver,
      needs_delivery,
      needs_pickup,
      start_date,
      start_time,
      end_date,
      grand_total,
      deposit,
      discount,
      trip_fee,
      driver_fee,
      delivery_fee,
      pickup_fee,
      purpose,
      identity_type,
      name,
      whatsapp,
      address,
      company_address,
      user_id,
      username
    } = req.body;

    const parsedRangeRent = isNaN(Number(range_rent)) ? 0 : Number(range_rent);
    const parsedGrandTotal = isNaN(Number(grand_total)) ? 0 : Number(grand_total);
    const parsedStartTime = start_time && start_time.trim() !== '' ? start_time : null;
    const parsedDeposit = isNaN(Number(deposit)) ? 0 : Number(deposit);
    const parsedDiscount = isNaN(Number(discount)) ? 0 : Number(discount);
    const parsedTripFee = isNaN(Number(trip_fee)) ? 0 : Number(trip_fee);
    const parsedDriverFee = isNaN(Number(driver_fee)) ? 0 : Number(driver_fee);
    const parsedDeliveryFee = isNaN(Number(delivery_fee)) ? 0 : Number(delivery_fee);
    const parsedPickupFee = isNaN(Number(pickup_fee)) ? 0 : Number(pickup_fee);

    // ✅ Simpan ke fact_transaction
    const result = await pool.query(`
      INSERT INTO fact_transaction (
        booking_code, email, rental_duration, range_rent, car_type, needs_trip, needs_driver,
        needs_delivery, needs_pickup, start_date, start_time, end_date, grand_total,
        deposit, discount, trip_fee, driver_fee, delivery_fee, pickup_fee, purpose,
        identity_type, name, whatsapp, address, company_address,
        created_at, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27
      ) RETURNING *
    `, [
      booking_code,
      email,
      rental_duration,
      parsedRangeRent,
      car_type,
      needs_trip === 'true' || needs_trip === true,
      needs_driver === 'true' || needs_driver === true,
      needs_delivery === 'true' || needs_delivery === true,
      needs_pickup === 'true' || needs_pickup === true,
      start_date,
      parsedStartTime,
      end_date,
      parsedGrandTotal,
      parsedDeposit,
      parsedDiscount,
      parsedTripFee,
      parsedDriverFee,
      parsedDeliveryFee,
      parsedPickupFee,
      purpose,
      identity_type,
      name,
      whatsapp,
      address,
      company_address,
      new Date(),
      username || 'system'
    ]);

    const insertedTransaction = result.rows[0];

    // ✅ Simpan ke history_log_v1
    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5::uuid, $6)
    `, [
      insertedTransaction.id,
      'transaction',
      'CREATE',
      JSON.stringify({ after: insertedTransaction, created_by: username }),
      user_id,
      'Reorder Customer'
    ]);

    res.status(201).json(insertedTransaction);
  } catch (err) {
    console.error('❌ ERROR POST /api/fact_transaction:', err);
    res.status(500).json({ message: 'Gagal simpan data reorder.', error: err.message });
  }
});


// GET /api/loyalty-customers
app.get('/api/loyalty-customers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ft.email, 
        dc.name, 
        dc.whatsapp, 
        dc.address, 
        COUNT(*) AS transaction_count
      FROM fact_transaction ft
      INNER JOIN dim_cust dc ON ft.email = dc.email
        AND ft.name = dc.name
        AND ft.whatsapp = dc.whatsapp
        AND ft.address = dc.address
      WHERE ft.deleted = false
      GROUP BY ft.email, dc.name, dc.whatsapp, dc.address
      ORDER BY transaction_count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Gagal ambil loyalty customer:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// GET semua rekening
app.get('/api/bank-accounts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dim_bank ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching bank accounts:', err);
    res.status(500).json({ message: 'Gagal ambil data bank.' });
  }
});

// POST tambah rekening baru
app.post('/api/bank-accounts', async (req, res) => {
  const { bankName, logoUrl, accountNumber, accountHolderName, created_by, updated_by, user_id } = req.body;

  try {
    const insertResult = await pool.query(
      `INSERT INTO dim_bank (
        id, bank_name, logo_url, account_number, account_holder_name, created_at, created_by, updated_at, updated_by
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP, $6
      ) RETURNING *`,
      [bankName, logoUrl, accountNumber, accountHolderName, created_by, updated_by]
    );

    const inserted = insertResult.rows[0];

    await pool.query(
      `INSERT INTO history_log_v1 (
        log_id, entity, action, page, changes, user_id, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::uuid, CURRENT_TIMESTAMP
      )`,
      [
        'bank_account',
        'CREATE',
        'Bank Account Settings',
        JSON.stringify({ after: inserted }),
        user_id
      ]
    );

    res.status(201).json(inserted);
  } catch (err) {
    console.error('Error adding bank account:', err);
    res.status(500).json({ message: 'Gagal menambahkan rekening.' });
  }
});

// PUT update rekening
app.put('/api/bank-accounts/:id', async (req, res) => {
  const { id } = req.params;
  const {
    bankName,
    logoUrl,
    accountNumber,
    accountHolderName,
    updated_by,
    user_id // UUID untuk log
  } = req.body;

  try {
    const { rows: beforeRows } = await pool.query('SELECT * FROM dim_bank WHERE id = $1', [id]);
    const before = beforeRows[0];

    await pool.query(
      `UPDATE dim_bank SET 
        bank_name = $1,
        logo_url = $2,
        account_number = $3,
        account_holder_name = $4,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $5
      WHERE id = $6`,
      [bankName, logoUrl, accountNumber, accountHolderName, updated_by, id]
    );

    await pool.query(
      `INSERT INTO history_log_v1 (
        log_id, entity, action, page, changes, user_id, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::uuid, CURRENT_TIMESTAMP
      )`,
      [
        'bank_account',
        'UPDATE',
        'Bank Account Settings',
        JSON.stringify({ before, after: { bankName, logoUrl, accountNumber, accountHolderName, updated_by } }),
        user_id
      ]
    );

    res.json({ message: 'Rekening berhasil diperbarui.' });
  } catch (err) {
    console.error('Error updating bank account:', err);
    res.status(500).json({ message: 'Gagal update rekening.' });
  }
});

// DELETE rekening
app.post('/api/bank-accounts/delete/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  try {
    const { rows: beforeRows } = await pool.query('SELECT * FROM dim_bank WHERE id = $1', [id]);

    if (beforeRows.length === 0) {
      return res.status(404).json({ message: 'Rekening tidak ditemukan.' });
    }

    const before = beforeRows[0];

    await pool.query('DELETE FROM dim_bank WHERE id = $1', [id]);

    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, page, changes, user_id, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::uuid, CURRENT_TIMESTAMP
      )
    `, [
      'bank_account',
      'DELETE',
      'Bank Account Settings',
      JSON.stringify({ before }),
      user_id
    ]);

    res.json({ message: 'Rekening berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting bank account:', err);
    res.status(500).json({ message: 'Gagal hapus rekening.' });
  }
});

// GET Loyalty Poin
app.get('/api/loyalty-settings', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM dim_loyalty_poin ORDER BY created_at DESC LIMIT 1');

  if (rows.length > 0) {
    res.json(rows[0]);
  } else {
    res.json({
      daily_point: 1,
      monthly_point: 25,
      point_value: 2000,
      min_exchange_point: 25
    });
  }
});


  // POST Loyalty Poin
app.post('/api/loyalty-settings', async (req, res) => {
  try {
    const {
      daily_point,
      monthly_point,
      point_value,
      min_exchange_point,
      created_by,
      updated_by,
      user_id
    } = req.body;

    console.log('Data dari frontend:', req.body);

    const { rows: existing } = await pool.query(
      'SELECT * FROM dim_loyalty_poin ORDER BY created_at DESC LIMIT 1'
    );

    if (existing.length > 0) {
      await pool.query(`
        UPDATE dim_loyalty_poin
        SET
          daily_point = $1,
          monthly_point = $2,
          point_value = $3,
          min_exchange_point = $4,
          updated_by = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [
        daily_point,
        monthly_point,
        point_value,
        min_exchange_point,
        updated_by,         // ✅ fix di sini
        existing[0].id
      ]);

      await pool.query(`
        INSERT INTO history_log_v1 (
    log_id, entity, action, page, changes, user_id, created_at
  ) VALUES (
    gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::uuid, CURRENT_TIMESTAMP
  )
`, [
  'loyalty_poin',
  'UPDATE',
  'Loyalty Settings',
  JSON.stringify({
    before: existing[0],
    after: {
      daily_point,
      monthly_point,
      point_value,
      min_exchange_point,
      updated_by  // hanya ditaruh di dalam JSON
    }
  }),
  user_id // ini yang ke kolom UUID!
]);


    } else {
      await pool.query(`
        INSERT INTO dim_loyalty_poin (
          id, daily_point, monthly_point, point_value, min_exchange_point,
          created_by, created_at, updated_by, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP
        )
      `, [
        daily_point,
        monthly_point,
        point_value,
        min_exchange_point,
        created_by,         // 
        updated_by          // 
      ]);

await pool.query(`
  INSERT INTO history_log_v1 (
    log_id, entity, action, page, changes, user_id, created_at
  ) VALUES (
    gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::uuid, CURRENT_TIMESTAMP
  )
`, [
  'loyalty_poin',
  'CREATE',
  'Loyalty Settings',
  JSON.stringify({
    before: existing[0],
    after: {
      daily_point,
      monthly_point,
      point_value,
      min_exchange_point,
      created_by  // hanya ditaruh di dalam JSON
    }
  }),
  user_id // ini yang ke kolom UUID!
]);
    }


    res.json({ message: 'Loyalty settings saved successfully.' });
  } catch (error) {
    console.error('POST /api/loyalty-settings ERROR:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// GET all web config
app.get('/api/web-configs', async (req, res) => {
  const result = await pool.query('SELECT * FROM dim_web_config ORDER BY created_at DESC');
  res.json(result.rows);
});

// POST new web config
app.post('/api/web-configs', async (req, res) => {
  const { description, url_image, created_by, updated_by, user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id wajib diisi' });
  }

  // Helper untuk simpan history log
  const saveHistoryLog = async ({ log_id, action, before = null, after = null }) => {
    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      log_id,
      'web_config',
      action,
      JSON.stringify({ before, after }),
      user_id,
      'Pengaturan Web'
    ]);
  };

  try {
    // Cek apakah description sudah ada
    const check = await pool.query(
      `SELECT * FROM dim_web_config WHERE description = $1`,
      [description]
    );

    if (check.rowCount > 0) {
      const existing = check.rows[0];

      // Jika gambar sama → tidak perlu simpan ulang
      if (existing.url_image === url_image) {
        return res.status(409).json({
          message: 'Deskripsi sudah ada dan gambar sama. Tidak perlu disimpan ulang.'
        });
      }

      // Jika gambar beda → lakukan UPDATE
      const updateResult = await pool.query(`
        UPDATE dim_web_config
        SET url_image = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [url_image, updated_by, existing.id]);

      const after = updateResult.rows[0];

      // Simpan log UPDATE
      await saveHistoryLog({
        log_id: existing.id,
        action: 'UPDATE',
        before: existing,
        after
      });

      return res.status(200).json(after);
    }

    // Jika belum ada → INSERT baru
    const insertResult = await pool.query(`
      INSERT INTO dim_web_config (
        description, url_image, created_by, updated_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `, [description, url_image, created_by, updated_by]);

    const inserted = insertResult.rows[0];

    // Simpan log CREATE
    await saveHistoryLog({
      log_id: inserted.id,
      action: 'CREATE',
      after: inserted
    });

    res.status(201).json(inserted);
  } catch (err) {
    console.error('Gagal simpan web config:', err);
    res.status(500).json({ message: 'Gagal menyimpan pengaturan web.' });
  }
});



app.delete('/api/web-configs/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query; // Ambil user_id dari query param (bisa juga dari token/session)

  try {
    const result = await pool.query(
      'DELETE FROM dim_web_config WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Data tidak ditemukan' });
    }

    const deletedData = result.rows[0];

    // Simpan ke history log
    await pool.query(`
      INSERT INTO history_log_v1 (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      deletedData.id,
      'web_config',
      'DELETE',
      JSON.stringify({ before: deletedData }), // Hanya "before"
      user_id || 'system',
      'Pengaturan Web'
    ]);

    res.status(200).json({ message: 'Berhasil dihapus' });
  } catch (err) {
    console.error('Gagal hapus web config:', err);
    res.status(500).json({ message: 'Gagal menghapus web config' });
  }
});


app.get('/api/web-config/logo', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT url_image FROM dim_web_config
      WHERE LOWER(description) = 'logo'
      LIMIT 1
    `);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Logo tidak ditemukan' });
    }

    res.json(result.rows[0]); // hanya { url_image }
  } catch (err) {
    console.error('Gagal ambil logo:', err);
    res.status(500).json({ message: 'Gagal mengambil logo' });
  }
});