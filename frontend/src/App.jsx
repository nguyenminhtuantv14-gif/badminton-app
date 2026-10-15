import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CalendarDays, MapPin, Trophy, ShoppingBag, Clock, CheckCircle2, 
  LogIn, LogOut, LayoutDashboard, Calendar, Trash2, ArrowLeft, Shield, User, Phone
} from 'lucide-react';

const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
];

export default function App() {
  const [courts, setCourts] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form thông tin khách đặt sân trực tiếp
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Quản lý trạng thái Admin
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('booking'); // 'booking' | 'admin'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [adminBookings, setAdminBookings] = useState([]);

  const fetchCourts = () => {
    axios.get('http://localhost:5000/api/courts')
      .then(res => { if (res.data.success) setCourts(res.data.data); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const fetchSlots = () => {
    axios.get(`http://localhost:5000/api/bookings/slots?date=${selectedDate}`)
      .then(res => { if (res.data.success) setBookedSlots(res.data.bookedSlots); })
      .catch(err => console.error(err));
  };

  const fetchAdminBookings = () => {
    axios.get('http://localhost:5000/api/admin/bookings')
      .then(res => { 
        if (res.data.success) {
          setAdminBookings(res.data.data); 
        }
      })
      .catch(err => console.error("Lỗi fetch admin:", err));
  };

  useEffect(() => {
    fetchCourts();
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [selectedDate]);

  useEffect(() => {
    if (currentView === 'admin') fetchAdminBookings();
  }, [currentView]);

  // Xử lý đăng nhập Admin
  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    axios.post('http://localhost:5000/api/auth/login', {
      phone: loginPhone.trim(),
      password: loginPassword.trim()
    })
      .then(res => {
        if (res.data.success) {
          setCurrentUser(res.data.user);
          setShowAuthModal(false);
          setLoginPhone('');
          setLoginPassword('');
          setCurrentView('admin');
        }
      })
      .catch(err => {
        setLoginError(err.response?.data?.message || 'Không thể kết nối đến máy chủ!');
      });
  };

  // Admin đổi trạng thái hoạt động / bảo trì sân
  const toggleCourtStatus = (courtId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE';
    axios.patch(`http://localhost:5000/api/courts/${courtId}/status`, { status: nextStatus })
      .then(res => {
        if (res.data.success) fetchCourts();
      });
  };

  // Khách hàng bấm Đặt sân trực tiếp
  const handleCheckout = () => {
    if (selectedSlots.length === 0) {
      alert('Vui lòng chọn ít nhất một khung giờ đặt sân!');
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Vui lòng nhập đầy đủ Họ tên và Số điện thoại liên hệ!');
      return;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(customerPhone.trim())) {
      alert('Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 chữ số.');
      return;
    }

    axios.post('http://localhost:5000/api/bookings', {
      fullName: customerName.trim(),
      phone: customerPhone.trim(),
      bookingDate: selectedDate,
      slots: selectedSlots,
      totalAmount
    })
      .then(res => {
        if (res.data.success) {
          alert(`🎉 Đặt sân thành công!\nMã đơn: ${res.data.bookingCode}\nNgười đặt: ${customerName.trim()} (${customerPhone.trim()})`);
          setSelectedSlots([]);
          setCustomerName('');
          setCustomerPhone('');
          fetchSlots();
        }
      })
      .catch(err => {
        alert(err.response?.data?.message || 'Có lỗi xảy ra khi đặt sân!');
      });
  };

  // Admin hủy ca đặt của khách để giải phóng khung giờ
  const handleCancelBooking = (detailId) => {
    const confirmMsg = "Admin: Bạn có chắc muốn hủy ca đặt này của khách? Khung giờ sẽ được mở lại ngay.";
    if (!window.confirm(confirmMsg)) return;

    axios.delete(`http://localhost:5000/api/bookings/cancel-slot/${detailId}`)
      .then(res => {
        if (res.data.success) {
          alert("✅ Đã hủy ca đặt sân thành công!");
          fetchAdminBookings();
          fetchSlots();
        }
      })
      .catch(err => alert("Lỗi khi hủy: " + (err.response?.data?.message || err.message)));
  };

  const getSlotStatus = (courtId, time) => {
    const isBooked = bookedSlots.some(b => b.court_id === courtId && b.start_time.startsWith(time));
    if (isBooked) return 'BOOKED';
    const isSelected = selectedSlots.some(s => s.courtId === courtId && s.time === time);
    if (isSelected) return 'SELECTED';
    return 'AVAILABLE';
  };

  const handleSlotClick = (court, time) => {
    if (court.status === 'MAINTENANCE') return;
    const status = getSlotStatus(court.id, time);
    if (status === 'BOOKED') return;

    const price = court.court_type === 'VIP' ? 120000 : 80000;

    if (status === 'SELECTED') {
      setSelectedSlots(prev => prev.filter(s => !(s.courtId === court.id && s.time === time)));
    } else {
      setSelectedSlots(prev => [...prev, { courtId: court.id, courtName: court.court_name, time, price }]);
    }
  };

  const totalAmount = selectedSlots.reduce((sum, item) => sum + item.price, 0);

  return (
    <>
      <style>
        {`
          body { margin: 0; background-color: #f8fafc; font-family: 'Inter', system-ui, sans-serif; }
          .slot-btn { transition: all 0.15s ease; border: 2px solid transparent; }
          .slot-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.08); }
          .slot-available { background: #ffffff; border-color: #e2e8f0; color: #1e293b; }
          .slot-available:hover { border-color: #10b981; color: #10b981; }
          .slot-selected { background: #10b981; border-color: #10b981; color: white; }
          .slot-booked { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; text-decoration: line-through; }
          .glass-header { 
            background: linear-gradient(rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.88)), url('/sancaulong.jpg') center/cover no-repeat; 
            color: white; 
          }
        `}
      </style>

      <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
        {/* Top Navbar */}
        <div style={{ background: '#090d16', color: '#94a3b8', padding: '10px 24px', fontSize: '13px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={14} color="#38bdf8" />
              <span>126 Nguyễn Thiện Thành, Phường 5, Trà Vinh</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {currentUser ? (
                <>
                  <span style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color="#f59e0b" />
                    Xin chào, <b>{currentUser.full_name}</b>
                  </span>

                  <button 
                    onClick={() => setCurrentView(currentView === 'admin' ? 'booking' : 'admin')}
                    style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
                  >
                    {currentView === 'admin' ? <><Calendar size={14}/> Xem Lưới Đặt Sân</> : <><LayoutDashboard size={14}/> Bảng Quản Trị (Admin)</>}
                  </button>

                  <button 
                    onClick={() => { setCurrentUser(null); setCurrentView('booking'); }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                  >
                    <LogOut size={14} /> Đăng Xuất
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setShowAuthModal(true)}
                  style={{ background: '#2563eb', border: 'none', color: 'white', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
                >
                  <Shield size={14} /> Quản Trị Viên (Admin)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Đăng nhập Admin */}
        {showAuthModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: 'white', borderRadius: '20px', width: '360px', padding: '28px', boxShadow: '0 20px 25px rgba(0,0,0,0.2)' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <Shield size={36} color="#2563eb" style={{ margin: '0 auto 8px' }} />
                <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>Đăng Nhập Quản Trị</h3>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>Chỉ dành cho Ban Quản Lý câu lạc bộ</p>
              </div>

              {loginError && (
                <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Số điện thoại Admin</label>
                  <input 
                    type="text" 
                    placeholder="VD: 0909999999"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Mật khẩu Admin</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setShowAuthModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
                    Đóng
                  </button>
                  <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                    Đăng Nhập
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VIEW 1: BẢNG QUẢN TRỊ ADMIN */}
        {currentView === 'admin' && (
          <div style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '24px', margin: 0, color: '#0f172a' }}>Danh Sách Đơn Đặt Sân Của Khách</h2>
                <p style={{ color: '#64748b', margin: '4px 0 0' }}>Admin có toàn quyền kiểm tra và hủy ca đặt của khách để mở lại slot</p>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '32px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b' }}>
                    <th style={{ padding: '12px' }}>Mã Đơn</th>
                    <th style={{ padding: '12px' }}>Khách Hàng</th>
                    <th style={{ padding: '12px' }}>Số Điện Thoại</th>
                    <th style={{ padding: '12px' }}>Sân Đặt</th>
                    <th style={{ padding: '12px' }}>Ngày & Ca Giờ</th>
                    <th style={{ padding: '12px' }}>Trạng Thái</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Thao Tác Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {adminBookings.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>Chưa có đơn đặt sân nào.</td></tr>
                  ) : (
                    adminBookings.map((b, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#2563eb' }}>{b.booking_code}</td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{b.customer_name}</td>
                        <td style={{ padding: '12px', color: '#475569' }}>{b.customer_phone}</td>
                        <td style={{ padding: '12px' }}>{b.court_name}</td>
                        <td style={{ padding: '12px' }}>
                          <b>{b.booking_date?.split('T')[0]}</b> ({b.start_time?.slice(0,5)} - {b.end_time?.slice(0,5)})
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: b.slot_status === 'CONFIRMED' ? '#dcfce7' : '#fee2e2', color: b.slot_status === 'CONFIRMED' ? '#16a34a' : '#b91c1c' }}>
                            {b.slot_status === 'CONFIRMED' ? 'Đang Giữ Chỗ' : 'Đã Hủy'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          {b.slot_status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleCancelBooking(b.detail_id)}
                              style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                            >
                              Hủy Ca Của Khách
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h3 style={{ fontSize: '18px', margin: '0 0 16px', color: '#0f172a' }}>Quản Lý Trạng Thái Vận Hành Sân</h3>
            <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', minWidth: '500px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b' }}>
                    <th style={{ padding: '12px' }}>Tên Sân</th>
                    <th style={{ padding: '12px' }}>Loại Sân</th>
                    <th style={{ padding: '12px' }}>Tình Trạng</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {courts.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{c.court_name}</td>
                      <td style={{ padding: '12px' }}>{c.court_type}</td>
                      <td style={{ padding: '12px', color: c.status === 'ACTIVE' ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                        {c.status === 'ACTIVE' ? 'Sẵn sàng phục vụ' : 'Đang bảo trì'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button 
                          onClick={() => toggleCourtStatus(c.id, c.status)}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: c.status === 'ACTIVE' ? '#fee2e2' : '#dcfce7', color: c.status === 'ACTIVE' ? '#b91c1c' : '#16a34a', cursor: 'pointer', fontWeight: 600 }}
                        >
                          {c.status === 'ACTIVE' ? 'Khóa bảo trì' : 'Mở hoạt động'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 2: GIAO DIỆN CHÍNH (ĐẶT LỊCH SÂN CHO KHÁCH) */}
        {currentView === 'booking' && (
          <>
            <header className="glass-header" style={{ padding: '24px 24px 44px', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
              <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Trophy color="#f59e0b" size={28} /> CLB Cầu Lông Ngôi Sao
                  </h1>
                  <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '14px' }}>Chọn khung giờ trống và điền thông tin để đặt sân ngay</p>
                </div>

                <div style={{ background: 'white', padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CalendarDays size={18} color="#10b981" />
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlots([]); }}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 700, cursor: 'pointer' }}
                  />
                </div>
              </div>
            </header>

            <main style={{ maxWidth: '1200px', margin: '-20px auto 0', display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', padding: '0 24px' }}>
              {/* Lưới chọn ca giờ */}
              <div style={{ background: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px 10px', minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: '#94a3b8', width: '60px' }}>Giờ</th>
                      {courts.map(c => (
                        <th key={c.id}>
                          <div style={{ background: c.court_type === 'VIP' ? '#fffbeb' : '#f8fafc', padding: '8px', borderRadius: '10px', border: c.court_type === 'VIP' ? '1px solid #fde68a' : '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700 }}>{c.court_name}</div>
                            <div style={{ fontSize: '11px', color: c.court_type === 'VIP' ? '#d97706' : '#64748b' }}>{c.court_type === 'VIP' ? '★ VIP' : 'Thường'}</div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map(time => (
                      <tr key={time}>
                        <td style={{ fontWeight: 700, color: '#475569', fontSize: '13px' }}>{time}</td>
                        {courts.map(c => {
                          if (c.status === 'MAINTENANCE') {
                            return <td key={c.id}><div style={{ background: '#f1f5f9', color: '#94a3b8', padding: '10px 4px', borderRadius: '8px', fontSize: '12px', textAlign: 'center' }}>Bảo trì</div></td>;
                          }
                          const status = getSlotStatus(c.id, time);
                          let btnClass = 'slot-available';
                          let text = `${c.court_type === 'VIP' ? 120 : 80}k`;
                          if (status === 'BOOKED') { btnClass = 'slot-booked'; text = 'Đã đặt'; }
                          else if (status === 'SELECTED') { btnClass = 'slot-selected'; text = 'Đã chọn'; }

                          return (
                            <td key={c.id}>
                              <button 
                                onClick={() => handleSlotClick(c, time)} 
                                disabled={status === 'BOOKED'}
                                className={`slot-btn ${btnClass}`}
                                style={{ width: '100%', padding: '10px 4px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: status === 'BOOKED' ? 'not-allowed' : 'pointer' }}
                              >
                                {text}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phiếu đặt sân & Thông tin khách hàng */}
              <div style={{ background: 'white', borderRadius: '20px', padding: '22px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', height: 'fit-content' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={18} color="#2563eb" /> Phiếu Đặt Sân
                </h3>
                
                {/* Danh sách các ca đã chọn */}
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedSlots.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>Chưa chọn ca nào</p>
                  ) : (
                    selectedSlots.map((s, idx) => (
                      <div key={idx} style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span><b>{s.courtName}</b> ({s.time})</span>
                        <b style={{ color: '#10b981' }}>{s.price.toLocaleString()}đ</b>
                      </div>
                    ))
                  )}
                </div>

                {/* Form thông tin khách */}
                <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      <User size={14} color="#2563eb" /> Họ và tên người đặt <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input 
                      type="text"
                      placeholder="VD: Nguyễn Văn A"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      <Phone size={14} color="#2563eb" /> Số điện thoại <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input 
                      type="tel"
                      placeholder="VD: 0912345678"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Tổng tiền và nút bấm */}
                <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>Tổng cộng:</span>
                    <b style={{ fontSize: '20px', color: '#ef4444' }}>{totalAmount.toLocaleString()}₫</b>
                  </div>

                  <button
                    disabled={selectedSlots.length === 0}
                    onClick={handleCheckout}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: selectedSlots.length === 0 ? '#e2e8f0' : '#2563eb',
                      color: selectedSlots.length === 0 ? '#94a3b8' : 'white',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: selectedSlots.length === 0 ? 'not-allowed' : 'pointer',
                      transition: '0.2s'
                    }}
                  >
                    Xác Nhận Đặt Sân
                  </button>
                </div>
              </div>
            </main>
          </>
        )}
      </div>
    </>
  );
}