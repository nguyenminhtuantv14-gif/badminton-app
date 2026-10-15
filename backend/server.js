const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// 1. API Xác thực Đăng nhập Admin
app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body;
  try {
    if (phone === '0909999999' && password === 'admin123') {
      return res.json({
        success: true,
        user: { id: 1, full_name: 'Ban Quản Trị (Admin)', phone: '0909999999', role: 'ADMIN' }
      });
    }

    const [users] = await db.query(
      'SELECT id, full_name, phone_number, role, password_hash FROM users WHERE phone_number = ? AND role = "ADMIN"',
      [phone]
    );

    if (users.length > 0 && users[0].password_hash === password) {
      const u = users[0];
      return res.json({
        success: true,
        user: { id: u.id, full_name: u.full_name, phone: u.phone_number, role: 'ADMIN' }
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Cổng đăng nhập này chỉ dành cho Ban Quản Trị (Admin)!'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Lấy danh sách sân
app.get('/api/courts', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, f.name AS facility_name, f.address 
      FROM courts c 
      JOIN facilities f ON c.facility_id = f.id
      ORDER BY c.id ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Admin đổi trạng thái sân
app.patch('/api/courts/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.query('UPDATE courts SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Cập nhật trạng thái sân thành công!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Lấy các slot đã được đặt theo ngày
app.get('/api/bookings/slots', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const [rows] = await db.query(`
      SELECT bd.id, bd.court_id, bd.booking_date, bd.start_time, bd.end_time, bd.slot_status
      FROM booking_details bd
      WHERE bd.booking_date = ? AND bd.slot_status IN ('HELD', 'CONFIRMED')
    `, [date]);
    res.json({ success: true, bookedSlots: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Khách hàng tạo đơn đặt sân (Đã khớp chính xác bảng users)
app.post('/api/bookings', async (req, res) => {
  const { fullName, phone, bookingDate, slots, totalAmount } = req.body;

  if (!slots || slots.length === 0) {
    return res.status(400).json({ success: false, message: 'Chưa có khung giờ nào được chọn!' });
  }

  if (!fullName || !phone) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ Họ tên và Số điện thoại liên hệ!' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 5.1 Tìm khách theo phone_number
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE phone_number = ?',
      [phone]
    );

    let customerId;
    if (existingUsers.length > 0) {
      customerId = existingUsers[0].id;
      await connection.query('UPDATE users SET full_name = ? WHERE id = ?', [fullName, customerId]);
    } else {
      const defaultEmail = `${phone}@guest.local`;
      const defaultPassword = 'guest_password';

      const [newUser] = await connection.query(
        'INSERT INTO users (full_name, email, password_hash, phone_number, role, status) VALUES (?, ?, ?, ?, "CUSTOMER", "ACTIVE")',
        [fullName, defaultEmail, defaultPassword, phone]
      );
      customerId = newUser.insertId;
    }

    // 5.2 Kiểm tra trùng giờ
    for (const slot of slots) {
      const [existing] = await connection.query(`
        SELECT id FROM booking_details 
        WHERE court_id = ? AND booking_date = ? AND start_time = ? AND slot_status IN ('HELD', 'CONFIRMED')
      `, [slot.courtId, bookingDate, `${slot.time}:00`]);

      if (existing.length > 0) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: `Khung giờ ${slot.time} của ${slot.courtName} đã có người đặt trước!` });
      }
    }

    const bookingCode = 'BMT' + Date.now().toString().slice(-6);
    
    // 5.3 Tạo đơn trong bookings
    const [bookingResult] = await connection.query(`
      INSERT INTO bookings (user_id, booking_code, total_amount, payment_status, status)
      VALUES (?, ?, ?, 'PAID', 'CONFIRMED')
    `, [customerId, bookingCode, totalAmount]);

    const bookingId = bookingResult.insertId;

    // 5.4 Lưu chi tiết từng ca
    for (const slot of slots) {
      const startHour = parseInt(slot.time);
      const endHour = (startHour + 1).toString().padStart(2, '0') + ':00:00';
      await connection.query(`
        INSERT INTO booking_details (booking_id, court_id, booking_date, start_time, end_time, price, slot_status)
        VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED')
      `, [bookingId, slot.courtId, bookingDate, `${slot.time}:00`, endHour, slot.price]);
    }

    await connection.commit();
    res.json({
      success: true,
      message: 'Đặt sân thành công!',
      bookingCode,
      customer: { id: customerId, full_name: fullName, phone }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// 6. Admin lấy danh sách đặt sân
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        bd.id AS detail_id,
        bd.booking_id,
        bd.booking_date,
        bd.start_time,
        bd.end_time,
        bd.slot_status,
        c.court_name,
        c.court_type,
        b.booking_code,
        b.total_amount,
        COALESCE(u.full_name, 'Khách vãng lai') AS customer_name,
        COALESCE(u.phone_number, 'Chưa có SĐT') AS customer_phone
      FROM booking_details bd
      JOIN bookings b ON bd.booking_id = b.id
      JOIN courts c ON bd.court_id = c.id
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY bd.id DESC
    `);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy danh sách booking admin:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Admin hủy từng ca đặt sân
app.delete('/api/bookings/cancel-slot/:detailId', async (req, res) => {
  const { detailId } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    try {
      await connection.query("UPDATE booking_details SET slot_status = 'CANCELLED' WHERE id = ?", [detailId]);
    } catch (err) {
      await connection.query("DELETE FROM booking_details WHERE id = ?", [detailId]);
    }

    await connection.commit();
    res.json({ success: true, message: 'Đã hủy ca đặt sân thành công!' });
  } catch (error) {
    await connection.rollback();
    console.error("Lỗi khi hủy ca:", error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  try {
    await db.query('SELECT 1');
    console.log('✅ Kết nối MySQL thành công!');
    console.log(`🚀 Backend chạy tại: http://localhost:${PORT}`);
  } catch (err) {
    console.error('❌ Lỗi kết nối MySQL:', err.message);
  }
});